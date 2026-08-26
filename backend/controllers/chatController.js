const mongoose = require("mongoose");
const Message = require("../models/Message");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const Student = require("../models/Student");
const asyncHandler = require("../utils/asyncHandler");
const { findMe } = require("../utils/studentHelper");
const { notifyUser } = require("../utils/notifier");

const SENDER_SELECT = "name profilePhoto universityEmail";

const getRideMessages = asyncHandler(async (req, res) => {
  const { rideId } = req.params;
  if (!mongoose.isValidObjectId(rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride ID" });
  }

  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  const isPoster = String(ride.poster) === String(me._id);
  const myAcceptedBooking = await Booking.findOne({
    ride: ride._id,
    rider: me._id,
    status: "accepted",
  });

  if (!isPoster && !myAcceptedBooking) {
    return res.status(403).json({
      success: false,
      message: "Direct messages are only available after a seat request is accepted.",
    });
  }

  const query = { ride: ride._id };

  if (isPoster) {
    const otherUserId = req.query.otherUserId;
    if (!otherUserId || !mongoose.isValidObjectId(otherUserId)) {
      return res.json({ success: true, data: [], message: "Provide otherUserId query param to load a specific conversation" });
    }
    query.$or = [
      { sender: me._id, recipient: otherUserId },
      { sender: otherUserId, recipient: me._id },
    ];
  } else {
    query.$or = [
      { sender: me._id, recipient: ride.poster },
      { sender: ride.poster, recipient: me._id },
    ];
  }

  const messages = await Message.find(query)
    .populate("sender", SENDER_SELECT)
    .populate("recipient", SENDER_SELECT)
    .sort({ createdAt: 1 });

  // Auto-mark incoming messages as read for this user
  await Message.updateMany({ ride: ride._id, recipient: me._id, read: false }, { $set: { read: true } });

  res.json({
    success: true,
    data: messages,
  });
});

const sendMessage = asyncHandler(async (req, res) => {
  const { rideId } = req.params;
  const { text, recipientId } = req.body || {};

  if (!mongoose.isValidObjectId(rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride ID" });
  }

  if (!text || !String(text).trim()) {
    return res.status(400).json({ success: false, message: "Message text is required" });
  }

  const trimmedText = String(text).trim();
  if (trimmedText.length > 500) {
    return res.status(400).json({ success: false, message: "Message cannot exceed 500 characters" });
  }

  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  const isPoster = String(ride.poster) === String(me._id);
  let targetRecipientId = null;

  if (isPoster) {
    if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
      return res.status(400).json({ success: false, message: "Recipient ID is required for driver messages" });
    }

    const passengerBooking = await Booking.findOne({
      ride: ride._id,
      rider: recipientId,
      status: "accepted",
    });

    if (!passengerBooking) {
      return res.status(403).json({
        success: false,
        message: "You can only message passengers with accepted seat requests.",
      });
    }

    targetRecipientId = recipientId;
  } else {
    const myAcceptedBooking = await Booking.findOne({
      ride: ride._id,
      rider: me._id,
      status: "accepted",
    });

    if (!myAcceptedBooking) {
      return res.status(403).json({
        success: false,
        message: "Direct messages are only available after a seat request is accepted.",
      });
    }

    targetRecipientId = ride.poster;
  }

  const message = await Message.create({
    ride: ride._id,
    sender: me._id,
    recipient: targetRecipientId,
    text: trimmedText,
  });

  const populated = await Message.findById(message._id)
    .populate("sender", SENDER_SELECT)
    .populate("recipient", SENDER_SELECT);

  try {
    notifyUser(targetRecipientId, {
      type: "CHAT_MESSAGE",
      rideId: String(ride._id),
      messageId: String(message._id),
      senderId: String(me._id),
      actorName: me.name || "Student",
      text: trimmedText,
    });
  } catch (err) {
    console.error("notifyUser failed:", err);
  }


  res.status(201).json({
    success: true,
    data: populated,
  });
});

const editMessage = asyncHandler(async (req, res) => {
  const { rideId, messageId } = req.params;
  const { text } = req.body || {};

  if (!mongoose.isValidObjectId(rideId) || !mongoose.isValidObjectId(messageId)) {
    return res.status(400).json({ success: false, message: "Invalid ride or message ID" });
  }

  if (!text || !String(text).trim()) {
    return res.status(400).json({ success: false, message: "Message text is required" });
  }

  const trimmedText = String(text).trim();
  if (trimmedText.length > 500) {
    return res.status(400).json({ success: false, message: "Message cannot exceed 500 characters" });
  }

  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const message = await Message.findOne({ _id: messageId, ride: rideId });
  if (!message) return res.status(404).json({ success: false, message: "Message not found" });

  if (String(message.sender) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "You can only edit your own messages" });
  }

  if (message.isDeleted) {
    return res.status(400).json({ success: false, message: "Cannot edit a deleted message" });
  }

  message.text = trimmedText;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  const populated = await Message.findById(message._id)
    .populate("sender", SENDER_SELECT)
    .populate("recipient", SENDER_SELECT);

  res.json({
    success: true,
    data: populated,
  });
});

const deleteMessage = asyncHandler(async (req, res) => {
  const { rideId, messageId } = req.params;

  if (!mongoose.isValidObjectId(rideId) || !mongoose.isValidObjectId(messageId)) {
    return res.status(400).json({ success: false, message: "Invalid ride or message ID" });
  }

  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const message = await Message.findOne({ _id: messageId, ride: rideId });
  if (!message) return res.status(404).json({ success: false, message: "Message not found" });

  if (String(message.sender) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "You can only delete your own messages" });
  }

  if (message.isDeleted) {
    return res.status(400).json({ success: false, message: "Message is already deleted" });
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.text = "This message was deleted";
  await message.save();

  const populated = await Message.findById(message._id)
    .populate("sender", SENDER_SELECT)
    .populate("recipient", SENDER_SELECT);

  res.json({
    success: true,
    data: populated,
  });
});

module.exports = {
  getRideMessages,
  sendMessage,
  editMessage,
  deleteMessage,
};
