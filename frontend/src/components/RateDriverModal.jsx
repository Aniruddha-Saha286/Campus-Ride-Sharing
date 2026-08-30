import React, { useState } from "react";
import { Star, X, Check, Loader2, MapPin, Navigation, Sparkles } from "lucide-react";
import { submitRating } from "../api/ratingApi";

export default function RateDriverModal({ isOpen, onClose, ride, onRated }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !ride) return null;

  const driver = ride.poster;
  const initial = (driver?.name || "?").charAt(0).toUpperCase();

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (rating < 1 || rating > 5) {
      setError("Please select a rating between 1 and 5 stars");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await submitRating(ride._id, rating, comment);
      if (onRated) onRated(rating);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const labels = ["Poor", "Fair", "Good", "Very Good", "Excellent!"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-brand-600 to-indigo-700 p-6 text-white text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition cursor-pointer"
            title="Skip rating (don't ask again)"
          >
            <X size={18} />
          </button>

          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-white/20 text-xl font-bold shadow-md">
            {driver?.profilePhoto ? (
              <img src={driver.profilePhoto} alt={driver.name} className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>

          <h3 className="text-lg font-bold">Rate your driver</h3>
          <p className="text-xs text-white/80 mt-0.5">{driver?.name || "Driver"}</p>

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white/90">
            <span className="truncate max-w-[120px]">{ride.pickup}</span>
            <Navigation size={10} className="shrink-0 text-white/60" />
            <span className="truncate max-w-[120px]">{ride.dropoff}</span>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-600 border border-rose-100">
              {error}
            </div>
          )}

          <div className="text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              How was your ride experience?
            </p>

            {/* Stars */}
            <div className="flex items-center justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = hoverRating ? star <= hoverRating : star <= rating;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      size={32}
                      className={`${
                        active
                          ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                          : "text-slate-200 fill-slate-50"
                      } transition-colors duration-150`}
                    />
                  </button>
                );
              })}
            </div>

            <p className="text-xs font-bold text-brand-600 mt-1 h-4">
              {labels[(hoverRating || rating) - 1]}
            </p>
          </div>

          {/* Feedback comment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Feedback (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Was the car clean? On time? Safe driving?"
              rows={2}
              maxLength={500}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              title="Dismiss rating popup for this ride"
            >
              Skip / Maybe later
            </button>
            <button
              type="submit"
              disabled={submitting || rating < 1}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Check size={14} />
              )}
              Confirm Rating
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
