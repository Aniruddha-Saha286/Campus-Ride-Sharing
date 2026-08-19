const clients = new Map();

const subscribe = (userId, res) => {
  const id = String(userId);
  if (!clients.has(id)) clients.set(id, new Set());
  const set = clients.get(id);
  set.add(res);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 3000\n\n`);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(`: ping\n\n`);
  }, 25000);

  res.on("close", () => {
    clearInterval(heartbeat);
    set.delete(res);
    if (set.size === 0) clients.delete(id);
  });

  return () => {
    clearInterval(heartbeat);
  };
};

const notifyUser = (userId, event) => {
  const set = clients.get(String(userId));
  if (!set || set.size === 0) return;
  const body = `id: ${Date.now()}\nevent: payment\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    if (!res.writableEnded) res.write(body);
  }
};

module.exports = { subscribe, notifyUser };
