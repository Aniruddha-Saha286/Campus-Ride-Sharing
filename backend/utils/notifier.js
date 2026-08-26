const clients = new Map();

const subscribe = (userIds, res) => {
  const ids = (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .map((id) => String(id));

  ids.forEach((id) => {
    if (!clients.has(id)) clients.set(id, new Set());
    clients.get(id).add(res);
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  } else {
    res.writeHead(200);
  }
  res.write(`retry: 3000\n\n`);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(`: ping\n\n`);
  }, 25000);

  res.on("close", () => {
    clearInterval(heartbeat);
    ids.forEach((id) => {
      const set = clients.get(id);
      if (set) {
        set.delete(res);
        if (set.size === 0) clients.delete(id);
      }
    });
  });

  return () => {
    clearInterval(heartbeat);
  };
};

const notifyUser = (userIds, event) => {
  const ids = (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .map((id) => String(id));

  if (ids.length === 0) return;

  const targetResponses = new Set();
  ids.forEach((id) => {
    const set = clients.get(id);
    if (set) {
      set.forEach((res) => {
        if (!res.writableEnded) targetResponses.add(res);
      });
    }
  });

  if (targetResponses.size === 0) return;

  const payload = JSON.stringify(event);
  const body = `id: ${Date.now()}\nevent: notification\ndata: ${payload}\n\n`;

  for (const res of targetResponses) {
    try {
      res.write(body);
    } catch {}
  }
};

module.exports = { subscribe, notifyUser };
