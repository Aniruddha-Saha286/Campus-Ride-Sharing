const mongoose = require("mongoose");

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const recurringSkipSchema = new mongoose.Schema(
  {
    recurring: { type: mongoose.Schema.Types.ObjectId, ref: "RecurringRide", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    date: {
      type: String,
      required: true,
      match: [DATE_REGEX, "Date must be in YYYY-MM-DD format"],
    },
  },
  { timestamps: true }
);

recurringSkipSchema.index({ recurring: 1, date: 1 }, { unique: true });
recurringSkipSchema.index({ student: 1 });

module.exports = mongoose.model("RecurringSkip", recurringSkipSchema);
module.exports.DATE_REGEX = DATE_REGEX;
