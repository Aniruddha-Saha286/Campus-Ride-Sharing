import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Loader2,
  BadgeCheck,
  ArrowRight,
  MapPin,
  Inbox,
  Search,
  ArrowUpDown,
  X,
} from "lucide-react";
import { getPassengerHistory } from "../api/rideHistoryApi";

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

const BOOKING_STATUS = {
  accepted: { label: "Accepted", classes: "bg-emerald-50 text-emerald-700" },
  declined: { label: "Declined", classes: "bg-amber-50 text-amber-700" },
  cancelled: { label: "Cancelled", classes: "bg-rose-50 text-rose-700" },
};

export default function PassengerHistory() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await getPassengerHistory();
        setData(res.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Could not load passenger history.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(() => {
    let accepted = 0;
    let declined = 0;
    let cancelled = 0;
    data.forEach((b) => {
      if (b.status === "accepted") accepted++;
      else if (b.status === "declined") declined++;
      else if (b.status === "cancelled") cancelled++;
    });
    return { all: data.length, accepted, declined, cancelled };
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    let list = data;

    // Filter by status tab
    if (statusTab !== "all") {
      list = list.filter((b) => b.status === statusTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((b) => {
        const pickup = (b.pickup || "").toLowerCase();
        const dropoff = (b.dropoff || "").toLowerCase();
        const driver = (b.driver?.name || "").toLowerCase();
        return pickup.includes(q) || dropoff.includes(q) || driver.includes(q);
      });
    }

    // Sort
    return [...list].sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();

      if (sortBy === "latest") return bDate - aDate;
      if (sortBy === "oldest") return aDate - bDate;
      if (sortBy === "fare_desc") return (b.charge || 0) - (a.charge || 0);
      if (sortBy === "fare_asc") return (a.charge || 0) - (b.charge || 0);
      if (sortBy === "departure_asc") return (a.departureTime || "").localeCompare(b.departureTime || "");
      return 0;
    });
  }, [data, statusTab, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
            <Users size={22} className="text-brand-600" /> Passenger History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Rides where you requested a seat as a passenger.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-card">
            <Inbox size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">No passenger history yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Rides you request as a passenger will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Search & Sort Container */}
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
              {/* Main Search Bar */}
              <div className="relative flex items-center">
                <Search size={18} className="absolute left-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search passenger history by pickup, destination, or driver..."
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
                  {[
                    { key: "all", label: "All Requests", count: counts.all },
                    { key: "accepted", label: "Accepted", count: counts.accepted },
                    { key: "declined", label: "Declined", count: counts.declined },
                    { key: "cancelled", label: "Cancelled", count: counts.cancelled },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusTab(tab.key)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                        statusTab === tab.key
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                          statusTab === tab.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sort:</span>
                  <div className="relative flex items-center">
                    <ArrowUpDown size={13} className="pointer-events-none absolute left-3 text-slate-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      aria-label="Sort passenger history"
                      className="rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-bold text-slate-700 shadow-2xs outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
                    >
                      <option value="latest">Latest Date First</option>
                      <option value="oldest">Oldest Date First</option>
                      <option value="fare_desc">Fare (High to Low)</option>
                      <option value="fare_asc">Fare (Low to High)</option>
                      <option value="departure_asc">Departure Time</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* RESULTS TABLE OR EMPTY SEARCH */}
            {filteredAndSortedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-card">
                <Search size={24} className="text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No matching rides found</p>
                <p className="mt-1 text-xs text-slate-400">
                  {searchQuery ? `No records matched "${searchQuery}".` : "No rides found in this filter."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusTab("all");
                  }}
                  className="mt-3 text-xs font-bold text-brand-600 hover:underline cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Pickup</th>
                        <th className="px-4 py-3 font-semibold">Destination</th>
                        <th className="px-4 py-3 font-semibold">Driver</th>
                        <th className="px-4 py-3 font-semibold">Passenger</th>
                        <th className="px-4 py-3 text-right font-semibold">Fare</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAndSortedData.map((booking) => {
                        const meta = BOOKING_STATUS[booking.status] || BOOKING_STATUS.accepted;
                        return (
                          <tr key={booking._id} className="transition hover:bg-slate-50">
                            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                              {formatDate(booking.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                                <MapPin size={12} className="shrink-0 text-brand-500" />
                                <span className="truncate max-w-[10rem]">{booking.pickup}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                                <ArrowRight size={12} className="shrink-0 text-slate-400" />
                                <span className="truncate max-w-[10rem]">{booking.dropoff}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="flex items-center gap-1 text-xs font-bold text-slate-800">
                                <span className="truncate">{booking.driver?.name || "—"}</span>
                                {booking.driver?.idVerified && (
                                  <BadgeCheck size={12} className="shrink-0 fill-brand-600 text-white" />
                                )}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="flex items-center gap-1 text-xs font-bold text-slate-800">
                                <span className="truncate">{booking.passenger?.name || "—"}</span>
                                {booking.passenger?.idVerified && (
                                  <BadgeCheck size={12} className="shrink-0 fill-brand-600 text-white" />
                                )}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-bold text-slate-800 whitespace-nowrap">
                              {formatTaka(booking.charge)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.classes}`}
                              >
                                {meta.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
