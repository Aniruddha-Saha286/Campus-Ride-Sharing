const mongoose = require("mongoose");

const TRIP_STATUSES = ["upcoming", "ongoing", "completed"];

const rideStatusSchema = new mongoose.Schema(
  {
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      unique: true,
    },
    tripStatus: {
      type: String,
      enum: TRIP_STATUSES,
      default: "upcoming",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },
    timeline: [
      {
        status: { type: String, enum: TRIP_STATUSES },
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
      },
    ],
  },
  { timestamps: true }
);

rideStatusSchema.index({ ride: 1 });

const RideStatus = mongoose.model("RideStatus", rideStatusSchema);

module.exports = RideStatus;
module.exports.TRIP_STATUSES = TRIP_STATUSES;
