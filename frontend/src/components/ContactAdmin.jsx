import React, { useEffect, useState } from "react";
import {
  Headphones,
  Send,
  Clock3,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Bug,
  HelpCircle,
  ThumbsUp,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { submitUserFeedback, getMyFeedbacks } from "../api/userFeedbackApi";
import { onRealtime } from "../api/realtimeBus";

const TYPE_OPTIONS = [
  {
    id: "Complaint",
    label: "Complaint",
    description: "Report an issue with service or violation of rules",
    icon: AlertCircle,
    color: "text-rose-600 bg-rose-50 border-rose-200",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    id: "Feedback",
    label: "Feedback / Suggestion",
    description: "Share your ideas, feature requests, or appreciation",
    icon: ThumbsUp,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "Bug Report",
    label: "Bug / Technical Issue",
    description: "Report a glitch, error, or unexpected UI problem",
    icon: Bug,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "General Inquiry",
    label: "General Inquiry",
    description: "Ask questions about verification, rules, or account",
    icon: HelpCircle,
    color: "text-sky-600 bg-sky-50 border-sky-200",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
  },
];

const formatDate = (val) =>
  val
    ? new Date(val).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function ContactAdmin() {
  const [activeTab, setActiveTab] = useState("form");
  const [type, setType] = useState("Complaint");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadMyHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const res = await getMyFeedbacks();
      setHistory(res.data?.data || []);
    } catch (err) {
      setHistoryError(err.response?.data?.message || "Could not load your submissions.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadMyHistory();

    const off = onRealtime((event) => {
      if (
        event?.type === "FEEDBACK_SUBMITTED" ||
        event?.type === "FEEDBACK_STATUS_UPDATED"
      ) {
        loadMyHistory();
      }
    });

    return () => off();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError("Please provide a subject.");
      return;
    }
    if (!message.trim() || message.trim().length < 5) {
      setError("Please describe your message (at least 5 characters).");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await submitUserFeedback({
        type,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubmitSuccess(true);
      setSubject("");
      setMessage("");
      loadMyHistory();
      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveTab("history");
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit message to admin.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHistory = history.filter((item) => {
    if (statusFilter === "all") return true;
    return item.status?.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
              <Headphones size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Contact Admin
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Submit user complaints, feedbacks, bug reports, or general inquiries to campus administration.
              </p>
            </div>
          </div>
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "form"
                ? "bg-white text-brand-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Send size={15} />
            New Message
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === "history"
                ? "bg-white text-brand-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquare size={15} />
            My Inquiries
            {history.length > 0 && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === "form" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            Send a Message to Admin
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Choose a message type and describe your issue or suggestion in detail. Admins review and respond directly to your ticket.
          </p>

          {submitSuccess && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm font-semibold text-emerald-800">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              <span>Thank you! Your message has been sent to campus administration. Switching to your inquiries...</span>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm font-semibold text-rose-800">
              <AlertCircle size={18} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Message Type <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = type === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setType(opt.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition cursor-pointer ${
                        isSelected
                          ? "border-brand-600 bg-brand-50/50 shadow-xs ring-2 ring-brand-500/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className={`mt-0.5 rounded-lg p-2 ${opt.color}`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-bold ${isSelected ? "text-brand-900" : "text-slate-800"}`}>
                            {opt.label}
                          </span>
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-brand-600" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="feedback-subject" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Subject <span className="text-rose-500">*</span>
              </label>
              <input
                id="feedback-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary (e.g. Issue with payment confirmation / Suggestion for dark mode)"
                maxLength={150}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="feedback-message" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Message Details <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {message.length} / 3000
                </span>
              </div>
              <textarea
                id="feedback-message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please describe what happened, your thoughts, or questions in detail..."
                maxLength={3000}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-y"
                required
              />
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Message to Admin
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "all", label: "All Submissions" },
                { id: "pending", label: "Pending Review" },
                { id: "reviewed", label: "Reviewed" },
                { id: "resolved", label: "Resolved" },
              ].map((f) => {
                const active = statusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      active
                        ? "bg-slate-800 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={loadMyHistory}
              disabled={historyLoading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw size={13} className={historyLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {historyLoading && history.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-12 text-slate-400">
              <Loader2 size={32} className="animate-spin text-brand-600 mb-2" />
              <p className="text-sm">Loading your inquiries...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <Headphones size={36} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">No inquiries found</h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                {statusFilter === "all"
                  ? "You haven't submitted any complaints or messages to admin yet."
                  : `No messages match the "${statusFilter}" filter.`}
              </p>
              {statusFilter === "all" && (
                <button
                  onClick={() => setActiveTab("form")}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-700 cursor-pointer"
                >
                  <Send size={14} />
                  Send Your First Message
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((item) => {
                const typeConfig =
                  TYPE_OPTIONS.find((t) => t.id === item.type) || TYPE_OPTIONS[0];
                const TypeIcon = typeConfig.icon;

                const isResolved = item.status === "Resolved";
                const isReviewed = item.status === "Reviewed";

                return (
                  <div
                    key={item._id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${typeConfig.badge}`}>
                          <TypeIcon size={13} />
                          {item.type}
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {item.subject}
                        </h3>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isResolved
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isReviewed
                            ? "bg-sky-50 text-sky-700 border border-sky-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {isResolved ? (
                          <CheckCircle2 size={12} />
                        ) : isReviewed ? (
                          <Sparkles size={12} />
                        ) : (
                          <Clock3 size={12} />
                        )}
                        {item.status}
                      </span>
                    </div>

                    <p className="mt-3 text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                      {item.message}
                    </p>

                    <div className="mt-3 text-[11px] text-slate-400">
                      Submitted on: {formatDate(item.createdAt)}
                    </div>

                    {item.adminReply ? (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 mb-1.5">
                          <CheckCircle2 size={15} className="text-emerald-600" />
                          <span>Admin Response:</span>
                          <span className="text-[10px] font-normal text-emerald-700">
                            ({formatDate(item.repliedAt)})
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-emerald-950 whitespace-pre-line">
                          {item.adminReply}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 italic">
                        <Clock3 size={12} />
                        <span>Awaiting administrative response. You will be notified once reviewed.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
