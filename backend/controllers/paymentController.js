const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const asyncHandler = require("../utils/asyncHandler");
const { findMe } = require("../utils/studentHelper");

const settlePayment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId) || !mongoose.isValidObjectId(req.params.requestId)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  const booking = await Booking.findOne({ _id: req.params.requestId, ride: ride._id });
  if (!booking) return res.status(404).json({ success: false, message: "Ride request not found" });

  const isPoster = String(ride.poster) === String(me._id);
  const isRider = String(booking.rider) === String(me._id);
  if (!isPoster && !isRider) {
    return res.status(403).json({ success: false, message: "Only the ride poster or the accepted rider can settle the payment" });
  }

  if (booking.status !== "accepted") {
    return res.status(400).json({ success: false, message: "Only an accepted request can be settled" });
  }

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "accepted", paymentStatus: "PENDING" },
    {
      $set: {
        paymentStatus: "SETTLED",
        settledBy: isPoster ? "RIDE_POSTER" : "RIDER",
        settledByUserId: me._id,
        settledAt: new Date(),
        settledManually: true,
      },
    },
    { new: true }
  );
  if (!updated) {
    return res.status(400).json({ success: false, message: "This payment is already settled" });
  }
  res.json({ success: true, data: updated });
});

module.exports = { settlePayment };
