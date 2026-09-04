const mongoose = require("mongoose");

const FEEDBACK_TYPES = [
  "Complaint",
  "Feedback",
  "Bug Report",
  "General Inquiry",
  "Other",
];

const STATUS_OPTIONS = ["Pending", "Reviewed", "Resolved"];

const userFeedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: FEEDBACK_TYPES,
      default: "Feedback",
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    status: {
      type: String,
      enum: STATUS_OPTIONS,
      default: "Pending",
    },
    adminReply: {
      type: String,
      trim: true,
      default: "",
    },
    repliedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userFeedbackSchema.index({ user: 1, createdAt: -1 });
userFeedbackSchema.index({ status: 1, createdAt: -1 });
userFeedbackSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model("UserFeedback", userFeedbackSchema);
module.exports.FEEDBACK_TYPES = FEEDBACK_TYPES;
module.exports.STATUS_OPTIONS = STATUS_OPTIONS;
