const mongoose = require("mongoose");

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_12H_REGEX = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i;

const commutePreferenceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, unique: true },
    homeArea: { type: String, required: true, trim: true, maxlength: 150 },
    destination: { type: String, required: true, trim: true, maxlength: 150 },
    preferredTime: {
      type: String,
      required: true,
      match: [TIME_12H_REGEX, "Preferred time must be in 12-hour format, e.g. 08:30 AM"],
    },
    recurringDays: { type: [String], default: [], enum: WEEKDAYS },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CommutePreference", commutePreferenceSchema);
module.exports.WEEKDAYS = WEEKDAYS;
module.exports.TIME_12H_REGEX = TIME_12H_REGEX;
