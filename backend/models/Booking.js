const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    seats: { type: Number, default: 1, min: 1, max: 6 },
    status: { type: String, enum: ["pending", "accepted", "declined", "cancelled"], default: "pending" },
    cancelReason: { type: String, default: null, trim: true, maxlength: 300 },
    acceptedAt: { type: Date, default: null },
    paymentStatus: { type: String, enum: ["PENDING", "SETTLED"], default: "PENDING" },
    settledBy: { type: String, enum: ["RIDER", "RIDE_POSTER"], default: null },
    settledByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    settledAt: { type: Date, default: null },
    settledManually: { type: Boolean, default: false },
  },
  { timestamps: true }
);

bookingSchema.index({ ride: 1, rider: 1 }, { unique: true });
bookingSchema.index({ rider: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
