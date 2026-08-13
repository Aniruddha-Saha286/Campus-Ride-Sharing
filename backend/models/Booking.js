const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined", "cancelled"], default: "pending" },
    cancelReason: { type: String, default: null, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

bookingSchema.index({ ride: 1, rider: 1 }, { unique: true });
bookingSchema.index({ rider: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
