const mongoose = require("mongoose");
const Rating = require("../models/Rating");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const RideStatus = require("../models/RideStatus");
const asyncHandler = require("../utils/asyncHandler");
const { findMe, getDriverRating } = require("../utils/studentHelper");
const { notifyUser } = require("../utils/notifier");

/**
 * Submit a 1-5 star rating and optional review for a driver after ride completion.
 */
const submitRating = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { rideId, rating, comment } = req.body || {};

  if (!mongoose.isValidObjectId(rideId)) {
    return res.status(400).json({ success: false, message: "Valid ride ID is required" });
  }

  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ success: false, message: "Rating must be a whole number between 1 and 5" });
  }

  const ride = await Ride.findById(rideId).populate("poster", "name profilePhoto");
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  if (String(ride.poster._id) === String(me._id)) {
    return res.status(400).json({ success: false, message: "You cannot rate your own ride" });
  }

  // Verify that the user was an accepted passenger on this ride
  const booking = await Booking.findOne({ ride: ride._id, rider: me._id, status: "accepted" });
  if (!booking) {
    return res.status(403).json({ success: false, message: "Only accepted passengers on this ride can rate the driver" });
  }

  // Check if already rated
  const existingRating = await Rating.findOne({ ride: ride._id, passenger: me._id });
  let savedRating;
  if (existingRating) {
    existingRating.rating = numericRating;
    existingRating.comment = comment ? String(comment).trim() : "";
    savedRating = await existingRating.save();
  } else {
    savedRating = await Rating.create({
      ride: ride._id,
      driver: ride.poster._id,
      passenger: me._id,
      rating: numericRating,
      comment: comment ? String(comment).trim() : "",
    });
  }

  const driverRatingSummary = await getDriverRating(ride.poster._id);

  // Notify driver of the rating
  notifyUser(ride.poster._id, {
    type: "RATING_RECEIVED",
    actorName: me.name,
    rating: numericRating,
    comment: comment || "",
    ride: { _id: ride._id, pickup: ride.pickup, dropoff: ride.dropoff },
  });

  res.status(201).json({
    success: true,
    data: {
      rating: savedRating,
      driverSummary: driverRatingSummary,
    },
    message: "Thank you for rating your driver!",
  });
});

/**
 * Get any unrated completed rides for the current passenger to prompt the rating popup.
 */
const getPendingRatingForUser = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  // Find accepted bookings for this passenger
  const bookings = await Booking.find({ rider: me._id, status: "accepted" })
    .populate({
      path: "ride",
      populate: { path: "poster", select: "name department year profilePhoto idVerificationStatus phone" },
    })
    .sort({ updatedAt: -1 });

  const bookingRideIds = bookings.map((b) => b.ride?._id).filter(Boolean);
  const completedTripStatuses = await RideStatus.find({
    ride: { $in: bookingRideIds },
    tripStatus: "completed",
  }).select("ride");
  const completedTripRideIdSet = new Set(completedTripStatuses.map((s) => String(s.ride)));

  const completedRideBookings = bookings.filter(
    (b) => b.ride && (b.ride.status === "completed" || completedTripRideIdSet.has(String(b.ride._id)))
  );

  if (completedRideBookings.length === 0) {
    return res.json({ success: true, data: null });
  }

  // Check which completed rides haven't been rated by this passenger
  const rideIds = completedRideBookings.map((b) => b.ride._id);
  const existingRatings = await Rating.find({
    ride: { $in: rideIds },
    passenger: me._id,
  }).select("ride");

  const ratedRideIdSet = new Set(existingRatings.map((r) => String(r.ride)));
  const unratedBooking = completedRideBookings.find((b) => !ratedRideIdSet.has(String(b.ride._id)));

  if (!unratedBooking) {
    return res.json({ success: true, data: null });
  }

  res.json({
    success: true,
    data: {
      ride: {
        _id: unratedBooking.ride._id,
        pickup: unratedBooking.ride.pickup,
        dropoff: unratedBooking.ride.dropoff,
        departureTime: unratedBooking.ride.departureTime,
        poster: unratedBooking.ride.poster,
      },
      bookingId: unratedBooking._id,
    },
  });
});

/**
 * Get the average rating and count for a specific driver.
 */
const getDriverRatingSummary = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  if (!mongoose.isValidObjectId(driverId)) {
    return res.status(400).json({ success: false, message: "Invalid driver ID" });
  }

  const summary = await getDriverRating(driverId);
  res.json({ success: true, data: summary });
});

module.exports = {
  submitRating,
  getPendingRatingForUser,
  getDriverRatingSummary,
};
