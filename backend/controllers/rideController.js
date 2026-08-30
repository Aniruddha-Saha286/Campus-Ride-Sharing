const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const RidePayment = require("../models/RidePayment");
const RideStatus = require("../models/RideStatus");
const asyncHandler = require("../utils/asyncHandler");
const {
  findMe,
  publicPosterSelect,
  formatPublicStudent,
  getRatingsForDrivers,
} = require("../utils/studentHelper");
const {
  GRACE_DAYS,
  DAY_MS,
  TERMINAL_STATUSES,
  roundMoney,
  seatCharge,
  refreshPayment,
  computeCancellationFine,
  computePassengerCancelFine,
} = require("../utils/ridePaymentHelper");
const { notifyUser } = require("../utils/notifier");

const { TIME_REGEX } = Ride;

/**
 * Create a new ride offer.
 */
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

/**
 * List open rides with seat calculations and driver rating averages.
 */
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

  // Get driver ratings
  const posterIds = rides.map((r) => r.poster?._id).filter(Boolean);
  const ratingMap = await getRatingsForDrivers(posterIds);

  // Get trip status for rides (to check if driver started the ride)
  const statuses = await RideStatus.find({ ride: { $in: rides.map((r) => r._id) } }).select("ride tripStatus");
  const tripStatusMap = new Map(statuses.map((s) => [String(s.ride), s.tripStatus]));

  // Get current user's bookings and payments for these rides
  const myBookings = await Booking.find({
    rider: me._id,
    ride: { $in: rides.map((r) => r._id) },
  });
  const myBookingMap = new Map(myBookings.map((b) => [String(b.ride), b]));

  const myPayments = await RidePayment.find({
    payer: me._id,
    ride: { $in: rides.map((r) => r._id) },
  });
  for (const p of myPayments) {
    await refreshPayment(p);
  }
  const myPaymentMap = new Map(myPayments.map((p) => [String(p.ride), p]));

  const data = rides
    .filter((r) => r.poster && String(r.poster._id) !== String(me._id))
    .map((r) => {
      const booked = bookedByRide.get(String(r._id)) || 0;
      const seatsLeft = Math.max(0, r.seats - booked);
      const posterRating = ratingMap.get(String(r.poster._id)) || null;
      const myBooking = myBookingMap.get(String(r._id));
      const myPayment = myPaymentMap.get(String(r._id));
      const tripStatus = tripStatusMap.get(String(r._id)) || "upcoming";

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
        tripStatus,
        charge: r.charge || 0,
        chargePerSeat: r.charge ? seatCharge(r.charge) : 0,
        notes: r.notes,
        status: r.status,
        cancelReason: r.cancelReason,
        createdAt: r.createdAt,
        poster: formatPublicStudent(r.poster, posterRating),
        myBooking: myBooking
          ? {
              _id: myBooking._id,
              status: myBooking.status,
              seats: myBooking.seats || 1,
              cancelReason: myBooking.cancelReason,
              paymentStatus: myBooking.paymentStatus,
              payment: myPayment
                ? {
                    _id: myPayment._id,
                    status: myPayment.status,
                    paymentMethod: myPayment.paymentMethod,
                    manualStatus: myPayment.manualStatus,
                    bkashTrxId: myPayment.bkashTrxId,
                    finalized: myPayment.finalized,
                    originalAmount: myPayment.originalAmount,
                    amountPaid: myPayment.amountPaid,
                    lateFee: myPayment.lateFee,
                    totalOutstanding: myPayment.totalOutstanding,
                    refundRequestedBy: myPayment.refundRequestedBy,
                    refundRequestedAt: myPayment.refundRequestedAt,
                    refundMethod: myPayment.refundMethod,
                    refundTransactionId: myPayment.refundTransactionId,
                    refundConfirmedBy: myPayment.refundConfirmedBy,
                    refundConfirmedAt: myPayment.refundConfirmedAt,
                    driverRefundConfirmedAt: myPayment.driverRefundConfirmedAt,
                  }
                : null,
            }
          : null,
      };
    })
    .filter((r) => ((r.tripStatus === "upcoming" || !r.tripStatus) && r.seatsLeft > 0) || r.myBooking != null);

  res.json({ success: true, data });
});

/**
 * Get posted and requested rides for the current user.
 */
