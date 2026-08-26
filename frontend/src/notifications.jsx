import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./auth.js";
import { client } from "./api/api";
import { onRealtime, openRealtime, closeRealtime } from "./api/realtimeBus";

const NotificationContext = createContext(null);

const formatTaka = (value) =>
  `৳${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const methodLabel = (method) =>
  method === "BKASH" ? "bKash" : method === "MANUAL" ? "Manual" : "payment";

const TOAST_META = {
  PAYMENT_MADE: { title: "Payment received", tone: "success" },
  PAYMENT_CONFIRMED: { title: "Payment confirmed", tone: "success" },
  PAYMENT_INITIATED: { title: "bKash payment started", tone: "info" },
  METHOD_SELECTED: { title: "Payment method chosen", tone: "info" },
  MANUAL_STATUS_PENDING: { title: "Manual payment pending", tone: "warn" },
  DUE_UPDATED: { title: "Due updated", tone: "warn" },
  REFUND_REQUESTED: { title: "Refund requested", tone: "violet" },
  REFUND_CONFIRMED: { title: "Refund confirmed", tone: "success" },
  "due-reminder": { title: "Payment due today", tone: "warn" },
  CHAT_MESSAGE: { title: "New Message", tone: "info" },
};

const buildToast = (event) => {
  const meta = TOAST_META[event?.type];
  if (!meta) return null;
  const amount = event.amount ? formatTaka(event.amount) : "";
  const method = methodLabel(event.method);
  let body = "";
  switch (event.type) {
    case "CHAT_MESSAGE":
      body = `${event.actorName || "Ride partner"}: "${event.text?.length > 70 ? event.text.slice(0, 67) + "..." : event.text}"`;
      break;
    case "PAYMENT_MADE":
      body = `${event.actorName} paid you ${amount} via ${method}.`;
      break;
    case "PAYMENT_CONFIRMED":
      body = `${event.actorName} confirmed receiving ${amount}.`;
      break;
    case "PAYMENT_INITIATED":
      body = `${event.actorName} started a bKash payment of ${amount}.`;
      break;
    case "METHOD_SELECTED":
      body = `${event.actorName} chose to pay via ${method}.`;
      break;
    case "MANUAL_STATUS_PENDING":
      body = `${event.actorName} kept the manual payment pending.`;
      break;
    case "DUE_UPDATED":
      body = `${event.actorName} set a due of ${amount} for you.`;
      break;
    case "REFUND_REQUESTED":
      body = `${event.actorName} requested a refund of ${amount}. Confirm it to cancel the ride.`;
      break;
    case "REFUND_CONFIRMED":
      body = `${event.actorName} confirmed the refund of ${amount}.`;
      break;
    case "due-reminder":
      body = event.message || "Today is the last day to pay your due. A late fee starts tomorrow.";
      break;
    default:
      return null;
  }
  return {
    id: `${event.type}-${event.paymentId || event.messageId || event.rideId || Date.now()}`,
    title: event.type === "CHAT_MESSAGE" ? `Message from ${event.actorName || "Student"}` : meta.title,
    body,
    tone: meta.tone,
    type: event.type,
    paymentId: event.paymentId,
    rideId: event.rideId,
    senderId: event.senderId,
    actorName: event.actorName,
    createdAt: new Date(),
    read: false,
  };
};

export function NotificationProvider({ children }) {
  const { token } = useContext(AuthContext);
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = async () => {
    const activeToken = token || localStorage.getItem("token");
    if (!activeToken) return;
    try {
      const res = await client.get("/notifications");
      if (res.data?.data) {
        setNotifications(res.data.data);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const activeToken = token || localStorage.getItem("token");
    loadNotifications();
    openRealtime(activeToken);

    const off = onRealtime((event) => {
      loadNotifications();
      const item = buildToast(event);
      if (!item) return;

      // Add to toast banner popup with deduplication (keep at most 2 toasts)
      setToasts((prev) => {
        if (prev.some((t) => t.id === item.id || (t.title === item.title && t.body === item.body))) {
          return prev;
        }
        return [...prev.slice(-1), item];
      });

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 5000);

      // Add to persistent notification bar list
      setNotifications((prev) => {
        const filtered = prev.filter((n) => n.id !== item.id);
        return [item, ...filtered.slice(0, 19)];
      });
    });

    // Fast 3-second live sync matching chat modal speed
    const interval = setInterval(loadNotifications, 3000);

    return () => {
      off();
      clearInterval(interval);
      closeRealtime();
    };
  }, [token]);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await client.put("/notifications/read-all");
    } catch {}
  };

  const markAsRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await client.put(`/notifications/${id}/read`);
    } catch {}
  };

  const clearNotifications = async () => {
    setNotifications([]);
    setToasts([]);
    try {
      await client.delete("/notifications");
    } catch {}
  };

  const deleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setToasts((prev) => prev.filter((t) => t.id !== id));
    try {
      await client.delete(`/notifications/${id}`);
    } catch {}
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        dismiss,
        notifications,
        unreadCount,
        markAllAsRead,
        markAsRead,
        clearNotifications,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
