import React, { useState, useEffect } from "react";
import {
  Users,
  Loader2,
  BadgeCheck,
  ArrowRight,
  MapPin,
  Inbox,
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

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
            <Users size={22} className="text-brand-600" /> Passenger History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Rides where you requested a seat as a passenger.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
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
                  {data.map((booking) => {
                    const meta = BOOKING_STATUS[booking.status] || BOOKING_STATUS.accepted;
                    return (
                      <tr key={booking._id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs text-slate-500">
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
                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-800">
                          {formatTaka(booking.charge)}
                        </td>
                        <td className="px-4 py-3">
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
      </div>
    </div>
  );
}
