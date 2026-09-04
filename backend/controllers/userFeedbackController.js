const mongoose = require("mongoose");
const UserFeedback = require("../models/UserFeedback");
const { FEEDBACK_TYPES, STATUS_OPTIONS } = require("../models/UserFeedback");
const Student = require("../models/Student");
const asyncHandler = require("../utils/asyncHandler");
const { findMe } = require("../utils/studentHelper");
const { notifyUser } = require("../utils/notifier");

const submitFeedback = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) {
    return res.status(404).json({ success: false, message: "Student profile not found" });
  }

  const { type, subject, message } = req.body || {};

  if (!type || !FEEDBACK_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Invalid message type. Allowed types: ${FEEDBACK_TYPES.join(", ")}`,
    });
  }

  if (!subject || !subject.trim()) {
    return res.status(400).json({
      success: false,
      message: "Please provide a subject for your message",
    });
  }

  if (!message || !message.trim() || message.trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: "Please provide a message details (at least 5 characters)",
    });
  }

  const feedback = await UserFeedback.create({
    user: me._id,
    type,
    subject: subject.trim(),
    message: message.trim(),
    status: "Pending",
  });

  try {
    notifyUser([me.universityEmail, String(me._id)], {
      type: "FEEDBACK_SUBMITTED",
      message: "Your message has been sent to campus administration.",
      feedbackId: feedback._id,
      status: "Pending",
    });
  } catch (notifyErr) {
    console.error("Notification dispatch error:", notifyErr.message);
  }

  res.status(201).json({
    success: true,
    message: "Message submitted successfully to admin",
    data: feedback,
  });
});

const getMyFeedbacks = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) {
    return res.status(404).json({ success: false, message: "Student profile not found" });
  }

  const list = await UserFeedback.find({ user: me._id })
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: list,
  });
});

const getAdminFeedbacks = asyncHandler(async (req, res) => {
  const { status, type, search } = req.query || {};

  const query = {};

  if (status && status !== "all") {
    if (status === "needs_action" || status === "pending") {
      query.status = "Pending";
    } else if (status === "reviewed") {
      query.status = "Reviewed";
    } else if (status === "resolved") {
      query.status = "Resolved";
    } else if (STATUS_OPTIONS.includes(status)) {
      query.status = status;
    }
  }

  if (type && type !== "all" && FEEDBACK_TYPES.includes(type)) {
    query.type = type;
  }

  let list = await UserFeedback.find(query)
    .populate("user", "name studentId universityEmail phone department year profilePhoto")
    .sort({ createdAt: -1 })
    .lean();

  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    list = list.filter((item) => {
      const studentName = (item.user?.name || "").toLowerCase();
      const studentId = (item.user?.studentId || "").toLowerCase();
      const studentEmail = (item.user?.universityEmail || "").toLowerCase();
      const subject = (item.subject || "").toLowerCase();
      const msg = (item.message || "").toLowerCase();

      return (
        studentName.includes(term) ||
        studentId.includes(term) ||
        studentEmail.includes(term) ||
        subject.includes(term) ||
        msg.includes(term)
      );
    });
  }

  res.json({
    success: true,
    data: list,
  });
});

const updateAdminFeedback = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid feedback ID" });
  }

  const { status, adminReply } = req.body || {};

  const feedback = await UserFeedback.findById(id).populate("user", "name universityEmail");
  if (!feedback) {
    return res.status(404).json({ success: false, message: "Feedback not found" });
  }

  if (status) {
    if (!STATUS_OPTIONS.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${STATUS_OPTIONS.join(", ")}`,
      });
    }
    feedback.status = status;
  }

  if (adminReply !== undefined) {
    feedback.adminReply = adminReply.trim();
    if (adminReply.trim()) {
      feedback.repliedAt = new Date();
      if (!status) {
        feedback.status = "Reviewed";
      }
    }
  }

  await feedback.save();

  try {
    const student = await Student.findById(feedback.user?._id || feedback.user);
    const targetSet = new Set();
    if (student?._id) targetSet.add(String(student._id));
    if (student?.universityEmail) {
      targetSet.add(student.universityEmail);
      targetSet.add(student.universityEmail.toLowerCase());
    }
    if (feedback.user?.universityEmail) {
      targetSet.add(feedback.user.universityEmail);
      targetSet.add(feedback.user.universityEmail.toLowerCase());
    }
    if (feedback.user?._id) targetSet.add(String(feedback.user._id));
    if (feedback.user) targetSet.add(String(feedback.user));

    const targets = Array.from(targetSet).filter(Boolean);
    if (targets.length > 0) {
      notifyUser(targets, {
        type: "FEEDBACK_STATUS_UPDATED",
        message: adminReply && adminReply.trim()
          ? `Admin replied to your ${feedback.type}: "${feedback.subject}"`
          : `Your ${feedback.type} status was updated to ${feedback.status}`,
        feedbackId: feedback._id,
        status: feedback.status,
        adminReply: feedback.adminReply,
      });
    }
  } catch (notifyErr) {
    console.error("Notification dispatch error:", notifyErr.message);
  }

  res.json({
    success: true,
    message: "Feedback updated successfully",
    data: feedback,
  });
});

const deleteAdminFeedback = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid feedback ID" });
  }

  const feedback = await UserFeedback.findByIdAndDelete(id);
  if (!feedback) {
    return res.status(404).json({ success: false, message: "Feedback not found" });
  }

  res.json({
    success: true,
    message: "Feedback deleted successfully",
    data: { _id: id },
  });
});

module.exports = {
  submitFeedback,
  getMyFeedbacks,
  getAdminFeedbacks,
  updateAdminFeedback,
  deleteAdminFeedback,
};

