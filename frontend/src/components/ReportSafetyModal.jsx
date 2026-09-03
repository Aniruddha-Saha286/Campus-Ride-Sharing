import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  X,
  Loader2,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Clock3,
  AlertTriangle,
} from "lucide-react";
import { submitSafetyReport } from "../api/safetyReportApi";

const PASSENGER_CATEGORIES = [
  "Unsafe driving",
  "Harassment / inappropriate behavior",
  "Vehicle safety issue",
  "Other",
];

const DRIVER_CATEGORIES = [
  "Harassment",
  "Property damage",
  "Abusive behavior",
  "Other",
];

const shortLabel = (str) => {
  if (!str) return "";
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[0] || str;
};

export default function ReportSafetyModal({
  isOpen,
  ride,
  isDriver = false,
  onClose,
  onSuccess,
}) {
  const navigate = useNavigate();
  const categories = isDriver ? DRIVER_CATEGORIES : PASSENGER_CATEGORIES;
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    setCategory(categories[0]);
  }, [isDriver]);

  if (!isOpen || !ride) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 5) {
      setError("Please provide a description of at least 5 characters.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await submitSafetyReport({
        tripId: ride._id,
        category,
        description: description.trim(),
      });

      setSuccessMsg(
        res.data?.message || "Your safety concern report has been submitted successfully."
      );

      setTimeout(() => {
        if (onSuccess) onSuccess(ride._id);
        if (onClose) onClose();
        navigate("/my-safety-reports");
      }, 1400);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to submit safety report. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Report Safety Concern {isDriver ? "(Driver)" : "(Passenger)"}
              </h3>
              <p className="text-xs text-slate-500">
                Your report will be confidentially reviewed by administrators.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Trip Summary (Human-readable route only, NO raw Trip ID) */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Trip Details
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1 text-slate-700">
                <MapPin size={12} className="text-emerald-600" />
                {shortLabel(ride.pickup)}
              </span>
              <ArrowRight size={12} className="text-slate-400" />
              <span className="flex items-center gap-1 text-slate-700">
                <MapPin size={12} className="text-rose-600" />
                {shortLabel(ride.dropoff)}
              </span>
              {ride.departureTime && (
                <span className="ml-auto flex items-center gap-1 font-semibold text-slate-500">
                  <Clock3 size={12} />
                  {ride.departureTime}
                </span>
              )}
            </div>
            {ride.poster?.name && (
              <p className="text-[11px] text-slate-500">
                Driver: <span className="font-semibold text-slate-700">{ride.poster.name}</span>
              </p>
            )}
          </div>

          {successMsg ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Report Submitted</p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Status: Pending
                </div>
              </div>
              <p className="text-xs text-slate-500 max-w-xs">{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs font-semibold text-rose-700">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Category Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Reason / Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 shadow-2xs outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100 cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Description of the issue
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    isDriver
                      ? "Describe the issue with the passenger or trip (e.g. abusive behavior, property damage)..."
                      : "Describe what happened clearly and factually..."
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  maxLength={1000}
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>Minimum 5 characters</span>
                  <span>{description.length} / 1000</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition disabled:opacity-60 cursor-pointer"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <ShieldAlert size={13} />}
                  Submit Report
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
