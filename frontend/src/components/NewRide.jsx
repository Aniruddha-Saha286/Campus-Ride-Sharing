import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Navigation, Route, Loader2, ArrowLeft } from "lucide-react";
import MapPicker from "./MapPicker.jsx";
import { createRide } from "../api/rideApi";

const formatCoords = (pos) => (pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : "Not set");

const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

const distanceKm = (a, b) => {
  if (!a || !b) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 100) / 100;
};

export default function NewRide() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [departureTime, setDepartureTime] = useState("08:00");
  const [seats, setSeats] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fallbackDistance = distanceKm(pickup, dropoff);

  const resolvePos = async (lat, lng) => {
    const label = await reverseGeocode(lat, lng);
    return { lat, lng, label };
  };

  const displayDistance = () => {
    if (!pickup || !dropoff) return "—";
    if (routeInfo && routeInfo.distance) {
      return `${routeInfo.distance} km (${routeInfo.duration} min drive)`;
    }
    return fallbackDistance !== null ? `${fallbackDistance} km (approx)` : "—";
  };

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
        departureTime,
        seats,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Could not post your ride.");
      setSaving(false);
    }
  };

  const pointCard = (label, Icon, pos) => (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-card">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate font-mono text-sm font-bold text-slate-800">{formatCoords(pos)}</p>
      </div>
    </div>
  );

  const statCard = (label, Icon, value) => (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-card">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Plan a ride</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tap the map to set a pickup and drop-off point, then request the ride.
        </p>

        <div className="mt-6 space-y-4">
          <MapPicker
            pickup={pickup}
            dropoff={dropoff}
            onPickupChange={async (pos) => {
              setError("");
              if (!pos) { setPickup(null); return; }
              setPickup(await resolvePos(pos.lat, pos.lng));
            }}
            onDropoffChange={async (pos) => {
              setError("");
              if (!pos) { setDropoff(null); return; }
              setDropoff(await resolvePos(pos.lat, pos.lng));
            }}
            onRouteCalculated={(info) => {
              setRouteInfo(info);
            }}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {pointCard("Pickup", MapPin, pickup)}
            {pointCard("Drop-off", Navigation, dropoff)}
            {statCard("Distance", Route, displayDistance())}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="rounded-xl border border-slate-100 bg-white p-4 shadow-card">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Departure time
              </span>
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="rounded-xl border border-slate-100 bg-white p-4 shadow-card">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Seats to offer
              </span>
              <select
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} seat{n === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!pickup || !dropoff || saving}
            className="w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                Posting your ride...
              </span>
            ) : !pickup || !dropoff ? (
              "Set both pickup and drop-off to continue"
            ) : (
              "Post ride"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