const getMyRides = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const postedRides = await Ride.find({
    poster: me._id,
    status: { $in: ["open", "pending_cancellation"] },
  }).sort({ createdAt: -1 });

  const bookings = await Booking.find({ ride: { $in: postedRides.map((r) => r._id) } })
    .populate("rider", publicPosterSelect)
    .sort({ createdAt: 1 });

  const ridePayments = await RidePayment.find({ ride: { $in: postedRides.map((r) => r._id) } });
  for (const p of ridePayments) {
    await refreshPayment(p);
  }
  const paymentByRideAndPayer = new Map();
  ridePayments.forEach((p) => {
    paymentByRideAndPayer.set(`${p.ride}_${p.payer}`, p);
  });

  const requestsByRide = new Map();
  bookings.forEach((b) => {
    const key = String(b.ride);
    if (!requestsByRide.has(key)) requestsByRide.set(key, []);
    requestsByRide.get(key).push(b);
  });

  const postedRideIds = postedRides.map((r) => r._id);
  const postedStatuses = await RideStatus.find({ ride: { $in: postedRideIds } }).select("ride tripStatus");
  const postedTripStatusMap = new Map(postedStatuses.map((s) => [String(s.ride), s.tripStatus]));

  const posted = postedRides.map((r) => {
    const requests = requestsByRide.get(String(r._id)) || [];
    const accepted = requests
      .filter((b) => b.status === "accepted")
      .reduce((sum, b) => sum + (b.seats || 1), 0);
    return {
      _id: r._id,
      poster: r.poster,
      pickup: r.pickup,
      dropoff: r.dropoff,
      pickupLat: r.pickupLat,
      pickupLng: r.pickupLng,
      dropoffLat: r.dropoffLat,
      dropoffLng: r.dropoffLng,
      departureTime: r.departureTime,
      seats: r.seats,
      seatsLeft: Math.max(0, r.seats - accepted),
      tripStatus: postedTripStatusMap.get(String(r._id)) || "upcoming",
      charge: r.charge || 0,
      chargePerSeat: r.charge ? seatCharge(r.charge) : 0,
      notes: r.notes,
      status: r.status,
      cancelReason: r.cancelReason,
      createdAt: r.createdAt,
      requests: requests.map((b) => {
        const reqPayment = paymentByRideAndPayer.get(`${r._id}_${b.rider?._id}`);
        return {
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
          payment: reqPayment
            ? {
                _id: reqPayment._id,
                status: reqPayment.status,
                paymentMethod: reqPayment.paymentMethod,
                manualStatus: reqPayment.manualStatus,
                bkashTrxId: reqPayment.bkashTrxId,
                finalized: reqPayment.finalized,
                originalAmount: reqPayment.originalAmount,
                amountPaid: reqPayment.amountPaid,
                lateFee: reqPayment.lateFee,
                totalOutstanding: reqPayment.totalOutstanding,
                refundRequestedBy: reqPayment.refundRequestedBy,
                refundRequestedAt: reqPayment.refundRequestedAt,
                refundMethod: reqPayment.refundMethod,
                refundTransactionId: reqPayment.refundTransactionId,
                refundConfirmedBy: reqPayment.refundConfirmedBy,
                refundConfirmedAt: reqPayment.refundConfirmedAt,
                driverRefundConfirmedAt: reqPayment.driverRefundConfirmedAt,
              }
            : null,
        };
      }),
    };
  });

  const requested = await Booking.find({ rider: me._id })
    .populate({ path: "ride", populate: { path: "poster", select: publicPosterSelect } })
    .sort({ createdAt: -1 });

  // Get ratings for poster drivers
  const requestedPosterIds = requested.map((b) => b.ride?.poster?._id).filter(Boolean);
  const requestedRatingMap = await getRatingsForDrivers(requestedPosterIds);

  // Calculate booked seats (accepted) for requested rides to determine remaining seats
  const requestedRideIds = requested.map((b) => b.ride?._id).filter(Boolean);
  const requestedStatuses = await RideStatus.find({ ride: { $in: requestedRideIds } }).select("ride tripStatus");
  const requestedTripStatusMap = new Map(requestedStatuses.map((s) => [String(s.ride), s.tripStatus]));

  const acceptedBookingsForRequested = await Booking.find({
    ride: { $in: requestedRideIds },
    status: "accepted",
  });
  const acceptedSeatsByRequestedRide = new Map();
  acceptedBookingsForRequested.forEach((ab) => {
    const key = String(ab.ride);
    acceptedSeatsByRequestedRide.set(
      key,
      (acceptedSeatsByRequestedRide.get(key) || 0) + (ab.seats || 1)
    );
  });

  const paymentByRide = new Map();
  for (const booking of requested) {
    if (!booking.ride || !booking.ride.charge) continue;
    try {
      const payment = await RidePayment.findOne({ ride: booking.ride._id, payer: me._id });
      if (payment) {
        await refreshPayment(payment);
        paymentByRide.set(String(booking.ride._id), payment);
      }
    } catch (err) {
      console.error("Failed to load payment for booking", booking._id, err.message);
    }
  }

  const requestedData = requested
    .map((b) => {
      const payment = paymentByRide.get(String(b.ride ? b.ride._id : ""));
      const posterRating = b.ride?.poster ? requestedRatingMap.get(String(b.ride.poster._id)) : null;
      const acceptedCount = acceptedSeatsByRequestedRide.get(String(b.ride ? b.ride._id : "")) || 0;
      const seatsLeft = Math.max(0, (b.ride ? b.ride.seats : 0) - acceptedCount);
      const tripStatus = b.ride ? (requestedTripStatusMap.get(String(b.ride._id)) || "upcoming") : "upcoming";

      return {
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
        payment: payment
          ? {
              _id: payment._id,
              status: payment.status,
              paymentMethod: payment.paymentMethod,
              manualStatus: payment.manualStatus,
              bkashTrxId: payment.bkashTrxId,
              finalized: payment.finalized,
              originalAmount: payment.originalAmount,
              amountPaid: payment.amountPaid,
              lateFee: payment.lateFee,
              totalOutstanding: payment.totalOutstanding,
              refundRequestedBy: payment.refundRequestedBy,
              refundRequestedAt: payment.refundRequestedAt,
              refundMethod: payment.refundMethod,
              refundTransactionId: payment.refundTransactionId,
              refundConfirmedBy: payment.refundConfirmedBy,
              refundConfirmedAt: payment.refundConfirmedAt,
              driverRefundConfirmedAt: payment.driverRefundConfirmedAt,
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
              seatsLeft: seatsLeft,
              tripStatus,
              charge: b.ride.charge || 0,
              chargePerSeat: b.ride.charge ? seatCharge(b.ride.charge) : 0,
              notes: b.ride.notes,
              status: b.ride.status,
              cancelReason: b.ride.cancelReason,
              poster: formatPublicStudent(b.ride.poster, posterRating),
            }
          : null,
      };
    })
    .filter((b) => {
      if (!b.ride) return false;
      // Completed rides: only keep in active dashboard if there's a pending payment action.
      // Otherwise they belong in Ride History / RideStatusTracker (handled separately by groupmate's feature).
      if (b.ride.status === "completed") {
        // Keep if payment is still pending action (unpaid, partial, or refund in progress)
        if (!b.payment) return false; // free ride completed → hide
        const terminalPaymentStatuses = ["PAID", "REFUNDED", "CANCELLED"];
        if (terminalPaymentStatuses.includes(b.payment.status)) return false;
        return true; // still has payment pending → keep visible
      }
      // If ride or booking is cancelled/declined, only show if a refund action is actively pending
      if (b.ride.status === "cancelled" || b.status === "cancelled" || b.status === "declined") {
        return b.payment && b.payment.status === "REFUND_REQUESTED";
      }
      return true;
    });

  res.json({ success: true, data: { posted, requested: requestedData } });
});

