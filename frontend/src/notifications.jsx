import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./auth.js";
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
};

const buildToast = (event) => {
  const meta = TOAST_META[event?.type];
  if (!meta) return null;
  const amount = event.amount ? formatTaka(event.amount) : "";
  const method = methodLabel(event.method);
  let body = "";
  switch (event.type) {
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
    id: `${event.type}-${event.paymentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: meta.title,
    body,
    tone: meta.tone,
    paymentId: event.paymentId,
  };
};

export function NotificationProvider({ children }) {
  const { token } = useContext(AuthContext);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    openRealtime(token);
    const off = onRealtime((event) => {
      const toast = buildToast(event);
      if (!toast) return;
      setToasts((prev) => [...prev.slice(-4), toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 8000);
    });
    return () => {
      off();
      closeRealtime();
    };
  }, [token]);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <NotificationContext.Provider value={{ toasts, dismiss }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
