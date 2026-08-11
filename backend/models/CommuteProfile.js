const mongoose = require("mongoose");

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const commuteProfileSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, unique: true },
    destination: { type: String, required: true, trim: true, maxlength: 150 },
    departureTime: {
      type: String,
      required: true,
      match: [TIME_REGEX, "Departure time must be in HH:MM (24-hour) format"],
    },
    days: { type: [String], default: [], enum: WEEKDAYS },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CommuteProfile", commuteProfileSchema);
module.exports.WEEKDAYS = WEEKDAYS;
