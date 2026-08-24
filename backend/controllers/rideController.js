const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const RidePayment = require("../models/RidePayment");
const asyncHandler = require("../utils/asyncHandler");
const { findMe, publicPosterSelect, formatPublicStudent } = require("../utils/studentHelper");
const { GRACE_DAYS, DAY_MS, TERMINAL_STATUSES, roundMoney, seatCharge, refreshPayment, computeCancellationFine } = require("../utils/ridePaymentHelper");

const { TIME_REGEX } = Ride;

const createRide = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { pickup, dropoff, departureTime, seats, notes, pickupLat, pickupLng, dropoffLat, dropoffLng, charge } = req.body || {};

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

  let chargeValue = 0;
  if (charge !== undefined && charge !== null && charge !== "") {
    chargeValue = Number(charge);
    if (!Number.isFinite(chargeValue) || chargeValue < 0) {
      return res.status(400).json({ success: false, message: "Ride charge must be a non-negative number" });
    }
    chargeValue = roundMoney(chargeValue);
  }

  const ride = await Ride.create({
    poster: me._id,
    pickup: String(pickup).trim(),
    dropoff: String(dropoff).trim(),
    departureTime,
    seats: seatCount,
    charge: chargeValue,
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
    { $group: { _id: "$ride", count: { $sum: "$seats" } } },
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
        pickupLat: r.pickupLat,
        pickupLng: r.pickupLng,
        dropoffLat: r.dropoffLat,
        dropoffLng: r.dropoffLng,
        departureTime: r.departureTime,
        seats: r.seats,
        seatsLeft,
        charge: r.charge || 0,
        chargePerSeat: r.charge ? seatCharge(r.charge) : 0,
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
    const accepted = requests
      .filter((b) => b.status === "accepted")
      .reduce((sum, b) => sum + (b.seats || 1), 0);
    return {
      _id: r._id,
      pickup: r.pickup,
      dropoff: r.dropoff,
      pickupLat: r.pickupLat,
      pickupLng: r.pickupLng,
      dropoffLat: r.dropoffLat,
      dropoffLng: r.dropoffLng,
      departureTime: r.departureTime,
      seats: r.seats,
      seatsLeft: Math.max(0, r.seats - accepted),
      charge: r.charge || 0,
      chargePerSeat: r.charge ? seatCharge(r.charge) : 0,
      notes: r.notes,
      status: r.status,
      createdAt: r.createdAt,
      requests: requests.map((b) => ({
        _id: b._id,
        status: b.status,
        seats: b.seats || 1,
        cancelReason: b.cancelReason,
        paymentStatus: b.paymentStatus,
        settledBy: b.settledBy,
        settledByUserId: b.settledByUserId,
        settledAt: b.settledAt,
        settledManually: b.settledManually,
        createdAt: b.createdAt,
        rider: formatPublicStudent(b.rider),
      })),
    };
  });

  const requested = await Booking.find({ rider: me._id, status: { $ne: "cancelled" } })
    .populate({ path: "ride", populate: { path: "poster", select: publicPosterSelect } })
    .sort({ createdAt: -1 });

  const paymentByRide = new Map();
  for (const booking of requested) {
    if (booking.status !== "accepted" || !booking.ride || !booking.ride.charge) continue;
    const payment = await RidePayment.findOne({ ride: booking.ride._id, payer: me._id });
    if (payment) {
      await refreshPayment(payment);
      paymentByRide.set(String(booking.ride._id), payment);
    }
  }

  const requestedData = requested.map((b) => {
    const payment = paymentByRide.get(String(b.ride ? b.ride._id : ""));
    return {
    _id: b._id,
    status: b.status,
    seats: b.seats || 1,
    paymentStatus: b.paymentStatus,
    settledBy: b.settledBy,
    settledByUserId: b.settledByUserId,
    settledAt: b.settledAt,
    settledManually: b.settledManually,
    createdAt: b.createdAt,
    payment: payment
      ? {
          _id: payment._id,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          manualStatus: payment.manualStatus,
          finalized: payment.finalized,
          originalAmount: payment.originalAmount,
          amountPaid: payment.amountPaid,
          lateFee: payment.lateFee,
          totalOutstanding: payment.totalOutstanding,
        }
      : null,
      ride: b.ride
        ? {
            _id: b.ride._id,
            pickup: b.ride.pickup,
            dropoff: b.ride.dropoff,
            pickupLat: b.ride.pickupLat,
            pickupLng: b.ride.pickupLng,
            dropoffLat: b.ride.dropoffLat,
            dropoffLng: b.ride.dropoffLng,
            departureTime: b.ride.departureTime,
            seats: b.ride.seats,
            charge: b.ride.charge || 0,
            chargePerSeat: b.ride.charge ? seatCharge(b.ride.charge) : 0,
            notes: b.ride.notes,
            status: b.ride.status,
            poster: formatPublicStudent(b.ride.poster),
          }
        : null,
  };
  });

  res.json({ success: true, data: { posted, requested: requestedData } });
});

