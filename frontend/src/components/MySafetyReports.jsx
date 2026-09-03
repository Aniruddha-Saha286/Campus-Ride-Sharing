import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ArrowRight,
  Loader2,
  RefreshCw,
  Info,
} from "lucide-react";
import { getMySafetyReports } from "../api/safetyReportApi";
import { onRealtime } from "../api/realtimeBus";

const shortLabel = (str) => {
  if (!str) return "";
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[0] || str;
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function MySafetyReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const loadReports = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getMySafetyReports();
      setReports(res.data?.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load your safety reports."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();

    // Listen for realtime updates from admin or self
    const off = onRealtime((event) => {
      if (
        event?.type === "SAFETY_REPORT_SUBMITTED" ||
        event?.type === "SAFETY_REPORT_STATUS_UPDATED"
      ) {
        loadReports();
      }
    });

    return () => off();
  }, []);

  const filteredReports = reports.filter((r) => {
    if (filter === "all") return true;
    return r.status?.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-2xs">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
              Safety Reports Tracker
            </h1>
            <p className="text-xs text-slate-500">
              Track the progress and review status of safety concerns you reported.
            </p>
          </div>
        </div>

        <button
          onClick={loadReports}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { id: "all", label: "All Reports" },
          { id: "pending", label: "Pending" },
          { id: "resolved", label: "Resolved" },
        ].map((tab) => {
          const active = filter === tab.id;
          const count =
            tab.id === "all"
              ? reports.length
              : reports.filter(
                  (r) => r.status?.toLowerCase() === tab.id.toLowerCase()
                ).length;

          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                active
                  ? "bg-slate-900 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  active
                    ? "bg-slate-700 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-700">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <Loader2 className="animate-spin text-rose-600" size={32} />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
            <ShieldAlert size={26} />
          </div>
          <p className="mt-3 text-sm font-bold text-slate-700">
            No safety reports found
          </p>
          <p className="mt-1 text-xs text-slate-400 max-w-sm">
            {filter === "all"
              ? "You have not submitted any safety concerns yet. If an incident happens during a ride, you can report it from My Rides or Completed Rides."
              : `You do not have any reports with "${filter}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const trip = report.trip;
            const isResolved = report.status === "Resolved";
            const isReviewed = report.status === "Reviewed";
            const isPending = report.status === "Pending";

            return (
              <div
                key={report._id}
                className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-card transition hover:shadow-md space-y-3.5"
              >
                {/* Status & Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700">
                      <AlertTriangle size={13} className="text-rose-600" />
                      {report.category}
                    </span>
                    <span className="text-xs text-slate-400">
                      Reported {formatDate(report.createdAt)}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                      isResolved
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : isReviewed
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isResolved
                          ? "bg-emerald-500"
                          : isReviewed
                          ? "bg-blue-500"
                          : "bg-amber-500 animate-pulse"
                      }`}
                    />
                    Status: {report.status}
                  </span>
                </div>

                {/* Description */}
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Your Statement
                  </p>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    "{report.description}"
                  </p>
                </div>

                {/* Trip Route Details */}
                {trip && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50/60 p-3 text-xs border border-slate-100/70">
                    <div className="flex flex-wrap items-center gap-2 font-bold text-slate-800">
                      <span className="flex items-center gap-1 text-slate-700">
                        <MapPin size={12} className="text-emerald-600" />
                        {shortLabel(trip.pickup)}
                      </span>
                      <ArrowRight size={12} className="text-slate-400" />
                      <span className="flex items-center gap-1 text-slate-700">
                        <MapPin size={12} className="text-rose-600" />
                        {shortLabel(trip.dropoff)}
                      </span>
                      {trip.departureTime && (
                        <span className="flex items-center gap-1 font-semibold text-slate-500 ml-2">
                          <Clock3 size={12} />
                          {trip.departureTime}
                        </span>
                      )}
                    </div>

                    {trip.poster?.name && (
                      <span className="text-[11px] text-slate-500">
                        Driver: <span className="font-bold text-slate-700">{trip.poster.name}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Admin Status Note */}
                <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                  <Info size={13} className="text-blue-500 shrink-0" />
                  <span>
                    {isResolved
                      ? "This complaint has been reviewed and resolved by campus safety administrators."
                      : isReviewed
                      ? "An administrator is currently reviewing this incident."
                      : "Your report has been submitted and is awaiting administrator review."}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
