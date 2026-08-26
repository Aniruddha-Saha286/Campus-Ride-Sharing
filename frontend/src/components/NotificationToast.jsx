import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Info, AlertTriangle, RefreshCcw, MessageSquare, X } from "lucide-react";
import { useNotifications } from "../notifications.jsx";

const TONE_CLASSES = {
  success: { box: "border-emerald-200 bg-emerald-50", icon: "text-emerald-600" },
  info: { box: "border-blue-200 bg-blue-50", icon: "text-blue-600" },
  warn: { box: "border-amber-200 bg-amber-50", icon: "text-amber-600" },
  violet: { box: "border-violet-200 bg-violet-50", icon: "text-violet-600" },
};

const TONE_ICONS = {
  success: CheckCircle2,
  info: Info,
  warn: AlertTriangle,
  violet: RefreshCcw,
};

export default function NotificationToast() {
  const { toasts, dismiss } = useNotifications() || {};
  const navigate = useNavigate();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const tone = TONE_CLASSES[toast.tone] || TONE_CLASSES.info;
        const Icon = toast.type === "CHAT_MESSAGE" ? MessageSquare : (TONE_ICONS[toast.tone] || Info);
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-card ${tone.box}`}
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${tone.icon}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{toast.title}</p>
              <p className="mt-0.5 text-xs text-slate-600">{toast.body}</p>
              {toast.paymentId && (
                <button
                  onClick={() => {
                    navigate(`/ride-payments/${toast.paymentId}`);
                    dismiss(toast.id);
                  }}
                  className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
                >
                  View payment
                </button>
              )}
              {toast.type === "CHAT_MESSAGE" && (
                <button
                  onClick={() => {
                    navigate("/my-rides");
                    dismiss(toast.id);
                  }}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                >
                  <MessageSquare size={12} />
                  Open My Rides
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
