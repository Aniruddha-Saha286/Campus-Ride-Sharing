import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCcw,
  Check,
  Trash2,
  ExternalLink,
  X,
} from "lucide-react";
import { useNotifications } from "../../notifications.jsx";

const NOTIF_ICONS = {
  CHAT_MESSAGE: MessageSquare,
  PAYMENT_MADE: CheckCircle2,
  PAYMENT_CONFIRMED: CheckCircle2,
  PAYMENT_INITIATED: Info,
  METHOD_SELECTED: Info,
  MANUAL_STATUS_PENDING: AlertTriangle,
  DUE_UPDATED: AlertTriangle,
  REFUND_REQUESTED: RefreshCcw,
  REFUND_CONFIRMED: CheckCircle2,
  "due-reminder": AlertTriangle,
};

export default function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const {
    notifications = [],
    unreadCount = 0,
    markAllAsRead,
    markAsRead,
    clearNotifications,
    deleteNotification,
  } = useNotifications() || {};

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleItemClick = (n) => {
    markAsRead(n.id);
    setOpen(false);
    if (n.paymentId) {
      navigate(`/ride-payments/${n.paymentId}`);
    } else if (n.type === "CHAT_MESSAGE" || n.rideId) {
      navigate("/my-rides");
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-xs transition hover:border-blue-300 hover:bg-slate-50 focus:outline-none"
        title="Notifications"
      >
        <Bell size={18} className="text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white shadow-xs animate-in zoom-in-50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200"
                  title="Mark all as read"
                >
                  <Check size={12} />
                  Mark read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-rose-600"
                  title="Clear all notifications"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2">
                  <Bell size={18} />
                </div>
                <p className="text-xs font-bold text-slate-700">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  When someone messages you or sends a payment update, it will show here.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = NOTIF_ICONS[n.type] || Bell;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition cursor-pointer hover:bg-slate-50 ${
                      !n.read ? "bg-blue-50/40" : "bg-white"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        n.type === "CHAT_MESSAGE"
                          ? "bg-blue-100 text-blue-600"
                          : n.tone === "success"
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-amber-100 text-amber-600"
                      }`}
                    >
                      <Icon size={14} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-bold text-slate-800">
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!n.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (deleteNotification) deleteNotification(n.id);
                            }}
                            className="rounded-md p-1 text-slate-300 transition hover:bg-slate-200 hover:text-rose-500"
                            title="Delete notification"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
                        Click to view
                        <ExternalLink size={10} />
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
