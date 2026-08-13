const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const asyncHandler = require("../utils/asyncHandler");
const { findMe, publicPosterSelect, formatPublicStudent } = require("../utils/studentHelper");

const { TIME_REGEX } = Ride;

const createRide = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { pickup, dropoff, departureTime, seats, notes, pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body || {};

  if (!pickup || !String(pickup).trim()) {
    return res.status(400).json({ success: false, message: "Pickup location is required" });
  }
  if (!dropoff || !String(dropoff).trim()) {
    return res.status(400).json({ success: false, message: "Drop-off location is required" });
  }
  if (!departureTime || !TIME_REGEX.test(departureTime)) {
    return res.status(400).json({ success: false, message: "Departure time must be in HH:MM (24-hour) format" });
  }
  const seatCount = Number(seats);
  if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 6) {
    return res.status(400).json({ success: false, message: "Seats must be a whole number between 1 and 6" });
  }

  const ride = await Ride.create({
    poster: me._id,
    pickup: String(pickup).trim(),
    dropoff: String(dropoff).trim(),
    departureTime,
    seats: seatCount,
    notes: notes ? String(notes).trim() : "",
    pickupLat: pickupLat ?? null,
    pickupLng: pickupLng ?? null,
    dropoffLat: dropoffLat ?? null,
    dropoffLng: dropoffLng ?? null,
  });

  res.status(201).json({ success: true, data: ride });
});

const listRides = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const rides = await Ride.find({ status: "open" })
    .populate("poster", publicPosterSelect)
    .sort({ departureTime: 1, createdAt: -1 });

  const counts = await Booking.aggregate([
    { $match: { ride: { $in: rides.map((r) => r._id) }, status: "accepted" } },
    { $group: { _id: "$ride", count: { $sum: 1 } } },
  ]);
  const bookedByRide = new Map(counts.map((c) => [String(c._id), c.count]));

  const data = rides
    .filter((r) => r.poster && String(r.poster._id) !== String(me._id))
    .map((r) => {
      const booked = bookedByRide.get(String(r._id)) || 0;
      const seatsLeft = Math.max(0, r.seats - booked);
      return {
        _id: r._id,
        pickup: r.pickup,
        dropoff: r.dropoff,
        departureTime: r.departureTime,
        seats: r.seats,
        seatsLeft,
        notes: r.notes,
        createdAt: r.createdAt,
        poster: formatPublicStudent(r.poster),
      };
    })
    .filter((r) => r.seatsLeft > 0);

  res.json({ success: true, data });
});

const getMyRides = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const postedRides = await Ride.find({ poster: me._id, status: "open" }).sort({ createdAt: -1 });

  const bookings = await Booking.find({ ride: { $in: postedRides.map((r) => r._id) } })
    .populate("rider", publicPosterSelect)
    .sort({ createdAt: 1 });

  const requestsByRide = new Map();
  bookings.forEach((b) => {
    const key = String(b.ride);
    if (!requestsByRide.has(key)) requestsByRide.set(key, []);
    requestsByRide.get(key).push(b);
  });

  const posted = postedRides.map((r) => {
    const requests = requestsByRide.get(String(r._id)) || [];
    const accepted = requests.filter((b) => b.status === "accepted").length;
    return {
      _id: r._id,
      pickup: r.pickup,
      dropoff: r.dropoff,
      departureTime: r.departureTime,
      seats: r.seats,
      seatsLeft: Math.max(0, r.seats - accepted),
      notes: r.notes,
      status: r.status,
      createdAt: r.createdAt,
      requests: requests.map((b) => ({
        _id: b._id,
        status: b.status,
        cancelReason: b.cancelReason,
        createdAt: b.createdAt,
        rider: formatPublicStudent(b.rider),
      })),
    };
  });

  const requested = await Booking.find({ rider: me._id, status: { $ne: "cancelled" } })
    .populate({ path: "ride", populate: { path: "poster", select: publicPosterSelect } })
    .sort({ createdAt: -1 });

  const requestedData = requested.map((b) => ({
    _id: b._id,
    status: b.status,
    createdAt: b.createdAt,
      ride: b.ride
        ? {
            _id: b.ride._id,
            pickup: b.ride.pickup,
            dropoff: b.ride.dropoff,
            departureTime: b.ride.departureTime,
            seats: b.ride.seats,
            notes: b.ride.notes,
            status: b.ride.status,
            poster: formatPublicStudent(b.ride.poster),
          }
        : null,
  }));

  res.json({ success: true, data: { posted, requested: requestedData } });
});

