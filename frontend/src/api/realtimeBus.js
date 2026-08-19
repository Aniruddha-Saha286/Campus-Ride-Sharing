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
  source.addEventListener("payment", (e) => {
    try {
      fire(JSON.parse(e.data));
    } catch (err) {
      /* ignore malformed events */
    }
  });
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
