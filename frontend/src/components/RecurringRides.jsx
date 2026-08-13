import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { getMyRides } from "../api/rideApi";
import {
  listRecurringRides,
  createRecurringFromRide,
  setRecurringStatus,
  deleteRecurringRide,
  generateRecurringRides,
} from "../api/recurringApi";

const formatDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const routeKey = (ride) => `${ride.pickup}||${ride.dropoff}||${ride.departureTime}`;

export default function RecurringRides() {
  const [templates, setTemplates] = useState([]);
  const [openRides, setOpenRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (key, action, failMessage) => {
    setBusy(key);
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || failMessage);
    } finally {
      setBusy("");
    }
  };

  const templatedKeys = new Set(templates.map(routeKey));
  const repeatableRides = openRides.filter((ride) => !templatedKeys.has(routeKey(ride)));

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={24} />
      </div>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <Repeat2 size={15} /> Auto-repeat offers
        </h2>
        <button
          onClick={() => run("generate", generateRecurringRides, "Could not generate today's rides.")}
          disabled={busy === "generate"}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "generate" ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />}
          Generate today's rides
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
          {error}
        </div>
      )}

      {templates.length === 0 && repeatableRides.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-card">
          <Inbox size={24} className="text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">No recurring offers yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Post a ride once and the system reposts it for you every day.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div key={template._id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                    <span className="flex items-center gap-1 font-medium text-slate-800">
                      <MapPin size={13} className="text-brand-500" /> {template.pickup}
                    </span>
                    <Navigation size={13} className="text-slate-300" />
                    <span className="flex items-center gap-1 font-medium text-slate-800">
                      {template.dropoff}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock3 size={12} /> {template.departureTime}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                    <Users size={12} /> {template.seats} seat{template.seats === 1 ? "" : "s"}
                    {template.status === "active" ? (
                      <>
                        <span className="mx-1">·</span>
                        <CalendarClock size={12} /> Next ride: {formatDate(template.nextGenerationDate)}
                      </>
                    ) : (
                      <span className="ml-2 text-slate-400">Paused — no new rides are posted</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      template.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {template.status === "active" ? "Active" : "Disabled"}
                  </span>
                  <button
                    onClick={() =>
                      run(
                        template._id,
                        () => setRecurringStatus(template._id, template.status === "active" ? "disabled" : "active"),
                        "Could not update the recurring offer."
                      )
                    }
                    disabled={busy === template._id}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {template.status === "active" ? <Pause size={13} /> : <Play size={13} />}
                    {template.status === "active" ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => run(template._id, () => deleteRecurringRide(template._id), "Could not delete the recurring offer.")}
                    disabled={busy === template._id}
                    className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === template._id ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {repeatableRides.length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mark a ride to repeat daily
              </p>
              <div className="space-y-2">
                {repeatableRides.map((ride) => (
                  <div
                    key={ride._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                      <span className="flex items-center gap-1 font-medium text-slate-800">
                        <MapPin size={13} className="text-brand-500" /> {ride.pickup}
                      </span>
                      <Navigation size={13} className="text-slate-300" />
                      <span className="flex items-center gap-1 font-medium text-slate-800">
                        {ride.dropoff}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock3 size={12} /> {ride.departureTime}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        run(ride._id, () => createRecurringFromRide(ride._id), "Could not save the recurring offer.")
                      }
                      disabled={busy === ride._id}
                      className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy === ride._id ? <Loader2 className="animate-spin" size={13} /> : <Repeat2 size={13} />}
                      Repeat daily
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
