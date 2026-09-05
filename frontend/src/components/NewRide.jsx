import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Loader2,
  ArrowLeft,
  Clock3,
  Users,
  Wallet,
  FileText,
  CheckCircle2,
  Info,
  Car,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import MapPicker from "./MapPicker.jsx";
import { createRide } from "../api/rideApi";
import { formatTime12Hour, parse12HourTo24 } from "../utils/rideStatusConstants";

const formatCoords = (pos) => (pos ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : "Not set");

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

export default function NewRide() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  // 12-Hour Time State
  const [hour12, setHour12] = useState("08");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState("AM");

  const [seats, setSeats] = useState(2);
  const [charge, setCharge] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const departureTime24 = parse12HourTo24(hour12, minute, ampm);

  const handleSubmit = async () => {
    if (!pickup || !dropoff) return;
    setSaving(true);
    setError("");

    try {
      await createRide({
        pickup: pickup.label || formatCoords(pickup),
        dropoff: dropoff.label || formatCoords(dropoff),
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        departureTime: departureTime24,
        seats: Number(seats),
        charge: charge !== "" && charge !== null ? Number(charge) : 0,
        notes: notes ? notes.trim() : "",
      });
      navigate("/my-rides");
    } catch (err) {
      setError(err.response?.data?.message || "Could not post your ride. Please check all fields.");
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = pickup && dropoff && departureTime24 && seats >= 1;

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50/60 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page Top Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/dashboard"
              className="group mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-blue-600"
            >
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Car size={20} />
              </span>
              <span>Post a Ride</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Select pickup and destination on the map or search bar, set your ride details, and share seats with fellow students.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2 text-xs font-semibold text-blue-700">
            <ShieldCheck size={16} className="text-blue-600" />
            <span>Verified Student Rides</span>
          </div>
        </div>

        {/* 2-Column Responsive Grid Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Map with Search */}
          <div className="space-y-4 lg:col-span-7 xl:col-span-8">
            <MapPicker
              pickup={pickup}
              dropoff={dropoff}
              onPickupChange={(pos) => {
                setError("");
                setPickup(pos);
              }}
              onDropoffChange={(pos) => {
                setError("");
                setDropoff(pos);
              }}
              onRouteCalculated={(info) => {
                setRouteInfo(info);
              }}
            />

            {/* Selected Location Summary Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Pickup Point Card */}
              <div
                className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                  pickup
                    ? "border-blue-200 bg-blue-50/40 shadow-sm"
                    : "border-dashed border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs ${
                      pickup
                        ? "bg-blue-600 text-white shadow-blue-500/20"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <MapPin size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                      Pickup Location
                    </p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-800">
                      {pickup?.label || "Not selected yet"}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {pickup ? formatCoords(pickup) : "Search above or click on map"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dropoff Point Card */}
              <div
                className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                  dropoff
                    ? "border-rose-200 bg-rose-50/40 shadow-sm"
                    : "border-dashed border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs ${
                      dropoff
                        ? "bg-rose-600 text-white shadow-rose-500/20"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <Navigation size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                      Drop-off Location
                    </p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-800">
                      {dropoff?.label || "Not selected yet"}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {dropoff ? formatCoords(dropoff) : "Search above or click on map"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Ride Details Form */}
          <div className="space-y-5 lg:col-span-5 xl:col-span-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl">
              <h2 className="text-base font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
                <span>Ride Details</span>
                {routeInfo && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={12} />
                    <span>Route Ready</span>
                  </span>
                )}
              </h2>

              {/* Route Metrics Preview */}
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="border-r border-slate-200/80 pr-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Distance</p>
                    <p className="mt-0.5 text-sm font-extrabold text-slate-800">
                      {routeInfo?.distance ? `${routeInfo.distance} km` : "—"}
                    </p>
                  </div>
                  <div className="pl-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Est. Drive Time</p>
                    <p className="mt-0.5 text-sm font-extrabold text-slate-800">
                      {routeInfo?.durationText ? `~${routeInfo.durationText}` : routeInfo?.duration ? `~${routeInfo.duration} mins` : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Controls */}
              <div className="mt-5 space-y-4">
                {/* 12-Hour Departure Time Selector */}
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Clock3 size={14} className="text-blue-600" />
                      Departure Time (12-Hour)
                    </span>
                    <span className="font-bold text-blue-600 text-xs">{hour12}:{minute} {ampm}</span>
                  </label>
                  
                  {/* Interactive 12-Hour Time Inputs */}
                  <div className="flex items-center gap-2">
                    {/* Hour Select */}
                    <div className="flex-1">
                      <select
                        value={hour12}
                        onChange={(e) => setHour12(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      >
                        {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="font-bold text-slate-400">:</span>

                    {/* Minute Select */}
                    <div className="flex-1">
                      <select
                        value={minute}
                        onChange={(e) => setMinute(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      >
                        {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* AM/PM Toggle */}
                    <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setAmpm("AM")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all ${
                          ampm === "AM"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmpm("PM")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all ${
                          ampm === "PM"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        PM
                      </button>
                    </div>
                  </div>

                  {/* Quick 12-Hour Preset Chips */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {TIME_12H_PRESETS.map((preset) => {
                      const isSelected = hour12 === preset.hour && minute === preset.min && ampm === preset.ampm;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setHour12(preset.hour);
                            setMinute(preset.min);
                            setAmpm(preset.ampm);
                          }}
                          className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Available Seats */}
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Users size={14} className="text-blue-600" />
                      Available Seats
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">{seats} seat{seats > 1 ? "s" : ""}</span>
                  </label>

                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSeats(num)}
                        className={`flex h-10 items-center justify-center rounded-xl text-xs font-extrabold transition-all ${
                          seats === num
                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-600/30 scale-105"
                            : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total Trip Fare */}
                <div>
                  <label className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Wallet size={14} className="text-blue-600" />
                      Total Trip Fare (BDT)
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">0 = Free Ride</span>
                  </label>
                  <p className="mb-2 text-[11px] text-slate-400">
                    Total trip cost to be automatically divided equally among confirmed riders.
                  </p>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-2.5 font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={charge}
                      onChange={(e) => setCharge(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-sm font-bold text-slate-800 shadow-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  {Number(charge) > 0 && Number(seats) > 0 && (
                    <div className="mt-2 rounded-lg bg-blue-50/70 border border-blue-100/80 px-2.5 py-1.5 text-[11px] text-blue-700 flex items-center justify-between">
                      <span>Auto-split: <strong>৳{charge}</strong> total</span>
                      <span>
                        ৳{Math.round((Number(charge) / Number(seats)) * 100) / 100} / person ({seats} riders)
                      </span>
                    </div>
                  )}

                  {/* Fare Preset Chips */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {FARE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setCharge(preset.value)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          Number(charge) === preset.value
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes / Special Instructions */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <FileText size={14} className="text-blue-600" />
                    Ride Notes / Meeting Point (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Waiting near campus gate..."
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              {/* Error Box */}
              {error && (
                <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isFormValid || saving}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      Posting ride...
                    </span>
                  ) : !pickup || !dropoff ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={16} />
                      <span>Select Pickup & Drop-off on Map</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span>Publish Ride</span>
                      <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="rounded-2xl border border-slate-200/70 bg-white p-4 text-slate-600 shadow-xs">
              <div className="flex items-start gap-2.5">
                <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <div className="text-xs leading-relaxed">
                  <strong className="font-bold text-slate-800">Tip:</strong> Setting a clear meeting landmark helps passengers locate you quickly.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


