import React, { useEffect, useState } from "react";
import {
  HeartHandshake,
  Loader2,
  MapPin,
  Clock3,
  CalendarDays,
  BadgeCheck,
  Eye,
  Settings2,
  ChevronDown,
  Building2,
} from "lucide-react";
import { getMyProfile } from "../api/api";
import {
  getMyCommuterPreference,
  saveCommuterPreference,
  getCommuterSuggestions,
  getContactInfo,
} from "../api/commuterApi";
import AcceptedContactModal from "./AcceptedContactModal.jsx";

const API_ORIGIN = new URL(
  import.meta.env.VITE_API_URL || "http://localhost:5000/api",
).origin;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMPTY_PREFERENCE = {
  homeArea: "",
  destination: "",
  preferredTime: "08:00",
  recurringDays: ["Sun", "Mon", "Tue", "Wed", "Thu"],
};

const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
};

const to24 = (time12) => {
  const match = String(time12 || "").trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return "08:00";
  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hours !== 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
};

const to12 = (time24) => {
  const [h, m] = String(time24 || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
};

export default function CommuterMatches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [pref, setPref] = useState(EMPTY_PREFERENCE);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError("");
    try {
      const [profileRes, prefRes, matchRes] = await Promise.all([
        getMyProfile(),
        getMyCommuterPreference(),
        getCommuterSuggestions(),
      ]);
      setMatches(matchRes.data.data || []);
      const saved = prefRes.data.data;
      setPref({
        homeArea: saved?.homeArea || profileRes.data?.data?.homeArea || "",
        destination: saved?.destination || "",
        preferredTime: saved ? to24(saved.preferredTime) : "08:00",
        recurringDays: saved?.recurringDays?.length ? saved.recurringDays : WEEKDAYS,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Could not load matches.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePreference = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveCommuterPreference({
        homeArea: pref.homeArea,
        destination: pref.destination,
        preferredTime: to12(pref.preferredTime),
        recurringDays: pref.recurringDays,
      });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save your recurring commute.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day) => {
    setPref((prev) => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter((d) => d !== day)
        : [...prev.recurringDays, day],
    }));
  };

  const reveal = async (id) => {
    setBusy(id);
    setError("");
    try {
      const res = await getContactInfo(id);
      setContact(res.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Contact details are hidden until a seat request is accepted.",
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <HeartHandshake size={16} className="text-brand-600" />
          Auto-match recurring commuters
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
        >
          <Settings2 size={13} />
          My commute
          <ChevronDown size={13} className={`transition-transform ${showForm ? "rotate-180" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={savePreference}
          className="mb-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              Your home area
            </span>
            <input
              value={pref.homeArea}
              onChange={(e) => setPref({ ...pref, homeArea: e.target.value })}
              placeholder="e.g. Mirpur 10, Dhaka"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              Destination campus
            </span>
            <input
              value={pref.destination}
              onChange={(e) => setPref({ ...pref, destination: e.target.value })}
              placeholder="e.g. BRAC University, Mohakhali"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              Preferred departure time
            </span>
            <input
              type="time"
              value={pref.preferredTime}
              onChange={(e) => setPref({ ...pref, preferredTime: e.target.value })}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Recurring days</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => {
                const active = pref.recurringDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      active
                        ? "bg-brand-600 text-white"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
            >
              {saving && <Loader2 className="animate-spin" size={12} />}
              {saving ? "Saving..." : "Save commute"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex min-h-[140px] items-center justify-center">
          <Loader2 className="animate-spin text-brand-500" size={22} />
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-xl bg-slate-50 px-4 py-6 text-center">
          <HeartHandshake size={20} className="mx-auto text-slate-300" />
          <p className="mt-2 text-xs text-slate-400">
            No recurring commuters to suggest yet. Save your commute to get matched with people
            from the same area and departure window.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => {
            const s = match.student;
            const src = s.profilePhoto ? `${API_ORIGIN}/${s.profilePhoto}` : null;
            const initial = (s.name || "?").trim().charAt(0).toUpperCase();
            return (
              <div key={s._id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white">
                    {src ? <img src={src} alt={s.name} className="h-full w-full object-cover" /> : initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-sm font-bold text-slate-800">
                      <span className="truncate">{s.name}</span>
                      {s.idVerified && (
                        <BadgeCheck size={14} className="shrink-0 fill-brand-600 text-white" />
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.department}, {s.year}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {match.score}% Match
                  </span>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-brand-500" /> {s.homeArea}
                  </span>
                  {match.destination && (
                    <span className="flex items-center gap-1">
                      <Building2 size={12} /> {match.destination}
                    </span>
                  )}
                  {match.preferredTime || match.departureTime ? (
                    <span className="flex items-center gap-1">
                      <Clock3 size={12} /> Leaves at {match.preferredTime || formatTime(match.departureTime)}
                    </span>
                  ) : null}
                  {match.days && match.days.length > 0 && (
                    <span className="flex items-center gap-1">
                      <CalendarDays size={12} /> {match.days.join(", ")}
                    </span>
                  )}
                </p>
                <button
                  onClick={() => reveal(s._id)}
                  disabled={busy === s._id}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
                >
                  {busy === s._id ? <Loader2 className="animate-spin" size={13} /> : <Eye size={13} />}
                  Reveal contact
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Scores compare home area, destination, departure window (±60 min) and recurring days.
        Contact details unlock for both sides only after a seat request is accepted.
      </p>

      {contact && <AcceptedContactModal contact={contact} onClose={() => setContact(null)} />}
    </div>
  );
}
