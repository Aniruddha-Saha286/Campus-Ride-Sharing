const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const STREAM_URL = `${API_BASE.replace(/\/api\/?$/, "")}/api/notifications/stream`;

const listeners = new Set();
let source = null;
let token = null;
let closed = false;
let reconnectTimer = null;

const fire = (event) => {
  for (const cb of [...listeners]) cb(event);
};

const connect = () => {
  if (closed || source) return;
  if (!token) return;
  try {
    source = new EventSource(`${STREAM_URL}?token=${encodeURIComponent(token)}`);
  } catch (err) {
    source = null;
    reconnectTimer = setTimeout(connect, 3000);
    return;
  }
  const seenKeys = new Set();
  const handleEvent = (e) => {
    try {
      const data = JSON.parse(e.data);
      const key = `${data.type || ""}_${data.paymentId || ""}_${data.messageId || ""}_${data.rideId || ""}_${data.text || ""}_${data.amount || ""}`;
      if (key !== "_____") {
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        setTimeout(() => seenKeys.delete(key), 2500);
      }
      fire(data);
    } catch (err) {
      /* ignore malformed events */
    }
  };
  source.addEventListener("notification", handleEvent);
  source.addEventListener("payment", handleEvent);
  source.addEventListener("message", handleEvent);
  source.addEventListener("chat", handleEvent);
  source.addEventListener("open", () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });
  source.addEventListener("error", () => {
    source?.close();
    source = null;
    if (!closed) reconnectTimer = setTimeout(connect, 3000);
  });
};

export const openRealtime = (nextToken) => {
  token = nextToken || null;
  if (!token) {
    closeRealtime();
    return;
  }
  closed = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connect();
};

export const closeRealtime = () => {
  closed = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  source?.close();
  source = null;
};

export const onRealtime = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};
