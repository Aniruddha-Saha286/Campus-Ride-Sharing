const mongoose = require("mongoose");

const PASSENGER_CATEGORIES = [
  "Unsafe driving",
  "Harassment / inappropriate behavior",
  "Vehicle safety issue",
  "Other",
];

const DRIVER_CATEGORIES = [
  "Harassment",
  "Property damage",
  "Abusive behavior",
  "Other",
];

const ALL_CATEGORIES = Array.from(
  new Set([...PASSENGER_CATEGORIES, ...DRIVER_CATEGORIES])
);

const STATUS_OPTIONS = ["Pending", "Reviewed", "Resolved"];

const safetyReportSchema = new mongoose.Schema(
  {
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ALL_CATEGORIES,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: STATUS_OPTIONS,
      default: "Pending",
    },
  },
  { timestamps: true }
);

safetyReportSchema.index({ trip: 1 });
safetyReportSchema.index({ status: 1 });
safetyReportSchema.index({ reporter: 1 });

module.exports = mongoose.model("SafetyReport", safetyReportSchema);
module.exports.PASSENGER_CATEGORIES = PASSENGER_CATEGORIES;
module.exports.DRIVER_CATEGORIES = DRIVER_CATEGORIES;
module.exports.ALL_CATEGORIES = ALL_CATEGORIES;
module.exports.STATUS_OPTIONS = STATUS_OPTIONS;
