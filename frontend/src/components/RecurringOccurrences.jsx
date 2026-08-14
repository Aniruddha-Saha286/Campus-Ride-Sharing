import React, { useState } from "react";
import {
  CalendarX2,
  CalendarCheck,
  Loader2,
  MapPin,
  Navigation,
  Clock3,
  Undo2,
} from "lucide-react";
import { listRecurringRides } from "../api/recurringApi";
import {
  listOccurrenceSkips,
  skipOccurrence,
  restoreOccurrence,
} from "../api/recurringSkipApi";
import usePolling from "../hooks/usePolling";

const dateKey = (value) => {
  if (!value) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

const todayKey = () => dateKey(new Date());

const displayDate = (value) => {
  if (!value) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export default function RecurringOccurrences() {
  const [templates, setTemplates] = useState([]);
  const [skips, setSkips] = useState({});
  const [dates, setDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await listRecurringRides();
      const list = (res.data?.data || []).filter((t) => t.status === "active");
      setTemplates(list);
      const entries = await Promise.all(
        list.map(async (template) => {
          const id = String(template._id);
          const skipRes = await listOccurrenceSkips(id);
          return [id, skipRes.data?.data || []];
        })
      );
      setSkips(Object.fromEntries(entries));
    } catch (err) {
      setError(err.response?.data?.message || "Could not load occurrence cancellations.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  const run = async (key, action, failMessage, templateId) => {
    setBusy(key);
    setError("");
    try {
      await action();
      if (templateId) {
        setDates((prev) => ({ ...prev, [templateId]: "" }));
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || failMessage);
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={22} />
      </div>
    );
  }

  if (templates.length === 0) return null;

  return (
    <section className="mt-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        <CalendarX2 size={15} /> Cancel a single day's ride
      </h2>
      <p className="mt-1 mb-4 text-xs text-slate-400">
        Skip one occurrence of an auto-repeat offer without stopping the rest of the series.
      </p>

      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {templates.map((template) => {
          const id = String(template._id);
          const skippedDates = (skips[id] || []).map((skip) => skip.date);
          const custom = dates[id] || "";
          const next = dateKey(template.nextGenerationDate);
          const nextCancelled = next && skippedDates.includes(next);
          const nextPast = Boolean(next && next < todayKey());
          return (
            <div key={id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                <button
                  onClick={() =>
                    run(id, () => skipOccurrence(id, next), "Could not cancel this occurrence.")
                  }
                  disabled={busy === id || nextPast || !next}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy === id ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : nextCancelled ? (
                    <CalendarCheck size={13} />
                  ) : (
                    <CalendarX2 size={13} />
                  )}
                  {nextCancelled
                    ? "Next ride cancelled"
                    : `Cancel ${displayDate(template.nextGenerationDate)}`}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={custom}
                  min={todayKey()}
                  onChange={(e) => setDates((prev) => ({ ...prev, [id]: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  onClick={() => run(id, () => skipOccurrence(id, custom), "Could not cancel this occurrence.", id)}
                  disabled={busy === id || !custom}
                  className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel this date
                </button>
              </div>

              {skippedDates.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Cancelled dates:</span>
                  {skippedDates.map((date) => (
                    <span
                      key={date}
                      className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600"
                    >
                      {displayDate(date)}
                      <button
                        onClick={() =>
                          run(`${id}-${date}`, () => restoreOccurrence(id, date), "Could not restore this occurrence.")
                        }
                        disabled={busy === `${id}-${date}`}
                        className="rounded-full p-0.5 transition hover:bg-rose-100 disabled:opacity-60"
                        aria-label={`Restore ${date}`}
                      >
                        {busy === `${id}-${date}` ? (
                          <Loader2 className="animate-spin" size={12} />
                        ) : (
                          <Undo2 size={12} />
                        )}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