/**
 * Passenger requests 1 or more seats on a ride offer.
 */
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

  // Once driver starts the ride (ongoing/completed), no user can request a seat for that ride
  const rideStatus = await RideStatus.findOne({ ride: ride._id });
  if (rideStatus && rideStatus.tripStatus !== "upcoming") {
    return res.status(400).json({
      success: false,
      message: "This ride has already started and is no longer accepting new seat requests",
    });
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
    if (existing.status === "cancelled" || existing.status === "declined") {
      existing.status = "pending";
      existing.seats = seatCount;
      existing.paymentStatus = "PENDING";
      existing.settledBy = null;
      existing.settledByUserId = null;
      existing.settledAt = null;
      existing.settledManually = false;
      existing.cancelReason = null;
      await existing.save();
      return res.status(201).json({ success: true, data: existing });
    }
    return res.status(409).json({ success: false, message: "You already requested a seat on this ride" });
  }

  const booking = await Booking.create({ ride: ride._id, rider: me._id, seats: seatCount });
  res.status(201).json({ success: true, data: booking });
});

/**
 * Driver responds to a passenger's seat request (accept or decline).
 */
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

  notifyUser(booking.rider, {
    type: decision === "accepted" ? "REQUEST_ACCEPTED" : "REQUEST_DECLINED",
    rideId: ride._id,
    actorName: me.name,
    decision,
    amount: ride.charge ? roundMoney(seatCharge(ride.charge) * (booking.seats || 1)) : 0,
    ride: { _id: ride._id, pickup: ride.pickup, dropoff: ride.dropoff },
  });

  res.json({ success: true, data: updated });
});

