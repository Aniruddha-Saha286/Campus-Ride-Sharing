import React, { useState } from "react";
import {
  X,
  MapPin,
  Clock3,
  Users,
  Wallet,
  FileText,
  Loader2,
  Check,
  AlertTriangle,
  Info,
  Lock,
} from "lucide-react";
import MapPicker from "./MapPicker.jsx";
import { updateRide } from "../api/rideApi";
import { parse12HourTo24, formatTime12Hour } from "../utils/rideStatusConstants";

const TIME_12H_PRESETS = [
  { label: "08:00 AM", hour: "08", min: "00", ampm: "AM", time24: "08:00" },
  { label: "09:30 AM", hour: "09", min: "30", ampm: "AM", time24: "09:30" },
  { label: "11:00 AM", hour: "11", min: "00", ampm: "AM", time24: "11:00" },
  { label: "01:30 PM", hour: "01", min: "30", ampm: "PM", time24: "13:30" },
  { label: "03:30 PM", hour: "03", min: "30", ampm: "PM", time24: "15:30" },
  { label: "05:00 PM", hour: "05", min: "00", ampm: "PM", time24: "17:00" },
];

const FARE_PRESETS = [
  { label: "Free", value: 0 },
  { label: "৳40", value: 40 },
  { label: "৳60", value: 60 },
  { label: "৳80", value: 80 },
  { label: "৳100", value: 100 },
];

const parseInitialTime = (time24Str) => {
  if (!time24Str || !time24Str.includes(":")) {
    return { hour12: "08", minute: "00", ampm: "AM" };
  }
  const [h24, m] = time24Str.split(":");
  const hNum = parseInt(h24, 10);
  const ampm = hNum >= 12 ? "PM" : "AM";
  const h12 = hNum % 12 === 0 ? 12 : hNum % 12;
  return {
    hour12: String(h12).padStart(2, "0"),
    minute: m || "00",
    ampm,
  };
};

