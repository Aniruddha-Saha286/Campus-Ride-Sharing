import React, { useState } from "react";
import {
  Repeat2,
  RefreshCw,
  MapPin,
  Navigation,
  Clock3,
  Users,
  Loader2,
  Pause,
  Play,
  Trash2,
  Inbox,
  CalendarClock,
  Map,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { getMyRides } from "../api/rideApi";
import {
  listRecurringRides,
  createRecurringFromRide,
  setRecurringStatus,
  deleteRecurringRide,
  generateRecurringRides,
} from "../api/recurringApi";
import RecurringOccurrences from "./RecurringOccurrences.jsx";
import usePolling from "../hooks/usePolling";
import { formatTime12Hour } from "../utils/rideStatusConstants";

const formatDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const shortLabel = (str) => {
  if (!str) return "";
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
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

const routeKey = (ride) => `${ride.pickup}||${ride.dropoff}||${ride.departureTime}`;

export default function RecurringRides() {
  const [templates, setTemplates] = useState([]);
  const [openRides, setOpenRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");
  const [expandedIds, setExpandedIds] = useState({});

  const toggleExpanded = (id) =>
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const load = async () => {
    setError("");
    try {
      const [recRes, ridesRes] = await Promise.all([listRecurringRides(), getMyRides()]);
      setTemplates(recRes.data?.data || []);
      setOpenRides((ridesRes.data?.data?.posted || []).filter((r) => r.status === "open"));
    } catch (err) {
      setError(err.response?.data?.message || "Could not load recurring offers.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  const run = async (key, action, failMessage, successMessage) => {
    setBusy(key);
    setError("");
    setSuccess("");
    try {
      const res = await action();
      if (successMessage) {
        setSuccess(successMessage);
      } else if (key === "generate" && res?.data?.data?.generated !== undefined) {
        setSuccess(`Generated ${res.data.data.generated} ride(s) for today!`);
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || failMessage);
    } finally {
      setBusy("");
    }
  };

  const templatedKeys = new Set(templates.map(routeKey));
  const repeatableRides = openRides.filter((ride) => !templatedKeys.has(routeKey(ride)));
  const activeCount = templates.filter((t) => t.status === "active").length;

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-brand-900 p-6 text-white shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/20 text-brand-400">
              <Repeat2 size={16} />
            </span>
            <h2 className="text-lg font-bold text-white">Daily Commute Automation</h2>
          </div>
          <p className="text-xs text-slate-300">
            Set it once. Rides are automatically reposted daily so your regular route is always open for passengers.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 pt-1 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-medium text-slate-200 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {activeCount} Active Series
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-medium text-slate-200 backdrop-blur-sm">
              <CalendarDays size={13} className="text-sky-300" />
              {repeatableRides.length} Eligible Posted Ride{repeatableRides.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <button
          onClick={() => run("generate", generateRecurringRides, "Could not generate today's rides.")}
          disabled={busy === "generate"}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-brand-400 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "generate" ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <RefreshCw size={14} className={busy === "generate" ? "animate-spin" : ""} />
          )}
          Generate Today's Rides
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 size={16} className="text-emerald-600" />
          {success}
        </div>
      )}

      {/* Eligible Rides to Make Recurring */}
      {repeatableRides.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/50 via-white to-sky-50/30 p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100 text-brand-700">
                <Sparkles size={14} />
              </span>
              <h3 className="text-sm font-bold text-slate-800">
                Turn your active rides into daily recurring offers
              </h3>
            </div>
            <span className="text-xs font-semibold text-brand-600">
              {repeatableRides.length} available
            </span>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Click "Repeat Daily" to save a template. You won't need to post this ride manually each morning.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {repeatableRides.map((ride) => (
              <div
                key={ride._id}
                className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                      <MapPin size={11} className="shrink-0" />
                      {shortLabel(ride.pickup)}
                    </span>
                    <Navigation size={12} className="shrink-0 text-slate-300" />
                    <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      <MapPin size={11} className="shrink-0" />
                      {shortLabel(ride.dropoff)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Clock3 size={12} className="text-brand-500" /> {formatTime12Hour(ride.departureTime)}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Users size={12} className="text-brand-500" /> {ride.seats} seat{ride.seats === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3">
                  <a
                    href={mapsUrl(ride)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    <Map size={12} />
                    View map
                  </a>
                  <button
                    onClick={() =>
                      run(
                        ride._id,
                        () => createRecurringFromRide(ride._id),
                        "Could not save the recurring offer.",
                        "Saved as a daily recurring ride!"
                      )
                    }
                    disabled={busy === ride._id}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === ride._id ? (
                      <Loader2 className="animate-spin" size={13} />
                    ) : (
                      <Repeat2 size={13} />
                    )}
                    Repeat Daily
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Recurring Templates */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <Repeat2 size={15} /> Your Auto-Repeat Commute Series
          </h2>
          <span className="text-xs font-medium text-slate-400">
            {templates.length} series saved
          </span>
        </div>

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <Inbox size={24} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">No recurring offers set up yet</p>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              Post a ride from the Request/Offer page once, and then click "Repeat Daily" to automate your daily schedule.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => {
              const isExpanded = !!expandedIds[template._id];
              const isActive = template.status === "active";

              return (
                <div
                  key={template._id}
                  className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card transition-shadow hover:shadow-md"
                >
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                            <MapPin size={11} className="shrink-0" />
                            {shortLabel(template.pickup)}
                          </span>
                          <Navigation size={12} className="shrink-0 text-slate-300" />
                          <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            <MapPin size={11} className="shrink-0" />
                            {shortLabel(template.dropoff)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                              }`}
                            />
                            {isActive ? "Active Daily" : "Paused"}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Clock3 size={13} className="text-brand-400" />
                            {formatTime12Hour(template.departureTime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={13} className="text-brand-400" />
                            {template.seats} seat{template.seats === 1 ? "" : "s"}
                          </span>
                          {isActive ? (
                            <span className="flex items-center gap-1 text-brand-600 font-medium">
                              <CalendarClock size={13} />
                              Next: {formatDate(template.nextGenerationDate)}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">
                              Paused — no new rides auto-generated
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            run(
                              template._id,
                              () =>
                                setRecurringStatus(
                                  template._id,
                                  isActive ? "disabled" : "active"
                                ),
                              "Could not update status.",
                              isActive ? "Series paused." : "Series activated!"
                            )
                          }
                          disabled={busy === template._id}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                            isActive
                              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {isActive ? <Pause size={13} /> : <Play size={13} />}
                          {isActive ? "Pause" : "Resume"}
                        </button>

                        <button
                          onClick={() =>
                            run(
                              template._id,
                              () => deleteRecurringRide(template._id),
                              "Could not delete the recurring offer.",
                              "Recurring series removed."
                            )
                          }
                          disabled={busy === template._id}
                          className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy === template._id ? (
                            <Loader2 className="animate-spin" size={13} />
                          ) : (
                            <Trash2 size={13} />
                          )}
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Bottom toolbar */}
                    <div className="mt-4 flex items-center gap-2 border-t border-slate-50 pt-3">
                      <a
                        href={mapsUrl(template)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                      >
                        <Map size={13} />
                        View in map
                      </a>
                      <button
                        onClick={() => toggleExpanded(template._id)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        <FileText size={13} />
                        {isExpanded ? "Hide details" : "Show details"}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Full Pickup
                          </p>
                          <p className="text-sm font-medium text-slate-700 leading-relaxed">
                            {template.pickup}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Full Dropoff
                          </p>
                          <p className="text-sm font-medium text-slate-700 leading-relaxed">
                            {template.dropoff}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 pt-1">
                        <div>
                          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Capacity
                          </p>
                          <p className="text-sm font-semibold text-slate-700">
                            {template.seats} seats
                          </p>
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Scheduled Time
                          </p>
                          <p className="text-sm font-semibold text-slate-700">
                            {formatTime12Hour(template.departureTime)}
                          </p>
                        </div>
                        <div>
                          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Next Generation Date
                          </p>
                          <p className="text-sm font-semibold text-slate-700">
                            {formatDate(template.nextGenerationDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Date-specific Skip / Holiday manager */}
      <RecurringOccurrences />
    </div>
  );
}