/**
 * Passenger cancels their seat request.
 * - If unpaid or free: cancels immediately. If accepted > 15m ago, calculates late fine.
 * - If already paid: marks booking cancelled and requests refund from driver.
 */
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

  if (!["pending", "accepted", "declined"].includes(booking.status)) {
    return res.status(400).json({ success: false, message: "Only an active or declined request can be cancelled" });
  }

  const { reason } = req.body || {};
  const reasonTrimmed = reason ? String(reason).trim() : null;

  // Check if passenger had paid
  let payment = null;
  if (ride.charge > 0) {
    payment = await RidePayment.findOne({ ride: ride._id, payer: booking.rider });
    if (payment) await refreshPayment(payment);
  }

  const hasPaid = payment && roundMoney(payment.amountPaid || 0) > 0 && !["REFUNDED", "CANCELLED"].includes(payment.status);

  if (booking.status === "accepted" && !hasPaid && !reasonTrimmed) {
    return res.status(400).json({
      success: false,
      message: "Cancellation reason is required",
    });
  }

  const reasonText = reasonTrimmed || (hasPaid ? "Cancelled by passenger" : null);

  // Compute late passenger cancellation fine if accepted > 15 min ago
  const fine = booking.status === "accepted" ? computePassengerCancelFine(booking.acceptedAt) : 0;

  if (hasPaid) {
    // Passenger paid: set payment status to REFUND_REQUESTED (ride remains until driver confirms refund)
    payment.status = "REFUND_REQUESTED";
    payment.refundRequestedBy = me._id;
    payment.refundRequestedAt = new Date();
    await payment.save();

    booking.cancelReason = reasonText;
    await booking.save();

    // Notify driver about the cancellation and refund request
    notifyUser(ride.poster, {
      type: "REFUND_REQUESTED",
      paymentId: payment._id,
      actorName: me.name,
      amount: roundMoney(payment.amountPaid),
      method: payment.paymentMethod,
      ride: { _id: ride._id, pickup: ride.pickup, dropoff: ride.dropoff },
    });

    return res.json({
      success: true,
      data: booking,
      refundPending: true,
      fine,
      message: "Ride request cancelled and refund requested from driver.",
    });
  }

  // Unpaid or free ride: cancel immediately
  booking.status = "cancelled";
  booking.cancelReason = reasonText;
  await booking.save();

  if (payment && !TERMINAL_STATUSES.includes(payment.status)) {
    payment.status = "CANCELLED";
    payment.remainingAmount = 0;
    payment.lateFee = 0;
    payment.totalOutstanding = 0;
    payment.cancelledAt = new Date();
    await payment.save();
  }

  // If late cancellation fine applies, create fine due against passenger
  if (fine > 0) {
    await RidePayment.create({
      payer: me._id,
      receiver: ride.poster,
      seats: 1,
      originalAmount: fine,
      amountPaid: 0,
      remainingAmount: fine,
      totalOutstanding: fine,
      status: "DUE",
      manualStatus: "DUE",
      note: "Late passenger cancellation fine (past 15-minute window)",
    });
  }

  res.json({
    success: true,
    data: booking,
    refundPending: false,
    fine,
    message: fine > 0
      ? `Request cancelled. A late cancellation fine of ৳${fine} applies.`
      : "Request cancelled successfully.",
  });
});

