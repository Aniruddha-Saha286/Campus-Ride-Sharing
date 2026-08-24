const mongoose = require("mongoose");

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const rideSchema = new mongoose.Schema(
  {
    poster: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    pickup: { type: String, required: true, trim: true, maxlength: 500 },
    dropoff: { type: String, required: true, trim: true, maxlength: 500 },
    pickupLat: { type: Number, default: null },
    pickupLng: { type: Number, default: null },
    dropoffLat: { type: Number, default: null },
    dropoffLng: { type: Number, default: null },
    departureTime: {
      type: String,
      required: true,
      match: [TIME_REGEX, "Departure time must be in HH:MM (24-hour) format"],
    },
    seats: { type: Number, required: true, min: 1, max: 6 },
    charge: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "", trim: true, maxlength: 1000 },
    status: { type: String, enum: ["open", "cancelled"], default: "open" },
    cancellationFine: { type: Number, default: 0, min: 0 },
    recurringRef: { type: mongoose.Schema.Types.ObjectId, ref: "RecurringRide", default: null },
  },
  { timestamps: true }
);

rideSchema.index({ poster: 1 });
rideSchema.index({ status: 1, departureTime: 1 });

module.exports = mongoose.model("Ride", rideSchema);
module.exports.TIME_REGEX = TIME_REGEX;
