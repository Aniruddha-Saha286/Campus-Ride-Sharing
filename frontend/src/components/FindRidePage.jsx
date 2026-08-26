import React, { useState } from "react";
import {
  MapPin,
  Navigation,
  Clock3,
  Users,
  Loader2,
  Search,
  Map,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
  Wallet,
  FileText,
} from "lucide-react";
import { listRides, requestSeat } from "../api/rideApi";
import usePolling from "../hooks/usePolling";
import { formatTime12Hour } from "../utils/rideStatusConstants";

const formatTaka = (v) =>
  `৳${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

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

function RideCard({ ride, onRequest, busy }) {
  const [expanded, setExpanded] = useState(false);
  const [seats, setSeats] = useState(1);

  const initial = (ride.poster?.name || "?").charAt(0).toUpperCase();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card transition-shadow hover:shadow-md">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                <MapPin size={11} className="shrink-0" />
                {shortLabel(ride.pickup)}
              </span>
              <Navigation size={13} className="shrink-0 text-slate-300" />
              <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                <MapPin size={11} className="shrink-0" />
                {shortLabel(ride.dropoff)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock3 size={13} className="text-brand-400" />
                <span className="font-semibold text-slate-700">{formatTime12Hour(ride.departureTime)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Users size={13} className="text-brand-400" />
                <span className="font-semibold text-slate-700">{ride.seatsLeft}</span> seat{ride.seatsLeft === 1 ? "" : "s"} left
              </span>
              {ride.charge > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Wallet size={13} className="text-brand-400" />
                  <span className="font-semibold text-slate-700">{formatTaka(ride.charge)}</span> / seat
                </span>
              )}
              {ride.charge === 0 && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  Free
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white">
                {ride.poster?.profilePhoto
                  ? <img src={ride.poster.profilePhoto} alt={ride.poster.name} className="h-full w-full object-cover" />
                  : initial}
              </div>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{ride.poster?.name}</span>
                {ride.poster?.idVerified && (
                  <BadgeCheck size={13} className="fill-brand-600 text-white" />
                )}
                <span className="text-slate-300">·</span>
                {ride.poster?.department}, {ride.poster?.year}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {ride.seatsLeft > 1 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5">
                <span className="text-[11px] font-semibold text-slate-400">Seats</span>
                <select
                  value={seats}
                  onChange={(e) => setSeats(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none"
                >
                  {Array.from({ length: ride.seatsLeft }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => onRequest(ride._id, seats)}
              disabled={busy === ride._id}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {busy === ride._id ? <Loader2 className="animate-spin" size={13} /> : <Users size={13} />}
              Request seat
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-slate-50 pt-3">
          <a
            href={mapsUrl(ride)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            <Map size={13} />
            View in map
          </a>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <FileText size={13} />
            {expanded ? "Hide details" : "Show details"}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Pickup</p>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">{ride.pickup}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Dropoff</p>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">{ride.dropoff}</p>
            </div>
          </div>

          {ride.notes && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Driver note</p>
              <p className="text-sm text-slate-600 italic">"{ride.notes}"</p>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Total seats</p>
              <p className="text-sm font-semibold text-slate-700">{ride.seats}</p>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Seats left</p>
              <p className="text-sm font-semibold text-slate-700">{ride.seatsLeft}</p>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Fare / seat</p>
              <p className="text-sm font-semibold text-slate-700">
                {ride.charge > 0 ? formatTaka(ride.charge) : "Free"}
              </p>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Departure</p>
              <p className="text-sm font-semibold text-slate-700">{formatTime12Hour(ride.departureTime)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const QUICK_FILTERS = [
  { id: "all", label: "All Rides" },
  { id: "free", label: "Free Rides" },
  { id: "badda", label: "Merul Badda", query: "Badda" },
  { id: "mohakhali", label: "Mohakhali", query: "Mohakhali" },
  { id: "dhanmondi", label: "Dhanmondi", query: "Dhanmondi" },
  { id: "mirpur", label: "Mirpur", query: "Mirpur" },
  { id: "uttara", label: "Uttara", query: "Uttara" },
  { id: "gulshan", label: "Gulshan", query: "Gulshan" },
];

export default function FindRidePage() {
  const [browse, setBrowse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await listRides();
      setBrowse(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load rides.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  const handleRequest = async (rideId, seats) => {
    setBusy(rideId);
    setError("");
    setSuccess("");
    try {
      await requestSeat(rideId, seats);
      setSuccess("Seat request sent! The driver will review your request.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not request a seat.");
    } finally {
      setBusy("");
    }
  };

  // Filtered rides calculation
  const filteredRides = browse.filter((ride) => {
    const q = searchTerm.trim().toLowerCase();
    
    // Quick filter check
    if (activeFilter === "free" && ride.charge > 0) return false;
    if (activeFilter !== "all" && activeFilter !== "free") {
      const filterObj = QUICK_FILTERS.find((f) => f.id === activeFilter);
      if (filterObj && filterObj.query) {
        const queryTerm = filterObj.query.toLowerCase();
        const matchesPickup = (ride.pickup || "").toLowerCase().includes(queryTerm);
        const matchesDropoff = (ride.dropoff || "").toLowerCase().includes(queryTerm);
        if (!matchesPickup && !matchesDropoff) return false;
      }
    }

    // Search query check
    if (!q) return true;

    const matchesPickup = (ride.pickup || "").toLowerCase().includes(q);
    const matchesDropoff = (ride.dropoff || "").toLowerCase().includes(q);
    const matchesDriver = (ride.poster?.name || "").toLowerCase().includes(q);
    const matchesDept = (ride.poster?.department || "").toLowerCase().includes(q);
    const matchesNotes = (ride.notes || "").toLowerCase().includes(q);

    return matchesPickup || matchesDropoff || matchesDriver || matchesDept || matchesNotes;
  });

  return (
    <div className="w-full max-w-none px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px]">
        {/* Top Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Find Ride</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse available rides shared by verified students. Search by pickup, destination, or driver.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 border border-rose-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 border border-emerald-100">
            {success}
          </div>
        )}

        {/* Search Bar & Quick Filters */}
        <div className="mb-6 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          {/* Main Search Input */}
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by pickup, destination, or driver name..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-10 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
              Filter:
            </span>
            {QUICK_FILTERS.map((f) => {
              const isSelected = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ride List */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={26} />
          </div>
        ) : browse.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center shadow-card">
            <Search size={30} className="text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">No open rides right now</p>
            <p className="mt-1 text-xs text-slate-400">Check back soon, or post your own ride from the sidebar.</p>
          </div>
        ) : filteredRides.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
            <Search size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">No rides matched your search</p>
            <p className="mt-1 text-xs text-slate-500">
              Try searching with different keywords or clear your active filters.
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setActiveFilter("all");
              }}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Showing {filteredRides.length} of {browse.length} available ride{browse.length === 1 ? "" : "s"}
              </p>
              {(searchTerm || activeFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setActiveFilter("all");
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </div>

            {filteredRides.map((ride) => (
              <RideCard
                key={ride._id}
                ride={ride}
                onRequest={handleRequest}
                busy={busy}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