/**
 * Driver cancels the posted ride.
 * - Records cancellation reason.
 * - If passengers have paid: initiates refund (bKash with TrxID or Manual) and sets status to REFUND_REQUESTED.
 * - If unpaid or free: cancels immediately.
 * - Computes late driver cancellation fine if accepted > 15m ago.
 */
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
    return res.status(400).json({ success: false, message: `This ride is already ${ride.status}` });
  }

  const { cancelReason, reason, refundMethod, refundTransactionId } = req.body || {};
  const reasonText = (cancelReason || reason ? String(cancelReason || reason).trim() : "") || "Ride cancelled by driver";

  const payments = await RidePayment.find({ ride: ride._id });
  for (const payment of payments) {
    await refreshPayment(payment);
  }

  const paidPayments = payments.filter(
    (p) => roundMoney((p.amountPaid || 0) + (p.lateFeePaid || 0)) > 0 && !["REFUNDED", "CANCELLED"].includes(p.status)
  );

  // Compute late driver cancellation fine (15-min free window, 30 Tk per 10 min thereafter)
  const earliestAccepted = await Booking.findOne({ ride: ride._id, acceptedAt: { $ne: null } })
    .sort({ acceptedAt: 1 })
    .select("acceptedAt");
  const cancellationFine = earliestAccepted ? computeCancellationFine(earliestAccepted.acceptedAt) : 0;

  if (paidPayments.length > 0) {
    const trimmedReason = (cancelReason || reason ? String(cancelReason || reason).trim() : "");
    if (!trimmedReason) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required when passengers have paid",
      });
    }

    // If passengers have paid, set ride to pending_cancellation until passengers confirm refund
    ride.status = "pending_cancellation";
    ride.cancelReason = trimmedReason;
    ride.cancellationFine = cancellationFine;
    await ride.save();

    // Process refunds for paid passengers
    for (const payment of paidPayments) {
      payment.status = "REFUND_REQUESTED";
      payment.refundRequestedBy = me._id;
      payment.refundRequestedAt = new Date();
      payment.refundMethod = refundMethod || "MANUAL";
      payment.refundTransactionId = refundTransactionId ? String(refundTransactionId).trim() : null;
      payment.note = `Driver cancelled ride: ${reasonText}`;
      await payment.save();

      // Notify passenger with cancellation reason and refund initiation
      notifyUser(payment.payer, {
        type: "DRIVER_CANCELLED_REFUND_INITIATED",
        paymentId: payment._id,
        actorName: me.name,
        amount: roundMoney(payment.amountPaid),
        refundMethod: payment.refundMethod,
        refundTransactionId: payment.refundTransactionId,
        reason: reasonText,
        ride: { _id: ride._id, pickup: ride.pickup, dropoff: ride.dropoff },
      });
    }
  } else {
    // No paid passengers: cancel immediately
    ride.status = "cancelled";
    ride.cancelReason = reasonText;
    ride.cancellationFine = cancellationFine;
    await ride.save();

    // Update all bookings to cancelled
    await Booking.updateMany(
      { ride: ride._id, status: { $in: ["pending", "accepted", "declined"] } },
      { $set: { status: "cancelled", cancelReason: reasonText } }
    );
  }

  // Cancel any unpaid payment records
  const unpaidPayments = payments.filter(
    (p) => roundMoney((p.amountPaid || 0) + (p.lateFeePaid || 0)) === 0 && !TERMINAL_STATUSES.includes(p.status)
  );
  for (const p of unpaidPayments) {
    p.status = "CANCELLED";
    p.remainingAmount = 0;
    p.lateFee = 0;
    p.totalOutstanding = 0;
    p.cancelledAt = new Date();
    await p.save();
  }

  // If driver cancellation fine applies, create fine dues owed to accepted passengers
  if (cancellationFine > 0) {
    const acceptedBookings = await Booking.find({ ride: ride._id, acceptedAt: { $ne: null } });
    for (const b of acceptedBookings) {
      await RidePayment.create({
        payer: me._id,
        receiver: b.rider,
        seats: 1,
        originalAmount: cancellationFine,
        amountPaid: 0,
        remainingAmount: cancellationFine,
        totalOutstanding: cancellationFine,
        status: "DUE",
        manualStatus: "DUE",
        note: "Driver late cancellation fine (past 15-minute window)",
      });
    }
  }

  res.json({
    success: true,
    data: ride,
    cancellationFine,
    hasRefundsPending: paidPayments.length > 0,
    message: paidPayments.length > 0
      ? "Ride cancelled. Refunds have been initiated for paid passengers."
      : "Ride cancelled successfully.",
  });
});

