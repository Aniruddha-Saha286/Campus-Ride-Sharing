import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Clock3,
  Loader2,
  Satellite,
  ChevronRight,
  Map,
  FileText,
  ChevronDown,
  ChevronUp,
  Radio,
  Car,
  Star,
} from "lucide-react";
import {
  getMyRideStatuses,
  updateRideStatus,
} from "../api/rideStatusApi";
import { getPendingRating } from "../api/ratingApi";
import RateDriverModal from "./RateDriverModal.jsx";
import usePolling from "../hooks/usePolling";
import { TRIP_META, NEXT_ACTION, formatTime12Hour } from "../utils/rideStatusConstants";

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

export default function CurrentRideWidget() {
  const [statuses, setStatuses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [expandedIds, setExpandedIds] = useState({});
  const [pendingRatingRide, setPendingRatingRide] = useState(null);
  const [dismissedRideIds, setDismissedRideIds] = useState({});

  const toggleExpanded = (id) =>
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const load = async () => {
    setError("");
    try {
      const res = await getMyRideStatuses();
      setStatuses(res.data.data || []);

      // Check if passenger has any pending unrated ride
      try {
        const ratingRes = await getPendingRating();
        if (ratingRes.data?.data?.ride) {
          const r = ratingRes.data.data.ride;
          if (!dismissedRideIds[r._id]) {
            setPendingRatingRide(r);
          }
        }
      } catch {
        /* ignore rating fetch errors */
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setStatuses([]);
        return;
      }
      setError(err.response?.data?.message || "Could not load ride statuses.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

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

  const handleDismissRating = () => {
    if (pendingRatingRide) {
      setDismissedRideIds((prev) => ({ ...prev, [pendingRatingRide._id]: true }));
    }
    setPendingRatingRide(null);
  };

  if (loading) {
    return (
      <div className="mb-6 flex min-h-[90px] items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-card">
        <Loader2 className="animate-spin text-brand-500" size={22} />
      </div>
    );
  }

  const active = (statuses || []).filter(
    (s) => s.ride && s.tripStatus !== "completed"
  );

  return (
    <>
      {active.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-white via-white to-brand-50/20 p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                <Radio size={16} className="animate-pulse" />
              </span>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-slate-800 flex items-center gap-2">
                  Active Rides
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                    {active.length} Live
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Live status tracking and actions for your ongoing commutes.
                </p>
              </div>
            </div>
            <Link
              to="/ride-tracker"
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Satellite size={12} className="text-brand-500" />
              Full Ride Tracker <ChevronRight size={12} />
            </Link>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-600">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {active.map((entry) => {
              const meta = TRIP_META[entry.tripStatus] || TRIP_META.upcoming;
              const Icon = meta.icon;
              const action = NEXT_ACTION[entry.tripStatus];
              const isExpanded = !!expandedIds[entry._id];
              const isDriver = entry.role === "poster";

              return (
                <div
                  key={entry._id}
                  className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:border-brand-200 hover:shadow-md"
                >
                  <div className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                            <MapPin size={11} className="shrink-0 text-brand-500" />
                            {shortLabel(entry.ride.pickup)}
                          </span>
                          <Navigation size={12} className="shrink-0 text-slate-300" />
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
                            {isDriver ? "Driver" : "Passenger"}
                          </span>
                        </div>

                        <div className="mt-2.5 flex items-center gap-3">
                          <a
                            href={mapsUrl(entry.ride)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                          >
                            <Map size={12} />
                            View in map
                          </a>
                          <button
                            onClick={() => toggleExpanded(entry._id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
                          >
                            <FileText size={12} />
                            {isExpanded ? "Hide address" : "Show full address"}
                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        </div>
                      </div>

                      {/* Status & Action */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.classes}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>

                        {action && isDriver && (
                          <button
                            onClick={() => advance(entry.ride._id, entry.tripStatus)}
                            disabled={busy === entry.ride._id}
                            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              entry.tripStatus === "ongoing"
                                ? "bg-emerald-600 hover:bg-emerald-700 animate-pulse"
                                : "bg-slate-900 hover:bg-brand-600"
                            }`}
                          >
                            {busy === entry.ride._id ? (
                              <Loader2 className="animate-spin" size={13} />
                            ) : (
                              <Icon size={13} />
                            )}
                            {action.label}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable address dropdown */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Pickup</p>
                          <p className="font-medium text-slate-700 mt-0.5">{entry.ride.pickup}</p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Dropoff</p>
                          <p className="font-medium text-slate-700 mt-0.5">{entry.ride.dropoff}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RATE DRIVER POPUP MODAL FOR PASSENGER */}
      {pendingRatingRide && (
        <RateDriverModal
          isOpen={!!pendingRatingRide}
          ride={pendingRatingRide}
          onClose={handleDismissRating}
          onRated={handleDismissRating}
        />
      )}
    </>
  );
}
