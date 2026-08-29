import React, { useState, useEffect } from "react";
import {
  MapPin,
  Navigation,
  Clock3,
  Loader2,
  Inbox,
  Satellite,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Map,
  FileText,
  Radio,
  Car,
  UserCheck,
  Flag,
  Sparkles,
  Play,
  Star,
} from "lucide-react";
import {
  getMyRideStatuses,
  updateRideStatus,
} from "../api/rideStatusApi";
import { getPendingRating } from "../api/ratingApi";
import RateDriverModal from "./RateDriverModal.jsx";
import usePolling from "../hooks/usePolling";
import { onRealtime } from "../api/realtimeBus";
import { TRIP_META, NEXT_ACTION, TIMELINE_COLORS, formatTime12Hour } from "../utils/rideStatusConstants";

const isCoord = (s) => /^-?\d+\.\d+$/.test(s.trim());

const shortLabel = (str) => {
  if (!str) return "";
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2 && isCoord(parts[0]) && isCoord(parts[1])) {
    return `${parseFloat(parts[0]).toFixed(4)}, ${parseFloat(parts[1]).toFixed(4)}`;
  }
  return parts[0] || str;
};

const cleanAddress = (str) => {
  if (!str) return "";
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  const unique = [...new Set(parts)];
  const trimmed = unique.slice(0, 4).join(", ");
  return trimmed.includes("Bangladesh") ? trimmed : `${trimmed}, Bangladesh`;
};

const mapsUrl = (ride) => {
  if (!ride) return "#";
  const hasCoords =
    ride.pickupLat != null &&
    ride.pickupLng != null &&
    ride.dropoffLat != null &&
    ride.dropoffLng != null;

  if (hasCoords) {
    return `https://www.google.com/maps/dir/?api=1&origin=${ride.pickupLat},${ride.pickupLng}&destination=${ride.dropoffLat},${ride.dropoffLng}&travelmode=driving`;
  }

  const origin = encodeURIComponent(cleanAddress(ride.pickup));
  const dest = encodeURIComponent(cleanAddress(ride.dropoff));
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
};

const STEPS = [
  { key: "upcoming", label: "Upcoming", desc: "Waiting for departure", icon: Clock3 },
  { key: "ongoing", label: "In Transit", desc: "Ride is ongoing", icon: Play },
  { key: "completed", label: "Completed", desc: "Arrived at destination", icon: CheckCircle2 },
];

