import React, { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  MapPin,
  Navigation,
  Clock3,
  Loader2,
  Search,
  ArrowUpDown,
  CarFront,
  Users,
  Map,
  FileText,
  ChevronDown,
  ChevronUp,
  Star,
  Sparkles,
  Check,
  Wallet,
  BadgeCheck,
} from "lucide-react";
import { getMyRideStatuses } from "../api/rideStatusApi";
import { getPendingRating } from "../api/ratingApi";
import RateDriverModal from "./RateDriverModal.jsx";
import usePolling from "../hooks/usePolling";
import { onRealtime } from "../api/realtimeBus";
import { TRIP_META, TIMELINE_COLORS, formatTime12Hour } from "../utils/rideStatusConstants";

const isCoord = (s) => /^-?\d+\.\d+$/.test(String(s || "").trim());

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

const formatTaka = (value) =>
  `৳${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const DISMISSED_RATINGS_KEY = "dismissed_rating_rides";

const isRatingDismissed = (rideId) => {
  if (!rideId) return false;
  try {
    const raw = localStorage.getItem(DISMISSED_RATINGS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return list.includes(String(rideId));
  } catch {
    return false;
  }
};

const dismissRatingForRide = (rideId) => {
  if (!rideId) return;
  try {
    const raw = localStorage.getItem(DISMISSED_RATINGS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const str = String(rideId);
    if (!list.includes(str)) {
      list.push(str);
      localStorage.setItem(DISMISSED_RATINGS_KEY, JSON.stringify(list));
    }
  } catch {
    /* ignore */
  }
};

export default function CompletedRides() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'driver' | 'passenger'
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [pendingRatingRide, setPendingRatingRide] = useState(null);

  const toggleExpanded = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const load = async () => {
    setError("");
    try {
      const res = await getMyRideStatuses();
      setStatuses(res.data?.data || []);

      // Check if passenger has any unrated completed ride
      try {
        const ratingRes = await getPendingRating();
        if (ratingRes.data?.data?.ride) {
          const r = ratingRes.data.data.ride;
          if (!isRatingDismissed(r._id)) {
            setPendingRatingRide(r);
          }
        }
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not load completed rides.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  useEffect(() => {
    const off = onRealtime((event) => {
      if (
        event?.type === "RIDE_COMPLETED" ||
        event?.type === "RIDE_STATUS_UPDATED" ||
        event?.type === "RATING_RECEIVED"
      ) {
        load();
      }
    });
    return () => off();
  }, []);

  const handleDismissRating = () => {
    if (pendingRatingRide?._id) {
      dismissRatingForRide(pendingRatingRide._id);
    }
    setPendingRatingRide(null);
  };

  const completedEntries = useMemo(() => {
    return (statuses || []).filter((s) => s.ride && s.tripStatus === "completed");
  }, [statuses]);

  const counts = useMemo(() => {
    let driverCount = 0;
    let passengerCount = 0;
    completedEntries.forEach((entry) => {
      if (entry.role === "poster") driverCount++;
      else passengerCount++;
    });
    return {
      all: completedEntries.length,
      driver: driverCount,
      passenger: passengerCount,
    };
  }, [completedEntries]);

  const filteredAndSorted = useMemo(() => {
    let list = completedEntries;

    // Filter by role tab
    if (activeTab === "driver") {
      list = list.filter((e) => e.role === "poster");
    } else if (activeTab === "passenger") {
      list = list.filter((e) => e.role === "rider");
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((e) => {
        const pickup = (e.ride?.pickup || "").toLowerCase();
        const dropoff = (e.ride?.dropoff || "").toLowerCase();
        const driverName = (e.ride?.poster?.name || "").toLowerCase();
        return pickup.includes(q) || dropoff.includes(q) || driverName.includes(q);
      });
    }

    // Sort
    return [...list].sort((a, b) => {
      const aDate = new Date(a.ride?.createdAt || a.updatedAt || 0).getTime();
      const bDate = new Date(b.ride?.createdAt || b.updatedAt || 0).getTime();

      if (sortBy === "latest") return bDate - aDate;
      if (sortBy === "oldest") return aDate - bDate;
      if (sortBy === "fare_desc") return (b.ride?.charge || 0) - (a.ride?.charge || 0);
      if (sortBy === "fare_asc") return (a.ride?.charge || 0) - (b.ride?.charge || 0);
      return 0;
    });
  }, [completedEntries, activeTab, searchQuery, sortBy]);

  const avatar = (student) => {
    if (!student) return null;
    const src = student.profilePhoto || null;
    const initial = (student.name || "?").trim().charAt(0).toUpperCase();
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white shadow-2xs">
        {src ? <img src={src} alt={student.name} className="h-full w-full object-cover" /> : initial}
      </div>
    );
  };

  return (
    <div className="w-full max-w-none px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 size={18} />
              </span>
              Completed Rides
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review all completed trips, audit route timelines, and rate your drivers.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 font-extrabold text-emerald-700">
              <Check size={13} />
              {counts.all} Total Completed
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          {/* Main Search Input */}
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search completed rides by pickup, dropoff, or driver name..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-10 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Filter Tabs & Sort Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Completed ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("driver")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "driver"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <CarFront size={13} />
                As Driver ({counts.driver})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("passenger")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "passenger"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Users size={13} />
                As Passenger ({counts.passenger})
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sort:</span>
              <div className="relative flex items-center">
                <ArrowUpDown size={13} className="pointer-events-none absolute left-3 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-bold text-slate-700 shadow-2xs outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
                >
                  <option value="latest">Latest Completed</option>
                  <option value="oldest">Oldest Completed</option>
                  <option value="fare_desc">Fare (High to Low)</option>
                  <option value="fare_asc">Fare (Low to High)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Content List */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="animate-spin text-emerald-600" size={28} />
          </div>
        ) : completedEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center shadow-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              <CheckCircle2 size={24} />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-700">No completed rides yet</p>
            <p className="mt-1 text-xs text-slate-400">
              When a trip reaches its destination and ends, it will appear here.
            </p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
            <Search size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">No completed rides matched your search</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveTab("all");
              }}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSorted.map((entry) => {
              const isExpanded = !!expanded[entry._id];
              const isDriver = entry.role === "poster";
              const ride = entry.ride;
              if (!ride) return null;

              const driverRating = ride.poster?.rating;

              return (
                <div
                  key={entry._id}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all"
                >
                  <div className="p-5 space-y-4">
                    {/* 1. Header: Role & Driver details */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {avatar(ride.poster)}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 text-sm">{ride.poster?.name}</span>
                            {ride.poster?.idVerified && (
                              <BadgeCheck size={14} className="fill-brand-600 text-white shrink-0" />
                            )}
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60 shadow-2xs">
                              <Star size={10} className="fill-amber-400 text-amber-400" />
                              {driverRating && driverRating.average != null ? `${driverRating.average}` : "New"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {ride.poster?.department || "Student"}{ride.poster?.year ? `, ${ride.poster.year}` : ""} · Completed {formatDate(entry.updatedAt || ride.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isDriver
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                              : "bg-blue-50 text-blue-700 border border-blue-200/60"
                          }`}
                        >
                          {isDriver ? "Driver View" : "Passenger View"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-extrabold text-emerald-700">
                          <Check size={12} />
                          Completed
                        </span>
                      </div>
                    </div>

                    {/* 2. Journey & Route Box */}
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 space-y-3.5">
                      {/* Route line */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200/80 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="truncate max-w-[200px] sm:max-w-xs">{shortLabel(ride.pickup)}</span>
                          </span>
                          <Navigation size={13} className="text-slate-400 shrink-0 mx-0.5" />
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200/80 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs">
                            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0"></span>
                            <span className="truncate max-w-[200px] sm:max-w-xs">{shortLabel(ride.dropoff)}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-xs font-semibold text-slate-600">
                          <span className="flex items-center gap-1 text-slate-700 bg-white border border-slate-200/80 px-2.5 py-1 rounded-lg">
                            <Clock3 size={13} className="text-blue-600" />
                            {formatTime12Hour(ride.departureTime)}
                          </span>
                        </div>
                      </div>

                      {/* Specs Strip */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 pt-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Users size={13} className="text-slate-400" />
                          <span className="font-bold text-slate-700">
                            {ride.seats} Total Seat{ride.seats > 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 flex items-center gap-1">
                            <Wallet size={13} className="text-brand-500" />
                            <span>{ride.charge > 0 ? `${formatTaka(ride.charge)} / seat` : "Free Ride"}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Action Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={mapsUrl(ride)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
                        >
                          <Map size={13} className="text-slate-500" />
                          View in map
                        </a>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(entry._id)}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 shadow-2xs cursor-pointer"
                        >
                          <FileText size={13} className="text-slate-500" />
                          {isExpanded ? "Hide timeline & addresses" : "View timeline & addresses"}
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>

                      {/* Right Action */}
                      {!isDriver && ride.poster && (
                        <button
                          type="button"
                          onClick={() => setPendingRatingRide(ride)}
                          className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-700 shadow-2xs transition hover:bg-amber-100 cursor-pointer"
                        >
                          <Star size={13} className="fill-amber-400 text-amber-400" />
                          Rate Driver
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4. Expandable Timeline Audit Log */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-6 space-y-4 rounded-b-2xl">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl bg-white p-4 border border-slate-100">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Pickup Location
                          </p>
                          <p className="text-xs font-medium text-slate-700 mt-1 leading-relaxed">
                            {ride.pickup}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Dropoff Location
                          </p>
                          <p className="text-xs font-medium text-slate-700 mt-1 leading-relaxed">
                            {ride.dropoff}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                          <Clock3 size={13} /> Live Timestamp Audit Log
                        </p>
                        {(entry.timeline || []).length === 0 ? (
                          <p className="text-xs text-slate-400">No timestamp logs available.</p>
                        ) : (
                          <div className="space-y-2 rounded-xl bg-white p-4 border border-slate-100">
                            {(entry.timeline || []).map((step, i) => {
                              const stepMeta = TRIP_META[step.status] || TRIP_META.upcoming;
                              return (
                                <div key={i} className="flex items-start gap-3 text-xs">
                                  <div
                                    className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
                                      TIMELINE_COLORS[step.status] || "bg-emerald-500"
                                    }`}
                                  />
                                  <div className="flex-1">
                                    <span className="font-bold text-slate-800">{stepMeta.label}</span>
                                    <span className="ml-2 text-slate-400">
                                      {new Date(step.timestamp).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                    {step.updatedBy && (
                                      <span className="ml-2 text-slate-500 italic">
                                        (by {step.updatedBy.name})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pendingRatingRide && (
        <RateDriverModal
          isOpen={!!pendingRatingRide}
          ride={pendingRatingRide}
          onClose={handleDismissRating}
          onRated={handleDismissRating}
        />
      )}
    </div>
  );
}
