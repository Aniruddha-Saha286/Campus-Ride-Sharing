import React, { useEffect, useState } from "react";
import {
  CalendarX2,
  CalendarCheck,
  Loader2,
  MapPin,
  Navigation,
  Clock3,
  Undo2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { listRecurringRides } from "../api/recurringApi";
import {
  listOccurrenceSkips,
  skipOccurrence,
  restoreOccurrence,
} from "../api/recurringSkipApi";

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

const shortLabel = (str) => {
  if (!str) return "";
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[0] || str;
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

  if (loading) {
    return (
      <div className="flex min-h-[120px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={20} />
      </div>
    );
  }

  if (templates.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <CalendarX2 size={16} />
        </span>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Holiday / Single Day Skip Manager
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Need to skip a specific day without deleting your entire routine? Cancel individual dates below.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {templates.map((template) => {
          const id = String(template._id);
          const skippedDates = (skips[id] || []).map((skip) => skip.date);
          const custom = dates[id] || "";
          const next = dateKey(template.nextGenerationDate);
          const nextCancelled = next && skippedDates.includes(next);
          const nextPast = Boolean(next && next < todayKey());

          return (
            <div
              key={id}
              className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    <Clock3 size={12} className="text-brand-500" /> {template.departureTime}
                  </span>
                </div>

                <button
                  onClick={() =>
                    run(id, () => skipOccurrence(id, next), "Could not cancel this occurrence.")
                  }
                  disabled={busy === id || nextPast || !next || nextCancelled}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                    nextCancelled
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                      : "border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                  } disabled:opacity-60`}
                >
                  {busy === id ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : nextCancelled ? (
                    <CalendarCheck size={13} />
                  ) : (
                    <CalendarX2 size={13} />
                  )}
                  {nextCancelled
                    ? `Next (${displayDate(template.nextGenerationDate)}) is Skipped`
                    : `Skip Next (${displayDate(template.nextGenerationDate)})`}
                </button>
              </div>

              {/* Custom Date Picker Bar */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Calendar size={13} className="text-slate-400" /> Custom date:
                </span>
                <input
                  type="date"
                  value={custom}
                  min={todayKey()}
                  onChange={(e) => setDates((prev) => ({ ...prev, [id]: e.target.value }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  onClick={() =>
                    run(
                      id,
                      () => skipOccurrence(id, custom),
                      "Could not cancel this occurrence.",
                      id
                    )
                  }
                  disabled={busy === id || !custom}
                  className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Skip Selected Date
                </button>
              </div>

              {/* List of Skipped / Cancelled Dates */}
              {skippedDates.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">Skipped dates:</span>
                  {skippedDates.map((date) => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
                    >
                      <span>{displayDate(date)}</span>
                      <button
                        onClick={() =>
                          run(
                            `${id}-${date}`,
                            () => restoreOccurrence(id, date),
                            "Could not restore this occurrence."
                          )
                        }
                        disabled={busy === `${id}-${date}`}
                        className="rounded-full p-0.5 text-rose-500 hover:bg-rose-100 transition"
                        title="Restore this date"
                      >
                        {busy === `${id}-${date}` ? (
                          <Loader2 className="animate-spin" size={11} />
                        ) : (
                          <Undo2 size={11} />
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