export default function EditRideModal({ ride, onClose, onSuccess }) {
  const initialTime = parseInitialTime(ride?.departureTime);

  const [pickup, setPickup] = useState({
    label: ride?.pickup || "",
    lat: ride?.pickupLat ?? null,
    lng: ride?.pickupLng ?? null,
  });
  const [dropoff, setDropoff] = useState({
    label: ride?.dropoff || "",
    lat: ride?.dropoffLat ?? null,
    lng: ride?.dropoffLng ?? null,
  });

  const [hour12, setHour12] = useState(initialTime.hour12);
  const [minute, setMinute] = useState(initialTime.minute);
  const [ampm, setAmpm] = useState(initialTime.ampm);

  const [seats, setSeats] = useState(ride?.seats || 2);
  const [charge, setCharge] = useState(ride?.charge ?? 0);
  const [notes, setNotes] = useState(ride?.notes || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const acceptedCount = (ride?.requests || []).filter((r) => r.status === "accepted").length;
  const minSeatsAllowed = Math.max(1, acceptedCount);

  const departureTime24 = parse12HourTo24(hour12, minute, ampm);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!pickup?.label || !dropoff?.label) {
      setError("Please specify both pickup and drop-off locations.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        pickup: pickup.label.trim(),
        dropoff: dropoff.label.trim(),
        pickupLat: pickup.lat ?? null,
        pickupLng: pickup.lng ?? null,
        dropoffLat: dropoff.lat ?? null,
        dropoffLng: dropoff.lng ?? null,
        departureTime: departureTime24,
        seats: Number(seats),
        charge: charge !== "" && charge !== null ? Number(charge) : 0,
        notes: notes ? notes.trim() : "",
      };

      const res = await updateRide(ride._id, payload);
      if (onSuccess) onSuccess(res.data?.data || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update ride offer. Please check all fields.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto backdrop-blur-xs">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/60">
          <div>
            <h2 className="text-base font-bold text-slate-800">Edit Ride Offer</h2>
            <p className="text-xs text-slate-400">Update route, available seats, departure time, or notes</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 p-4 text-xs font-medium text-rose-700 border border-rose-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Route Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin size={13} className="text-brand-500" /> Route & Landmarks
              </h3>
              {acceptedCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shadow-xs">
                  <Lock size={11} /> Route Locked
                </span>
              )}
            </div>

            {acceptedCount > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3 text-xs">
                <div className="flex items-start gap-2 text-amber-800">
                  <Info size={15} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="leading-relaxed">
                    Route, departure time, and fare cannot be changed because <strong>{acceptedCount} passenger{acceptedCount > 1 ? "s have" : " has"}</strong> already been accepted. You can still update available seats and notes.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="rounded-xl bg-white p-3 border border-amber-100 shadow-xs">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Pick-up Location</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{pickup?.label || "Not specified"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 border border-amber-100 shadow-xs">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Drop-off Location</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{dropoff?.label || "Not specified"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/40">
                <MapPicker
                  pickup={pickup}
                  dropoff={dropoff}
                  onPickupChange={setPickup}
                  onDropoffChange={setDropoff}
                />
              </div>
            )}
          </div>

          {/* Timing Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock3 size={13} className="text-blue-500" /> Departure Time
              </h3>
              {acceptedCount > 0 ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 shadow-xs">
                  <Lock size={11} /> Time Locked
                </span>
              ) : (
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                  {formatTime12Hour(departureTime24)}
                </span>
              )}
            </div>

            {acceptedCount > 0 ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <Clock3 size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Departure Time</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{formatTime12Hour(departureTime24)}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2.5 py-1 rounded-full">
                  <Lock size={10} /> Locked for accepted riders
                </span>
              </div>
            ) : (
              <>
                {/* Quick Presets */}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {TIME_12H_PRESETS.map((preset) => {
                    const isActive = hour12 === preset.hour && minute === preset.min && ampm === preset.ampm;
                    return (
                      <button
                        key={preset.time24}
                        type="button"
                        onClick={() => {
                          setHour12(preset.hour);
                          setMinute(preset.min);
                          setAmpm(preset.ampm);
                        }}
                        className={`rounded-xl border px-2 py-1.5 text-xs font-bold transition ${
                          isActive
                            ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Manual Time Inputs */}
                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={hour12}
                    onChange={(e) => setHour12(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => (
                      <option key={h} value={h}>
                        {h} Hour
                      </option>
                    ))}
                  </select>

                  <span className="font-bold text-slate-400">:</span>

                  <select
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                  >
                    {["00", "15", "30", "45"].map((m) => (
                      <option key={m} value={m}>
                        {m} Min
                      </option>
                    ))}
                  </select>

                  <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
                    {["AM", "PM"].map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setAmpm(period)}
                        className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                          ampm === period
                            ? "bg-white text-blue-700 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Seats & Charge Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Seats */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users size={13} className="text-indigo-500" /> Total Available Seats
              </h3>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((s) => {
                  const isDisabled = s < minSeatsAllowed;
                  const isSelected = seats === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setSeats(s)}
                      className={`flex h-10 flex-1 items-center justify-center rounded-xl border text-xs font-bold transition ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                          : isDisabled
                          ? "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300"
                          : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {acceptedCount > 0 && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                  <Info size={11} className="text-indigo-400" />
                  Minimum {acceptedCount} seat{acceptedCount > 1 ? "s" : ""} required (already accepted).
                </p>
              )}
            </div>

            {/* Fare / Charge */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Wallet size={13} className="text-emerald-500" /> Total Trip Fare (BDT)
                </h3>
                {acceptedCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shadow-xs">
                    <Lock size={10} /> Locked
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Total trip cost to be automatically divided equally among confirmed riders.
              </p>

              {acceptedCount > 0 ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                      <Wallet size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Total Trip Fare</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">
                        {Number(charge) > 0 ? `৳${charge} total` : "Free"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Locked for accepted riders</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {FARE_PRESETS.map((preset) => {
                      const isSelected = Number(charge) === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setCharge(preset.value)}
                          className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                              : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      step="5"
                      value={charge}
                      onChange={(e) => setCharge(e.target.value)}
                      placeholder="Custom amount"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-emerald-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes / Instructions */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText size={13} className="text-slate-500" /> Ride Notes & Pick-up Instructions
            </h3>
            <textarea
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Waiting near Gate 2, please be on time..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500"
            />
          </div>

          {/* Modal Actions Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
