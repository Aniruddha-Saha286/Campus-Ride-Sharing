import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Mail,
  MessageSquare,
  Check,
  Trash2,
  X,
  ChevronRight,
} from "lucide-react";
import { useNotifications } from "../../notifications.jsx";

const formatAlertTime = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
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
    if (markAsRead) markAsRead(n.id);
    setOpen(false);
    if (n.paymentId) {
      navigate(`/ride-payments/${n.paymentId}`);
    } else if (n.type === "CHAT_MESSAGE" || n.rideId) {
      navigate("/my-rides");
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate("/my-rides");
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
          {/* Blue Header matching University Portal */}
          <div className="flex items-center justify-between bg-blue-600 px-5 py-4 text-white">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-white">User Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-white/90 transition hover:bg-white/15"
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
                  className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                  title="Clear all notifications"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2">
                  <Mail size={18} />
                </div>
                <p className="text-xs font-bold text-slate-700">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Payment alerts and message notifications will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`group flex w-full items-start gap-3.5 px-4 py-3 text-left transition cursor-pointer hover:bg-slate-50/80 ${
                      !n.read ? "bg-blue-50/30" : "bg-white"
                    }`}
                  >
                    {/* Icon Container: MessageSquare for chat, Mail for payment alerts */}
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                        n.type === "CHAT_MESSAGE"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600"
                      }`}
                    >
                      {n.type === "CHAT_MESSAGE" ? (
                        <MessageSquare size={15} />
                      ) : (
                        <Mail size={15} />
                      )}
                    </div>

                    {/* Alert Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-bold text-slate-800">
                          {n.title || "Notification Alert"}
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
                            className="rounded-md p-1 text-slate-300 opacity-0 group-hover:opacity-100 transition hover:bg-slate-200 hover:text-rose-500"
                            title="Delete notification"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Precise Timestamp */}
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                        {formatAlertTime(n.createdAt)}
                      </p>

                      {/* Detail text */}
                      {n.body && (
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-1 leading-snug">
                          {n.body}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer View All Link */}
          {notifications.length > 0 && (
            <div
              onClick={handleViewAll}
              className="flex items-center justify-center gap-1 border-t border-slate-100 bg-slate-50/70 py-2.5 text-xs font-bold text-blue-600 transition hover:bg-blue-50/60 hover:text-blue-700 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight size={13} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