const requestSeat = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const seatCount =
    req.body.seats === undefined || req.body.seats === null || req.body.seats === ""
      ? 1
      : Number(req.body.seats);
  if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 6) {
    return res.status(400).json({ success: false, message: "Seats must be a whole number between 1 and 6" });
  }

  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
  if (ride.status !== "open") {
    return res.status(400).json({ success: false, message: "This ride is no longer open" });
  }
  if (String(ride.poster) === String(me._id)) {
    return res.status(400).json({ success: false, message: "You cannot request a seat on your own ride" });
  }

  const bookedAgg = await Booking.aggregate([
    { $match: { ride: ride._id, status: "accepted" } },
    { $group: { _id: null, count: { $sum: "$seats" } } },
  ]);
  const booked = bookedAgg[0] ? bookedAgg[0].count : 0;
  if (booked + seatCount > ride.seats) {
    return res.status(400).json({ success: false, message: "Not enough seats left on this ride" });
  }

  const existing = await Booking.findOne({ ride: ride._id, rider: me._id });
  if (existing) {
    if (existing.status === "cancelled") {
      existing.status = "pending";
      existing.seats = seatCount;
      existing.paymentStatus = "PENDING";
      existing.settledBy = null;
      existing.settledByUserId = null;
      existing.settledAt = null;
      existing.settledManually = false;
      await existing.save();
      return res.status(201).json({ success: true, data: existing });
    }
    return res.status(409).json({ success: false, message: "You already requested a seat on this ride" });
  }

  const booking = await Booking.create({ ride: ride._id, rider: me._id, seats: seatCount });
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
    const bookedAgg = await Booking.aggregate([
      { $match: { ride: ride._id, status: "accepted" } },
      { $group: { _id: null, count: { $sum: "$seats" } } },
    ]);
    const booked = bookedAgg[0] ? bookedAgg[0].count : 0;
    if (booked + (booking.seats || 1) > ride.seats) {
      return res.status(400).json({ success: false, message: "Not enough seats left on this ride" });
    }
  }

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "pending" },
    { $set: { status: decision, ...(decision === "accepted" ? { acceptedAt: new Date() } : {}) } },
    { new: true }
  );
  if (!updated) {
    return res.status(400).json({ success: false, message: "This request has already been responded to" });
  }

  if (decision === "accepted" && ride.charge > 0) {
    const perRider = seatCharge(ride.charge);
    const paymentAmount = roundMoney(perRider * (booking.seats || 1));
    const existingPayment = await RidePayment.findOne({ ride: ride._id, payer: booking.rider });
    if (existingPayment) {
      if (TERMINAL_STATUSES.includes(existingPayment.status)) {
        existingPayment.status = "PENDING";
        existingPayment.paymentMethod = null;
        existingPayment.manualStatus = null;
        existingPayment.finalized = false;
        existingPayment.finalizedBy = null;
        existingPayment.finalizedAt = null;
        existingPayment.refundRequestedBy = null;
        existingPayment.refundRequestedAt = null;
        existingPayment.refundConfirmedBy = null;
        existingPayment.refundConfirmedAt = null;
        existingPayment.cancelledAt = null;
        existingPayment.seats = booking.seats || 1;
        existingPayment.originalAmount = paymentAmount;
        existingPayment.amountPaid = 0;
        existingPayment.remainingAmount = paymentAmount;
        existingPayment.lateFeePaid = 0;
        existingPayment.dueDate = new Date(Date.now() + GRACE_DAYS * DAY_MS);
        existingPayment.lastPaymentDate = null;
        existingPayment.bkashPaymentID = null;
        await refreshPayment(existingPayment);
      }
    } else {
      const payment = await RidePayment.create({
        ride: ride._id,
        payer: booking.rider,
        receiver: ride.poster,
        seats: booking.seats || 1,
        originalAmount: paymentAmount,
        amountPaid: 0,
        remainingAmount: paymentAmount,
        dueDate: new Date(Date.now() + GRACE_DAYS * DAY_MS),
      });
      await refreshPayment(payment);
    }
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

  if (booking.status === "accepted" && ride.charge > 0) {
    const payment = await RidePayment.findOne({ ride: ride._id, payer: booking.rider });
    if (payment) {
      await refreshPayment(payment);
      if (roundMoney(payment.amountPaid || 0) > 0 && !["REFUNDED", "CANCELLED"].includes(payment.status)) {
        return res.status(400).json({
          success: false,
          message:
            "You have made a payment for this ride. Ask the ride owner to request a refund and confirm it before you cancel.",
        });
      }
      if (!TERMINAL_STATUSES.includes(payment.status)) {
        payment.status = "CANCELLED";
        payment.remainingAmount = 0;
        payment.lateFee = 0;
        payment.totalOutstanding = 0;
        payment.cancelledAt = new Date();
        await payment.save();
      }
    }
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
    return res.status(400).json({ success: false, message: "This ride cannot be cancelled (it is already " + ride.status + ")" });
  }

  const payments = await RidePayment.find({ ride: ride._id });
  for (const payment of payments) {
    await refreshPayment(payment);
    if (
      roundMoney(roundMoney(payment.amountPaid || 0) + roundMoney(payment.lateFeePaid || 0)) > 0 &&
      !["REFUNDED", "CANCELLED"].includes(payment.status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Some passengers have already paid. Request and confirm refunds for the paid payments before cancelling this ride.",
      });
    }
  }

  const earliestAccepted = await Booking.findOne({ ride: ride._id, acceptedAt: { $ne: null } })
    .sort({ acceptedAt: 1 })
    .select("acceptedAt");
  const cancellationFine = earliestAccepted
    ? computeCancellationFine(earliestAccepted.acceptedAt)
    : 0;

  const claimed = await Ride.findOneAndUpdate(
    { _id: ride._id, status: "open" },
    { $set: { status: "cancelled", cancellationFine } },
    { new: true }
  );
  if (!claimed) {
    return res.status(400).json({ success: false, message: "This ride is already cancelled" });
  }

  await Booking.updateMany({ ride: ride._id, status: { $in: ["pending", "accepted"] } }, { status: "cancelled" });

  for (const payment of payments) {
    if (TERMINAL_STATUSES.includes(payment.status)) continue;
    payment.status = "CANCELLED";
    payment.remainingAmount = 0;
    payment.lateFee = 0;
    payment.lateFeePaid = 0;
    payment.totalOutstanding = 0;
    payment.cancelledAt = new Date();
    await payment.save();
  }

  if (cancellationFine > 0) {
    const refundedPayments = payments.filter((p) => p.status === "REFUNDED");
    for (const rp of refundedPayments) {
      await RidePayment.create({
          payer: me._id,
          receiver: rp.payer,
          seats: 1,
          originalAmount: cancellationFine,
          amountPaid: 0,
          remainingAmount: cancellationFine,
          totalOutstanding: cancellationFine,
          status: "DUE",
          manualStatus: "DUE",
          note: "Cancellation fine",
        });
    }
  }

  res.json({ success: true, data: claimed, cancellationFine });
});

module.exports = { createRide, listRides, getMyRides, requestSeat, respondToRequest, cancelRequest, cancelRide };