const requestSeat = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
  if (ride.status !== "open") {
    return res.status(400).json({ success: false, message: "This ride is no longer open" });
  }
  if (String(ride.poster) === String(me._id)) {
    return res.status(400).json({ success: false, message: "You cannot request a seat on your own ride" });
  }

  const existing = await Booking.findOne({ ride: ride._id, rider: me._id });
  if (existing) {
    if (existing.status === "cancelled") {
      existing.status = "pending";
      await existing.save();
      return res.status(201).json({ success: true, data: existing });
    }
    return res.status(409).json({ success: false, message: "You already requested a seat on this ride" });
  }

  const booked = await Booking.countDocuments({ ride: ride._id, status: "accepted" });
  if (booked >= ride.seats) {
    return res.status(400).json({ success: false, message: "No seats left on this ride" });
  }

  const booking = await Booking.create({ ride: ride._id, rider: me._id });
  res.status(201).json({ success: true, data: booking });
});

const respondToRequest = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId) || !mongoose.isValidObjectId(req.params.requestId)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
  if (String(ride.poster) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the ride poster can respond to requests" });
  }

  const booking = await Booking.findOne({ _id: req.params.requestId, ride: ride._id });
  if (!booking) return res.status(404).json({ success: false, message: "Ride request not found" });

  const { decision } = req.body || {};
  if (!["accepted", "declined"].includes(decision)) {
    return res.status(400).json({ success: false, message: "Decision must be 'accepted' or 'declined'" });
  }

  if (booking.status !== "pending") {
    return res.status(400).json({ success: false, message: "This request has already been responded to" });
  }

  if (decision === "accepted") {
    const booked = await Booking.countDocuments({ ride: ride._id, status: "accepted" });
    if (booked >= ride.seats) {
      return res.status(400).json({ success: false, message: "No seats left on this ride" });
    }
  }

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "pending" },
    { $set: { status: decision } },
    { new: true }
  );
  if (!updated) {
    return res.status(400).json({ success: false, message: "This request has already been responded to" });
  }
  res.json({ success: true, data: updated });
});

const cancelRequest = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId) || !mongoose.isValidObjectId(req.params.requestId)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  const booking = await Booking.findOne({ _id: req.params.requestId, ride: ride._id });
  if (!booking) return res.status(404).json({ success: false, message: "Ride request not found" });
  if (String(booking.rider) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the rider can cancel their own request" });
  }

  if (!["pending", "accepted"].includes(booking.status)) {
    return res.status(400).json({ success: false, message: "Only a pending or accepted request can be cancelled" });
  }

  const { reason } = req.body || {};
  if (booking.status === "accepted" && (!reason || !String(reason).trim())) {
    return res.status(400).json({ success: false, message: "Cancellation reason is required" });
  }

  booking.status = "cancelled";
  booking.cancelReason = reason ? String(reason).trim() : null;
  await booking.save();
  res.json({ success: true, data: booking });
});

const cancelRide = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
  if (String(ride.poster) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the ride poster can cancel the ride" });
  }

  if (ride.status !== "open") {
    return res.status(400).json({ success: false, message: "This ride is already cancelled" });
  }

  ride.status = "cancelled";
  await ride.save();
  await Booking.updateMany({ ride: ride._id, status: { $in: ["pending", "accepted"] } }, { status: "cancelled" });
  res.json({ success: true, data: ride });
});

module.exports = { createRide, listRides, getMyRides, requestSeat, respondToRequest, cancelRequest, cancelRide };
