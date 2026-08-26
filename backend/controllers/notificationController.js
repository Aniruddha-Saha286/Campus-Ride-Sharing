const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const Message = require("../models/Message");
const asyncHandler = require("../utils/asyncHandler");
const { findMe } = require("../utils/studentHelper");
const { getBanMessage } = require("../utils/ban");
const { subscribe } = require("../utils/notifier");

const streamEvents = async (req, res) => {
  const token = req.query.token;
  if (!token || !String(token).trim()) {
    return res.status(401).json({ success: false, message: "Not authorized, no token provided" });
  }

  let user;
  try {
    user = jwt.verify(String(token).trim(), process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: "Not authorized, token invalid or expired" });
  }

  if (!user) {
    return res.status(401).json({ success: false, message: "Not authorized, token invalid or expired" });
  }

  const email = user.universityEmail || user.email;
  let student;
  if (email) {
    student = await Student.findOne({ universityEmail: email });
    if (student && student.isBanned) {
      return res.status(403).json({ success: false, message: getBanMessage(student) });
    }
  }

  const idsToSubscribe = [];
  if (user.id) idsToSubscribe.push(user.id);
  if (user._id) idsToSubscribe.push(user._id);
  if (user.userId) idsToSubscribe.push(user.userId);
  if (user.sub) idsToSubscribe.push(user.sub);
  if (email) idsToSubscribe.push(email);
  if (student && student._id) idsToSubscribe.push(student._id);

  if (idsToSubscribe.length === 0) {
    return res.status(401).json({ success: false, message: "Not authorized, token contains no user identification" });
  }

  subscribe(idsToSubscribe, res);
};

const listNotifications = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.json({ success: true, data: [] });

  const messages = await Message.find({
    recipient: me._id,
    isDeleted: false,
    clearedForRecipient: { $ne: true },
  })
    .populate("sender", "name profilePhoto universityEmail")
    .populate("ride", "pickup dropoff departureTime")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const data = messages.map((m) => ({
    id: `CHAT_MESSAGE-${m._id}`,
    type: "CHAT_MESSAGE",
    title: `Message from ${m.sender?.name || "Student"}`,
    body: `${m.sender?.name || "Ride partner"}: "${m.text?.length > 70 ? m.text.slice(0, 67) + '...' : m.text}"`,
    tone: "info",
    rideId: m.ride?._id || m.ride,
    senderId: m.sender?._id || m.sender,
    actorName: m.sender?.name || "Student",
    messageId: m._id,
    createdAt: m.createdAt,
    read: Boolean(m.read),
  }));

  res.json({ success: true, data });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  await Message.updateMany({ recipient: me._id, read: false }, { $set: { read: true } });
  res.json({ success: true, message: "All notifications marked as read" });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { id } = req.params;
  const rawId = String(id).replace(/^CHAT_MESSAGE-/, "").replace(/^CHAT-/, "").split("-")[0];

  if (rawId) {
    await Message.updateOne({ _id: rawId, recipient: me._id }, { $set: { read: true } });
  }

  res.json({ success: true });
});

const clearAllNotifications = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  await Message.updateMany(
    { recipient: me._id },
    { $set: { read: true, clearedForRecipient: true } }
  );

  res.json({ success: true, message: "All notifications cleared" });
});

const deleteNotification = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { id } = req.params;
  const rawId = String(id).replace(/^CHAT_MESSAGE-/, "").replace(/^CHAT-/, "").split("-")[0];

  if (rawId) {
    await Message.updateOne(
      { _id: rawId, recipient: me._id },
      { $set: { read: true, clearedForRecipient: true } }
    );
  }

  res.json({ success: true, message: "Notification deleted" });
});

module.exports = {
  streamEvents,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  clearAllNotifications,
  deleteNotification,
};