function TripProgressStepper({ currentStatus }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStatus);
  const activeIdx = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="mt-4 mb-2 px-2">
      <div className="relative flex items-center justify-between">
        {/* Progress Bar Background */}
        <div className="absolute top-1/2 left-0 h-1.5 w-full -translate-y-1/2 rounded-full bg-slate-100" />
        {/* Active Progress Fill */}
        <div
          className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-brand-500 via-amber-500 to-emerald-500 transition-all duration-500"
          style={{
            width: `${(activeIdx / (STEPS.length - 1)) * 100}%`,
          }}
        />

        {STEPS.map((step, idx) => {
          const isDone = idx < activeIdx;
          const isCurrent = idx === activeIdx;
          const Icon = step.icon;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isDone
                    ? "bg-emerald-500 text-white shadow-sm ring-4 ring-emerald-50"
                    : isCurrent
                    ? "bg-amber-500 text-white ring-4 ring-amber-100 shadow-md animate-pulse"
                    : "border-2 border-slate-200 bg-white text-slate-400"
                }`}
              >
                {isDone ? <CheckCircle2 size={16} /> : <Icon size={14} />}
              </div>
              <span
                className={`mt-2 text-xs font-bold tracking-tight ${
                  isCurrent
                    ? "text-amber-700 font-extrabold"
                    : isDone
                    ? "text-emerald-700"
                    : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:block">
                {step.desc}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RideStatusTracker() {
  const [statuses, setStatuses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [expanded, setExpanded] = useState({});
  const [pendingRatingRide, setPendingRatingRide] = useState(null);
  const [dismissedRideIds, setDismissedRideIds] = useState({});

  const toggleExpanded = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const load = async () => {
    setError("");
    try {
      const res = await getMyRideStatuses();
      setStatuses(res.data.data || []);

      // Check if passenger has any unrated completed ride
      try {
        const ratingRes = await getPendingRating();
        if (ratingRes.data?.data?.ride) {
          const r = ratingRes.data.data.ride;
          if (!dismissedRideIds[r._id]) {
            setPendingRatingRide(r);
          }
        }
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not load ride statuses.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  useEffect(() => {
    const off = onRealtime((event) => {
      if (
        event?.type === "RIDE_COMPLETED" ||
        event?.type === "RIDE_STATUS_UPDATED" ||
        event?.type === "RATING_RECEIVED"
      ) {
        load();
      }
    });
    return () => off();
  }, []);

  const handleDismissRating = () => {
    if (pendingRatingRide) {
      setDismissedRideIds((prev) => ({ ...prev, [pendingRatingRide._id]: true }));
    }
    setPendingRatingRide(null);
  };

  const handleOpenRatingForRide = (ride) => {
    if (!ride) return;
    setPendingRatingRide(ride);
  };

  const advance = async (rideId, currentStatus) => {
    const action = NEXT_ACTION[currentStatus];
    if (!action) return;
    setBusy(rideId);
    setError("");
    try {
      await updateRideStatus(rideId, action.next);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update ride status.");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  const avatar = (student) => {
    if (!student) return null;
    const src = student.profilePhoto || null;
    const initial = (student.name || "?").trim().charAt(0).toUpperCase();
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white shadow-sm">
        {src ? (
          <img src={src} alt={student.name} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>
    );
  };

  const active = (statuses || []).filter((s) => s.ride && s.tripStatus !== "completed");
  const done = (statuses || []).filter((s) => s.ride && s.tripStatus === "completed");

  return (
    <div className="w-full max-w-none px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                <Satellite size={18} />
              </span>
              Ride Status Tracker
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Live progression, stage controls, and step-by-step audit logs for your active rides.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 px-3 py-1 font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {active.length} Active Ride{active.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
              <CheckCircle2 size={13} className="text-slate-400" />
              {done.length} Completed
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        {/* Active Rides Section */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              <Radio size={15} className="text-brand-500 animate-pulse" /> Live Active Rides
            </h2>
          </div>

          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                <Inbox size={24} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">No active trips currently in transit</p>
              <p className="mt-1 text-xs text-slate-400">
                Post or book a ride to see real-time updates and advance trip stages here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {active.map((entry) => {
                const meta = TRIP_META[entry.tripStatus] || TRIP_META.upcoming;
                const Icon = meta.icon;
                const isExpanded = !!expanded[entry._id];
                const action = NEXT_ACTION[entry.tripStatus];
                const isDriver = entry.role === "poster";
                const canUpdate = entry.ride.status === "open" && entry.tripStatus !== "completed" && isDriver;

                return (
                  <div
                    key={entry._id}
                    className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card transition-shadow hover:shadow-md"
                  >
                    <div className="p-6">
                      {/* Top Row: Route Pills & Driver Info */}
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                              <MapPin size={11} className="shrink-0 text-brand-500" />
                              {shortLabel(entry.ride.pickup)}
                            </span>
                            <Navigation size={13} className="shrink-0 text-slate-300" />
                            <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                              <MapPin size={11} className="shrink-0 text-slate-500" />
                              {shortLabel(entry.ride.dropoff)}
                            </span>

                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                              <Clock3 size={11} className="text-brand-500" />
                              {formatTime12Hour(entry.ride.departureTime)}
                            </span>

                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                isDriver
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                                  : "bg-amber-50 text-amber-700 border border-amber-200/60"
                              }`}
                            >
                              {isDriver ? "Driver View" : "Passenger View"}
                            </span>
                          </div>

                          {/* Driver / Poster detail line */}
                          <div className="mt-3 flex items-center gap-2.5">
                            {avatar(entry.ride.poster)}
                            <div className="text-xs">
                              <p className="font-bold text-slate-800">
                                {entry.ride.poster?.name}
                                <span className="ml-1.5 font-normal text-slate-400">
                                  · {entry.ride.poster?.department}, {entry.ride.poster?.year}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Status Chip & Next Action Button */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${meta.classes}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${meta.dot} animate-pulse`} />
                            {meta.label}
                          </span>

                          {canUpdate && action && (
                            <button
                              onClick={() => advance(entry.ride._id, entry.tripStatus)}
                              disabled={busy === entry.ride._id}
                              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busy === entry.ride._id ? (
                                <Loader2 className="animate-spin" size={13} />
                              ) : (
                                <Icon size={14} />
                              )}
                              {action.label}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Interactive Visual Progress Stepper */}
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <TripProgressStepper currentStatus={entry.tripStatus} />
                      </div>

                      {/* Bottom Action Bar */}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                        <div className="flex items-center gap-3">
                          <a
                            href={mapsUrl(entry.ride)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                          >
                            <Map size={13} />
                            View in Map
                          </a>
                        </div>

                        <button
                          onClick={() => toggleExpanded(entry._id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                        >
                          <FileText size={13} />
                          {isExpanded ? "Hide activity log" : "View timeline & addresses"}
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Activity Log & Full Addresses */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-6 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl bg-white p-4 border border-slate-100">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Pickup Location
                            </p>
                            <p className="text-xs font-medium text-slate-700 mt-1 leading-relaxed">
                              {entry.ride.pickup}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Dropoff Location
                            </p>
                            <p className="text-xs font-medium text-slate-700 mt-1 leading-relaxed">
                              {entry.ride.dropoff}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                            <Clock3 size={13} /> Live Timestamp Audit Log
                          </p>
                          {(entry.timeline || []).length === 0 ? (
                            <p className="text-xs text-slate-400">No events logged yet.</p>
                          ) : (
                            <div className="space-y-2 rounded-xl bg-white p-4 border border-slate-100">
                              {(entry.timeline || []).map((step, i) => {
                                const stepMeta = TRIP_META[step.status] || TRIP_META.upcoming;
                                return (
                                  <div key={i} className="flex items-start gap-3 text-xs">
                                    <div
                                      className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
                                        TIMELINE_COLORS[step.status] || "bg-brand-500"
                                      }`}
                                    />
                                    <div className="flex-1">
                                      <span className="font-bold text-slate-800">
                                        {stepMeta.label}
                                      </span>
                                      <span className="ml-2 text-slate-400">
                                        {new Date(step.timestamp).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                      {step.updatedBy && (
                                        <span className="ml-2 text-slate-500 italic">
                                          (by {step.updatedBy.name})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Completed Rides History Section */}
        {done.length > 0 && (
          <section className="pt-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              <CheckCircle2 size={15} className="text-emerald-500" /> Completed Rides History
            </h2>
            <div className="space-y-3">
              {done.map((entry) => {
                const meta = TRIP_META[entry.tripStatus] || TRIP_META.completed;
                return (
                  <div
                    key={entry._id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm opacity-80 transition hover:opacity-100"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                        <MapPin size={11} className="text-slate-400" />
                        {shortLabel(entry.ride?.pickup)}
                      </span>
                      <Navigation size={12} className="text-slate-300" />
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                        <MapPin size={11} className="text-slate-400" />
                        {shortLabel(entry.ride?.dropoff)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {entry.role === "rider" && entry.ride && (
                        <button
                          type="button"
                          onClick={() => handleOpenRatingForRide(entry.ride)}
                          className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 transition hover:bg-amber-100 cursor-pointer"
                        >
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          Rate Driver
                        </button>
                      )}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.classes}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {pendingRatingRide && (
        <RateDriverModal
          isOpen={!!pendingRatingRide}
          ride={pendingRatingRide}
          onClose={handleDismissRating}
          onRated={handleDismissRating}
        />
      )}
    </div>
  );
}
