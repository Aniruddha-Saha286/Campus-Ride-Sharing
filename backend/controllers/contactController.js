const mongoose = require("mongoose");
const Student = require("../models/Student");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const asyncHandler = require("../utils/asyncHandler");
const { findMe } = require("../utils/studentHelper");

const contactSelect = "name phone homeArea emergencyContact";

const getRequestContact = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.requestId)) {
    return res.status(400).json({ success: false, message: "Invalid request id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const booking = await Booking.findById(req.params.requestId);
  if (!booking) return res.status(404).json({ success: false, message: "Ride request not found" });

  const ride = await Ride.findById(booking.ride);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  const isPoster = String(ride.poster) === String(me._id);
  const isRider = String(booking.rider) === String(me._id);
  if (!isPoster && !isRider) {
    return res.status(403).json({ success: false, message: "You are not part of this ride." });
  }

  if (booking.status !== "accepted") {
    return res.status(403).json({
      success: false,
      message: "Contact details are revealed only after a seat request is accepted.",
    });
  }

  const otherId = isPoster ? booking.rider : ride.poster;
  const other = await Student.findById(otherId).select(contactSelect);
  if (!other) return res.status(404).json({ success: false, message: "Student not found" });

  res.json({
    success: true,
    data: {
      name: other.name,
      phone: other.phone,
      homeArea: other.homeArea,
      emergencyContact: other.emergencyContact,
    },
  });
});

const getRideContacts = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  if (String(ride.poster) === String(me._id)) {
    const accepted = await Booking.find({ ride: ride._id, status: "accepted" }).populate("rider", contactSelect);
    return res.json({
      success: true,
      data: accepted.map((b) => ({
        name: b.rider?.name,
        phone: b.rider?.phone,
        homeArea: b.rider?.homeArea,
        emergencyContact: b.rider?.emergencyContact,
      })),
    });
  }

  const myBooking = await Booking.findOne({ ride: ride._id, rider: me._id });
  if (!myBooking) {
    return res.status(403).json({ success: false, message: "You are not part of this ride." });
  }
  if (myBooking.status !== "accepted") {
    return res.status(403).json({
      success: false,
      message: "Contact details are revealed only after a seat request is accepted.",
    });
  }

  const poster = await Student.findById(ride.poster).select(contactSelect);
  res.json({
    success: true,
    data: poster
      ? {
          name: poster.name,
          phone: poster.phone,
          homeArea: poster.homeArea,
          emergencyContact: poster.emergencyContact,
        }
      : null,
  });
});

module.exports = { getRequestContact, getRideContacts };
