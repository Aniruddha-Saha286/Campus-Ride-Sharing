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

  const RidePayment = require("../models/RidePayment");
  const clearedSet = new Set((me.clearedNotificationIds || []).map(String));
  const clearedAfter = me.notificationsClearedAt ? new Date(me.notificationsClearedAt) : null;

  // 1. Fetch Chat Message notifications
  const messageQuery = {
    recipient: me._id,
    isDeleted: false,
    clearedForRecipient: { $ne: true },
  };
  if (clearedAfter) {
    messageQuery.createdAt = { $gt: clearedAfter };
  }

  const messages = await Message.find(messageQuery)
    .populate("sender", "name profilePhoto universityEmail")
    .populate("ride", "pickup dropoff departureTime")
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();

  const chatNotifs = messages
    .filter((m) => !clearedSet.has(`CHAT_MESSAGE-${m._id}`) && !clearedSet.has(String(m._id)))
    .map((m) => ({
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

  // 2. Fetch Payment alerts
  let paymentNotifs = [];
  try {
    const paymentQuery = {
      $or: [{ payer: me._id }, { receiver: me._id }],
    };
    if (clearedAfter) {
      paymentQuery.updatedAt = { $gt: clearedAfter };
    }

    const payments = await RidePayment.find(paymentQuery)
      .populate("payer", "name universityEmail")
      .populate("receiver", "name universityEmail")
      .populate("ride", "pickup dropoff")
      .sort({ updatedAt: -1 })
      .limit(15)
      .lean();

    paymentNotifs = payments
      .map((p) => {
        const isPayer = String(p.payer?._id || p.payer) === String(me._id);
        const otherPartyName = isPayer ? p.receiver?.name || "Driver" : p.payer?.name || "Passenger";
        const amountStr = `৳${Number(p.amountPaid || p.originalAmount || 0).toLocaleString("en-US")}`;

        if (p.status === "PAID" || p.finalized) {
          const id = `PAYMENT_CONFIRMED-${p._id}`;
          if (clearedSet.has(id)) return null;
          return {
            id,
            type: "PAYMENT_CONFIRMED",
            title: "Payment Confirmation Alert",
            body: isPayer
              ? `Payment of ${amountStr} confirmed for your ride.`
              : `Payment of ${amountStr} confirmed from ${otherPartyName}.`,
            tone: "success",
            paymentId: p._id,
            rideId: p.ride?._id || p.ride,
            createdAt: p.finalizedAt || p.updatedAt || p.createdAt,
            read: true,
          };
        }
        if (p.status === "REFUND_REQUESTED" || p.status === "REFUNDED") {
          const id = `REFUND_CONFIRMED-${p._id}`;
          if (clearedSet.has(id)) return null;
          return {
            id,
            type: "REFUND_CONFIRMED",
            title: "Payment Refund Alert",
            body: `Payment refund of ${amountStr} processed for your ride.`,
            tone: "success",
            paymentId: p._id,
            rideId: p.ride?._id || p.ride,
            createdAt: p.refundConfirmedAt || p.refundRequestedAt || p.updatedAt || p.createdAt,
            read: true,
          };
        }
        if (p.status === "DUE" || p.status === "OVERDUE") {
          const id = `due-reminder-${p._id}`;
          if (clearedSet.has(id)) return null;
          return {
            id,
            type: "due-reminder",
            title: "Payslip Deadline Alert",
            body: `Ride payment due of ${amountStr} is pending.`,
            tone: "warn",
            paymentId: p._id,
            rideId: p.ride?._id || p.ride,
            createdAt: p.dueDate || p.updatedAt || p.createdAt,
            read: false,
          };
        }
        if (p.status === "PENDING" && p.paymentMethod) {
          const id = `PAYMENT_INITIATED-${p._id}`;
          if (clearedSet.has(id)) return null;
          return {
            id,
            type: "PAYMENT_INITIATED",
            title: "Payment Initiated Alert",
            body: `${otherPartyName} initiated payment of ${amountStr}.`,
            tone: "info",
            paymentId: p._id,
            rideId: p.ride?._id || p.ride,
            createdAt: p.updatedAt || p.createdAt,
            read: false,
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch (err) {
    console.error("Failed to load payment notifications:", err);
  }

  // Combine and sort by createdAt descending
  const combined = [...chatNotifs, ...paymentNotifs].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  res.json({ success: true, data: combined.slice(0, 20) });
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

  if (rawId && mongoose.isValidObjectId(rawId)) {
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

  await Student.updateOne(
    { _id: me._id },
    { $set: { notificationsClearedAt: new Date(), clearedNotificationIds: [] } }
  );

  res.json({ success: true, message: "All notifications cleared" });
});

const deleteNotification = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { id } = req.params;
  const rawId = String(id).replace(/^CHAT_MESSAGE-/, "").replace(/^CHAT-/, "").split("-")[0];

  if (rawId && mongoose.isValidObjectId(rawId)) {
    await Message.updateOne(
      { _id: rawId, recipient: me._id },
      { $set: { read: true, clearedForRecipient: true } }
    );
  }

  await Student.updateOne(
    { _id: me._id },
    { $addToSet: { clearedNotificationIds: id } }
  );

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