/**
 * Update ride details (seats, charge, time, notes).
 */
const updateRide = asyncHandler(async (req, res) => {
  const { rideId } = req.params;
  if (!mongoose.isValidObjectId(rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride ID" });
  }

  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  if (String(ride.poster) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the poster can edit this ride offer" });
  }

  if (ride.status === "cancelled" || ride.status === "completed") {
    return res.status(400).json({ success: false, message: `Cannot edit a ${ride.status} ride offer` });
  }

  const rideStatus = await RideStatus.findOne({ ride: ride._id });
  if (rideStatus && rideStatus.tripStatus !== "upcoming") {
    return res.status(400).json({ success: false, message: "Cannot edit a ride that has already started" });
  }

  const acceptedBookings = await Booking.find({ ride: ride._id, status: "accepted" });
  const acceptedSeats = acceptedBookings.reduce((sum, b) => sum + (b.seats || 1), 0);

  if (acceptedSeats >= ride.seats) {
    return res.status(400).json({ success: false, message: "Cannot edit a fully booked ride offer" });
  }

  const { pickup, dropoff, departureTime, seats, notes, pickupLat, pickupLng, dropoffLat, dropoffLng, charge } = req.body || {};

  if (acceptedSeats > 0) {
    const isPickupChanged = pickup !== undefined && String(pickup).trim() !== ride.pickup;
    const isDropoffChanged = dropoff !== undefined && String(dropoff).trim() !== ride.dropoff;
    if (isPickupChanged || isDropoffChanged) {
      return res.status(400).json({
        success: false,
        message: "Cannot change pickup or drop-off location once a seat request has been accepted",
      });
    }

    const isTimeChanged = departureTime !== undefined && departureTime !== ride.departureTime;
    if (isTimeChanged) {
      return res.status(400).json({
        success: false,
        message: "Cannot change departure time once a seat request has been accepted",
      });
    }

    const isChargeChanged =
      charge !== undefined &&
      charge !== null &&
      charge !== "" &&
      roundMoney(Number(charge)) !== roundMoney(ride.charge || 0);
    if (isChargeChanged) {
      return res.status(400).json({
        success: false,
        message: "Cannot change ride fare once a seat request has been accepted",
      });
    }
  }

  if (pickup !== undefined) {
    const trimmed = String(pickup).trim();
    if (!trimmed) return res.status(400).json({ success: false, message: "Pickup location cannot be empty" });
    ride.pickup = trimmed;
  }

  if (dropoff !== undefined) {
    const trimmed = String(dropoff).trim();
    if (!trimmed) return res.status(400).json({ success: false, message: "Drop-off location cannot be empty" });
    ride.dropoff = trimmed;
  }

  if (departureTime !== undefined) {
    if (!departureTime || !TIME_REGEX.test(departureTime)) {
      return res.status(400).json({ success: false, message: "Departure time must be in HH:MM (24-hour) format" });
    }
    ride.departureTime = departureTime;
  }

  if (seats !== undefined) {
    const seatCount = Number(seats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 6) {
      return res.status(400).json({ success: false, message: "Seats must be a whole number between 1 and 6" });
    }
    if (seatCount < acceptedSeats) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce seats below already accepted seats (${acceptedSeats})`,
      });
    }
    ride.seats = seatCount;
  }

  if (charge !== undefined && charge !== null && charge !== "") {
    const chargeValue = Number(charge);
    if (!Number.isFinite(chargeValue) || chargeValue < 0) {
      return res.status(400).json({ success: false, message: "Ride charge must be a non-negative number" });
    }
    ride.charge = roundMoney(chargeValue);
  }

  if (notes !== undefined) {
    ride.notes = notes ? String(notes).trim() : "";
  }

  if (pickupLat !== undefined) ride.pickupLat = pickupLat ?? null;
  if (pickupLng !== undefined) ride.pickupLng = pickupLng ?? null;
  if (dropoffLat !== undefined) ride.dropoffLat = dropoffLat ?? null;
  if (dropoffLng !== undefined) ride.dropoffLng = dropoffLng ?? null;

  await ride.save();

  const populated = await Ride.findById(ride._id).populate("poster", publicPosterSelect);

  res.json({
    success: true,
    data: populated,
    message: "Ride offer updated successfully",
  });
});

/**
 * Passenger edits the number of seats on their booking (before or after payment).
 */
const updateBookingSeats = asyncHandler(async (req, res) => {
  const { rideId, requestId } = req.params;
  if (!mongoose.isValidObjectId(rideId) || !mongoose.isValidObjectId(requestId)) {
    return res.status(400).json({ success: false, message: "Invalid ID" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
  if (ride.status !== "open") {
    return res.status(400).json({ success: false, message: "This ride is not open" });
  }

  const rideStatus = await RideStatus.findOne({ ride: ride._id });
  if (rideStatus && rideStatus.tripStatus !== "upcoming") {
    return res.status(400).json({ success: false, message: "Cannot change seats once the ride has already started" });
  }

  const booking = await Booking.findOne({ _id: requestId, ride: ride._id });
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
  if (String(booking.rider) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the booking rider can edit seats" });
  }
  if (!["pending", "accepted"].includes(booking.status)) {
    return res.status(400).json({ success: false, message: "Cannot edit seats for a cancelled or declined booking" });
  }

  const newSeats = Number(req.body.seats);
  if (!Number.isInteger(newSeats) || newSeats < 1 || newSeats > 6) {
    return res.status(400).json({ success: false, message: "Seats must be a whole number between 1 and 6" });
  }

  const currentSeats = booking.seats || 1;
  if (newSeats === currentSeats) {
    return res.json({ success: true, data: booking });
  }

  // Check seat capacity
  const bookedAgg = await Booking.aggregate([
    { $match: { ride: ride._id, _id: { $ne: booking._id }, status: "accepted" } },
    { $group: { _id: null, count: { $sum: "$seats" } } },
  ]);
  const otherBooked = bookedAgg[0] ? bookedAgg[0].count : 0;
  if (otherBooked + newSeats > ride.seats) {
    return res.status(400).json({ success: false, message: "Not enough seats available on this ride" });
  }

  booking.seats = newSeats;
  await booking.save();

  // Adjust payment if charge applies
  let payment = await RidePayment.findOne({ ride: ride._id, payer: me._id });
  if (payment) {
    await refreshPayment(payment);
    const perRider = seatCharge(ride.charge);
    const alreadyPaid = roundMoney(payment.amountPaid || 0);
    const paidSeatsCount = perRider > 0 ? Math.floor(alreadyPaid / perRider) : (payment.status === "PAID" ? currentSeats : 0);

    // If passenger already paid, they cannot reduce seats below already paid seats
    if (paidSeatsCount > 0 && newSeats < paidSeatsCount) {
      return res.status(400).json({
        success: false,
        message: `You have already paid for ${paidSeatsCount} seat${paidSeatsCount > 1 ? "s" : ""}. You cannot reduce paid seats, only request extra seats.`,
      });
    }

    const newTotalAmount = roundMoney(perRider * newSeats);

    payment.seats = newSeats;
    payment.originalAmount = newTotalAmount;
    payment.remainingAmount = roundMoney(Math.max(0, newTotalAmount - alreadyPaid));

    if (alreadyPaid > 0 && payment.remainingAmount > 0) {
      payment.status = "PENDING";
      payment.manualStatus = "PENDING";
      payment.finalized = false;
      booking.paymentStatus = "PENDING";
      await booking.save();
    }
    await refreshPayment(payment);
  }

  notifyUser(ride.poster, {
    type: "SEATS_UPDATED",
    rideId: ride._id,
    actorName: me.name,
    seats: newSeats,
    amount: ride.charge ? roundMoney(seatCharge(ride.charge) * newSeats) : 0,
    ride: { _id: ride._id, pickup: ride.pickup, dropoff: ride.dropoff },
  });

  res.json({
    success: true,
    data: booking,
    payment,
    message: `Updated to ${newSeats} seat${newSeats > 1 ? "s" : ""}. Total fare: ৳${ride.charge * newSeats}`,
  });
});

module.exports = {
  createRide,
  listRides,
  getMyRides,
  requestSeat,
  respondToRequest,
  cancelRequest,
  cancelRide,
  updateRide,
  updateBookingSeats,
};

