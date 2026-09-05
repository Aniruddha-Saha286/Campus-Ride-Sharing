const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const RidePayment = require("../models/RidePayment");
const RideStatus = require("../models/RideStatus");
const VehicleRide = require("../models/VehicleRide");
const asyncHandler = require("../utils/asyncHandler");
const {
  findMe,
  publicPosterSelect,
  formatPublicStudent,
  getRatingsForDrivers,
} = require("../utils/studentHelper");
const {
  TERMINAL_STATUSES,
  roundMoney,
  seatCharge,
  refreshPayment,
  computeCancellationFine,
  computePassengerCancelFine,
} = require("../utils/ridePaymentHelper");
const { notifyUser, createNotification } = require("../utils/notifier");
const { syncRidePaymentsWithCostSplit } = require("../utils/splitPaymentSync");
const { isInsideDhakaCoverage } = require("../utils/dhakaCoverage");
const { validateRegistrationPlate } = require("../utils/vehicleRegistration");

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

  if (pickupLat != null || pickupLng != null) {
    if (!isInsideDhakaCoverage(pickupLat, pickupLng)) {
      return res.status(400).json({ success: false, message: "Pickup and destination must be within the Campus Ride service area (Dhaka, Gazipur and Narayanganj)." });
    }
  }
  if (dropoffLat != null || dropoffLng != null) {
    if (!isInsideDhakaCoverage(dropoffLat, dropoffLng)) {
      return res.status(400).json({ success: false, message: "Pickup and destination must be within the Campus Ride service area (Dhaka, Gazipur and Narayanganj)." });
    }
  }

  if (!departureTime || !TIME_REGEX.test(departureTime)) {
    return res.status(400).json({ success: false, message: "Departure time must be in HH:MM (24-hour) format" });
  }
  const seatCount = Number(seats);
  if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 8) {
    return res.status(400).json({ success: false, message: "Seats must be a whole number between 1 and 8" });
  }

  let chargeValue = 0;
  if (charge !== undefined && charge !== null && charge !== "") {
    chargeValue = Number(charge);
    if (!Number.isFinite(chargeValue) || chargeValue < 0) {
      return res.status(400).json({ success: false, message: "Ride charge must be a non-negative number" });
    }
    chargeValue = roundMoney(chargeValue);
  }

  const activeBookingInfo = await findActiveBookingForRider(me._id);
  if (activeBookingInfo) {
    if (activeBookingInfo.isDriver) {
      return res.status(400).json({
        success: false,
        message: `You already have an active posted ride from ${activeBookingInfo.ride.pickup} to ${activeBookingInfo.ride.dropoff}. You cannot post more than 1 ride until your current ride is cancelled or ended.`,
      });
    }
    if (activeBookingInfo.booking?.status === "accepted") {
      return res.status(400).json({
        success: false,
        message: `You already have an active booked ride from ${activeBookingInfo.ride.pickup} to ${activeBookingInfo.ride.dropoff}. You cannot post a ride until your current ride is completed.`,
      });
    }
    if (activeBookingInfo.booking?.status === "pending") {
      return res.status(400).json({
        success: false,
        message: `You already have a pending seat request for a ride from ${activeBookingInfo.ride.pickup} to ${activeBookingInfo.ride.dropoff}. Please cancel that request before posting a ride.`,
      });
    }
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

const pendingSeatRequests = new Set();

const findActiveBookingForRider = async (riderId) => {
  const activePostedRide = await Ride.findOne({
    poster: riderId,
    status: { $in: ["open", "pending_cancellation"] },
  });
  if (activePostedRide) {
    const statusDoc = await RideStatus.findOne({ ride: activePostedRide._id }).select("tripStatus");
    const tripStatus = statusDoc?.tripStatus || "upcoming";
    if (tripStatus !== "completed") {
      return {
        booking: { status: "accepted" },
        ride: activePostedRide,
        tripStatus,
        isDriver: true,
      };
    }
  }

  const bookings = await Booking.find({
    rider: riderId,
    status: { $in: ["accepted", "pending"] },
  }).populate("ride");

  if (!bookings || bookings.length === 0) return null;

  bookings.sort((a, b) => (a.status === "accepted" ? -1 : 1));

  const rideIds = bookings.map((b) => b.ride?._id).filter(Boolean);
  const statuses = await RideStatus.find({ ride: { $in: rideIds } }).select("ride tripStatus");
  const tripStatusMap = new Map(statuses.map((s) => [String(s.ride), s.tripStatus]));

  for (const b of bookings) {
    if (!b.ride) continue;
    if (b.ride.status === "cancelled" || b.ride.status === "completed") continue;
    const tripStatus = tripStatusMap.get(String(b.ride._id)) || "upcoming";
    if (tripStatus === "completed") continue;

    return {
      booking: b,
      ride: b.ride,
      tripStatus,
      isDriver: false,
    };
  }

  return null;
};

const listRides = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const rides = await Ride.find({ status: "open" })
    .populate("poster", publicPosterSelect)
    .sort({ departureTime: 1, createdAt: -1 });

  const counts = await Booking.aggregate([
    { $match: { ride: { $in: rides.map((r) => r._id) }, status: "accepted" } },
    { $group: { _id: "$ride", count: { $sum: "$seats" }, riders: { $sum: 1 } } },
  ]);
  const bookedByRide = new Map(counts.map((c) => [String(c._id), c.count]));
  const ridersByRide = new Map(counts.map((c) => [String(c._id), c.riders]));

  const posterIds = rides.map((r) => r.poster?._id).filter(Boolean);
  const ratingMap = await getRatingsForDrivers(posterIds);

  const statuses = await RideStatus.find({ ride: { $in: rides.map((r) => r._id) } }).select("ride tripStatus");
  const tripStatusMap = new Map(statuses.map((s) => [String(s.ride), s.tripStatus]));

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

  const vrList = await VehicleRide.find({ ride: { $in: rides.map((r) => r._id) } });
  const vrMap = new Map(vrList.map((vr) => [String(vr.ride), vr]));

  const data = rides
    .filter((r) => r.poster && String(r.poster._id) !== String(me._id))
    .map((r) => {
      const booked = bookedByRide.get(String(r._id)) || 0;
      const vr = vrMap.get(String(r._id));
      const totalSeats = vr?.allocatedSeats || r.seats;
      const seatsLeft = Math.max(0, totalSeats - booked);
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
        seats: totalSeats,
        seatsLeft,
        confirmedRidersCount: ridersByRide.get(String(r._id)) || 0,
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
                    remainingAmount: myPayment.remainingAmount,
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

  const activeBookingInfo = await findActiveBookingForRider(me._id);

  res.json({
    success: true,
    data,
    activeBooking: activeBookingInfo
      ? {
          rideId: activeBookingInfo.ride._id,
          pickup: activeBookingInfo.ride.pickup,
          dropoff: activeBookingInfo.ride.dropoff,
          departureTime: activeBookingInfo.ride.departureTime,
          status: activeBookingInfo.booking.status,
          tripStatus: activeBookingInfo.tripStatus,
          isDriver: Boolean(activeBookingInfo.isDriver),
        }
      : null,
  });
});

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

  const postedVRList = await VehicleRide.find({ ride: { $in: postedRideIds } });
  const postedVRMap = new Map(postedVRList.map((vr) => [String(vr.ride), vr]));

  const posted = postedRides
    .filter((r) => {
      const tripStatus = postedTripStatusMap.get(String(r._id)) || "upcoming";
      return r.status !== "completed" && tripStatus !== "completed";
    })
    .map((r) => {
    const requests = requestsByRide.get(String(r._id)) || [];
    const accepted = requests
      .filter((b) => b.status === "accepted")
      .reduce((sum, b) => sum + (b.seats || 1), 0);
    const vr = postedVRMap.get(String(r._id));
    const totalSeats = vr?.allocatedSeats || r.seats;
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
      seats: totalSeats,
      seatsLeft: Math.max(0, totalSeats - accepted),
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

  const requestedPosterIds = requested.map((b) => b.ride?.poster?._id).filter(Boolean);
  const requestedRatingMap = await getRatingsForDrivers(requestedPosterIds);

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

  const reqRideIds = requested.map((b) => b.ride?._id).filter(Boolean);
  const reqVRList = await VehicleRide.find({ ride: { $in: reqRideIds } });
  const reqVRMap = new Map(reqVRList.map((vr) => [String(vr.ride), vr]));

  const requestedData = requested
    .map((b) => {
      const payment = paymentByRide.get(String(b.ride ? b.ride._id : ""));
      const posterRating = b.ride?.poster ? requestedRatingMap.get(String(b.ride.poster._id)) : null;
      const acceptedCount = acceptedSeatsByRequestedRide.get(String(b.ride ? b.ride._id : "")) || 0;
      const vr = b.ride ? reqVRMap.get(String(b.ride._id)) : null;
      const totalSeats = vr?.allocatedSeats || (b.ride ? b.ride.seats : 0);
      const seatsLeft = Math.max(0, totalSeats - acceptedCount);
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
              seats: totalSeats,
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
      const isTripCompleted =
        b.ride.status === "completed" ||
        b.ride.tripStatus === "completed";

      if (isTripCompleted) {
        const isPaidOrSettled =
          !b.ride.charge ||
          b.ride.charge <= 0 ||
          !b.payment ||
          b.payment.status === "PAID" ||
          b.payment.status === "REFUNDED" ||
          b.payment.status === "CANCELLED" ||
          b.paymentStatus === "SETTLED" ||
          (b.payment.amountPaid > 0 && (!b.payment.remainingAmount || b.payment.remainingAmount <= 0));

        if (isPaidOrSettled) return false;

        return true;
      }

      if (b.ride.status === "cancelled" || b.status === "cancelled" || b.status === "declined") {
        return b.payment && b.payment.status === "REFUND_REQUESTED";
      }
      return true;
    });

  res.json({ success: true, data: { posted, requested: requestedData } });
});

const requestSeat = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const riderKey = String(me._id);
  if (pendingSeatRequests.has(riderKey)) {
    return res.status(409).json({ success: false, message: "A seat request is already being processed. Please wait a moment." });
  }
  pendingSeatRequests.add(riderKey);

  try {
    const seatCount =
      req.body.seats === undefined || req.body.seats === null || req.body.seats === ""
        ? 1
        : Number(req.body.seats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 8) {
      return res.status(400).json({ success: false, message: "Seats must be a whole number between 1 and 8" });
    }

    const ride = await Ride.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
    if (ride.status !== "open") {
      return res.status(400).json({ success: false, message: "This ride is no longer open" });
    }

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
    const vehicleRide = await VehicleRide.findOne({ ride: ride._id });
    const effectiveTotalSeats = Math.max(ride.seats, vehicleRide?.allocatedSeats || 0);
    if (ride.seats < effectiveTotalSeats) {
      ride.seats = effectiveTotalSeats;
      await ride.save();
    }
    if (booked + seatCount > effectiveTotalSeats) {
      return res.status(400).json({ success: false, message: "Not enough seats left on this ride" });
    }

    const activeBookingInfo = await findActiveBookingForRider(me._id);
    if (activeBookingInfo && String(activeBookingInfo.ride._id) !== String(ride._id)) {
      if (activeBookingInfo.isDriver) {
        return res.status(400).json({
          success: false,
          message: `You are currently the driver of an active ride from ${activeBookingInfo.ride.pickup} to ${activeBookingInfo.ride.dropoff}. You cannot book another ride until your ride is completed or cancelled.`,
          activeRide: {
            _id: activeBookingInfo.ride._id,
            pickup: activeBookingInfo.ride.pickup,
            dropoff: activeBookingInfo.ride.dropoff,
            status: "accepted",
            tripStatus: activeBookingInfo.tripStatus,
          },
        });
      }

      if (activeBookingInfo.booking.status === "accepted") {
        return res.status(400).json({
          success: false,
          message: `You already have an active booked ride from ${activeBookingInfo.ride.pickup} to ${activeBookingInfo.ride.dropoff}. You cannot book another ride until your current ride is completed.`,
          activeRide: {
            _id: activeBookingInfo.ride._id,
            pickup: activeBookingInfo.ride.pickup,
            dropoff: activeBookingInfo.ride.dropoff,
            status: activeBookingInfo.booking.status,
            tripStatus: activeBookingInfo.tripStatus,
          },
        });
      }

      if (activeBookingInfo.booking.status === "pending") {
        return res.status(400).json({
          success: false,
          message: `You already have a pending seat request for a ride from ${activeBookingInfo.ride.pickup} to ${activeBookingInfo.ride.dropoff}. Please cancel that request before booking another ride.`,
          activeRide: {
            _id: activeBookingInfo.ride._id,
            pickup: activeBookingInfo.ride.pickup,
            dropoff: activeBookingInfo.ride.dropoff,
            status: activeBookingInfo.booking.status,
            tripStatus: activeBookingInfo.tripStatus,
          },
        });
      }
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
  } finally {
    pendingSeatRequests.delete(riderKey);
  }
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
    const vehicleRide = await VehicleRide.findOne({ ride: ride._id });
    const effectiveTotalSeats = Math.max(ride.seats, vehicleRide?.allocatedSeats || 0);
    if (ride.seats < effectiveTotalSeats) {
      ride.seats = effectiveTotalSeats;
      await ride.save();
    }
    if (booked + (booking.seats || 1) > effectiveTotalSeats) {
      return res.status(400).json({ success: false, message: "Not enough seats left on this ride" });
    }

    const activeBooking = await findActiveBookingForRider(booking.rider);
    if (
      activeBooking &&
      String(activeBooking.ride._id) !== String(ride._id) &&
      activeBooking.booking.status === "accepted"
    ) {
      return res.status(400).json({
        success: false,
        message: `This rider is already confirmed on another active ride (from ${activeBooking.ride.pickup} to ${activeBooking.ride.dropoff}).`,
      });
    }
  }

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "pending" },
    { $set: { status: decision, ...(decision === "accepted" ? { acceptedAt: new Date() } : {}) } },
    { new: true }
  );

  if (decision === "accepted") {
    await Booking.updateMany(
      { rider: booking.rider, _id: { $ne: booking._id }, status: "pending" },
      { $set: { status: "cancelled", cancelReason: "Auto-cancelled: rider confirmed on another ride" } }
    );
  }

  if (decision === "accepted" && ride.charge > 0) {
    await syncRidePaymentsWithCostSplit(ride._id);
  }

  const confirmedCount = await Booking.countDocuments({ ride: ride._id, status: "accepted" });
  const dynamicShare = confirmedCount > 0 ? roundMoney(Number(ride.charge || 0) / confirmedCount) : Number(ride.charge || 0);

  if (decision === "accepted") {
    await createNotification({
      recipientRole: "user",
      recipient: booking.rider,
      type: "REQUEST_ACCEPTED",
      title: "Ride request accepted",
      body: `Your ride request from ${ride.pickup} to ${ride.dropoff} has been accepted.`,
      tone: "success",
      referenceId: ride._id,
      data: {
        rideId: ride._id,
        actorName: me.name,
        decision,
        amount: ride.charge ? dynamicShare : 0,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
      },
    });
  } else {
    await createNotification({
      recipientRole: "user",
      recipient: booking.rider,
      type: "REQUEST_DECLINED",
      title: "Seat Request Declined",
      body: `${me.name} declined your seat request.`,
      tone: "warn",
      referenceId: ride._id,
      data: {
        rideId: ride._id,
        actorName: me.name,
        decision,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
      },
    });
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

  if (!["pending", "accepted", "declined"].includes(booking.status)) {
    return res.status(400).json({ success: false, message: "Only an active or declined request can be cancelled" });
  }

  const previousStatus = booking.status;

  const { reason, refundAlreadyReceived } = req.body || {};
  const reasonTrimmed = reason ? String(reason).trim() : null;

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

  const fine = booking.status === "accepted" ? computePassengerCancelFine(booking.acceptedAt) : 0;

  const notifyDriverOfCancellation = async () => {
    if (String(ride.poster) === String(me._id)) return;
    if (previousStatus === "accepted") {
      await createNotification({
        recipientRole: "user",
        recipient: ride.poster,
        type: "PASSENGER_CANCELLED",
        title: "Passenger cancelled ride",
        body: `${me.name} cancelled their seat on the ride from ${ride.pickup} to ${ride.dropoff}.`,
        tone: "warn",
        referenceId: ride._id,
        data: {
          rideId: ride._id,
          actorName: me.name,
          reason: reasonText,
          pickup: ride.pickup,
          dropoff: ride.dropoff,
        },
      });
    } else if (previousStatus === "pending") {
      await createNotification({
        recipientRole: "user",
        recipient: ride.poster,
        type: "REQUEST_WITHDRAWN",
        title: "Ride request withdrawn",
        body: `${me.name} withdrew their seat request for the ride from ${ride.pickup} to ${ride.dropoff}.`,
        tone: "info",
        referenceId: ride._id,
        data: {
          rideId: ride._id,
          actorName: me.name,
          pickup: ride.pickup,
          dropoff: ride.dropoff,
        },
      });
    }
  };

  if (hasPaid) {
    if (refundAlreadyReceived === true) {
      payment.status = "REFUNDED";
      payment.refundConfirmedBy = me._id;
      payment.refundConfirmedAt = new Date();
      payment.remainingAmount = 0;
      payment.totalOutstanding = 0;
      payment.finalized = true;
      payment.finalizedBy = me._id;
      payment.finalizedAt = new Date();
      await payment.save();

      booking.status = "cancelled";
      booking.cancelReason = reasonText ? `${reasonText} (Refund confirmed by passenger)` : "Refund confirmed by passenger";
      await booking.save();

      const Transaction = require("../models/Transaction");
      const { generateTransactionId } = require("../utils/ridePaymentHelper");
      try {
        const refundTxnRef = `REFUND-${String(payment._id)}-${Date.now()}`;
        await Transaction.create({
          transactionId: await generateTransactionId(),
          payer: payment.receiver,
          receiver: payment.payer,
          amount: roundMoney(payment.amountPaid),
          ride: ride._id,
          payment: payment._id,
          paymentMethod: payment.paymentMethod || "MANUAL",
          kind: "REFUND",
          providerTransactionId: refundTxnRef,
          status: "COMPLETED",
        });
      } catch (err) {
        if (err.code !== 11000) console.error("Could not record refund transaction:", err.message);
      }

      notifyUser(ride.poster, {
        type: "REFUND_CONFIRMED",
        paymentId: payment._id,
        actorName: me.name,
        amount: roundMoney(payment.amountPaid),
        method: payment.paymentMethod || "MANUAL",
        ride: { _id: ride._id, pickup: ride.pickup, dropoff: ride.dropoff },
      });

      await syncRidePaymentsWithCostSplit(ride._id);

      await notifyDriverOfCancellation();

      return res.json({
        success: true,
        data: booking,
        refundConfirmed: true,
        fine,
        message: "Ride cancelled and refund confirmed.",
      });
    }

    payment.status = "REFUND_REQUESTED";
    payment.refundRequestedBy = me._id;
    payment.refundRequestedAt = new Date();
    await payment.save();

    booking.status = "cancelled";
    booking.cancelReason = reasonText;
    await booking.save();

    notifyUser(ride.poster, {
      type: "REFUND_REQUESTED",
      paymentId: payment._id,
      actorName: me.name,
      amount: roundMoney(payment.amountPaid),
      method: payment.paymentMethod,
      ride: { _id: ride._id, pickup: ride.pickup, dropoff: ride.dropoff },
    });

    await syncRidePaymentsWithCostSplit(ride._id);

    await notifyDriverOfCancellation();

    return res.json({
      success: true,
      data: booking,
      refundPending: true,
      fine,
      message: "Ride request cancelled and refund requested from driver.",
    });
  }

  booking.status = "cancelled";
  booking.cancelReason = reasonText;
  await booking.save();

  await syncRidePaymentsWithCostSplit(ride._id);

  if (payment && !TERMINAL_STATUSES.includes(payment.status)) {
    payment.status = "CANCELLED";
    payment.remainingAmount = 0;
    payment.lateFee = 0;
    payment.totalOutstanding = 0;
    payment.cancelledAt = new Date();
    await payment.save();
  }

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

  await notifyDriverOfCancellation();

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

  const affectedBookings = await Booking.find({
    ride: ride._id,
    status: { $in: ["accepted", "pending"] },
  });

  const payments = await RidePayment.find({ ride: ride._id });
  for (const payment of payments) {
    await refreshPayment(payment);
  }

  const paidPayments = payments.filter(
    (p) => roundMoney((p.amountPaid || 0) + (p.lateFeePaid || 0)) > 0 && !["REFUNDED", "CANCELLED"].includes(p.status)
  );

  const earliestAccepted = await Booking.findOne({ ride: ride._id, acceptedAt: { $ne: null } })
    .sort({ acceptedAt: 1 })
    .select("acceptedAt");
  const cancellationFine = earliestAccepted ? computeCancellationFine(earliestAccepted.acceptedAt) : 0;

  if (paidPayments.length > 0) {
    const trimmedReason = (cancelReason || reason ? String(cancelReason || reason).trim() : "") || "Ride cancelled by driver";

    ride.status = "pending_cancellation";
    ride.cancelReason = trimmedReason;
    ride.cancellationFine = cancellationFine;
    await ride.save();

    for (const payment of paidPayments) {
      payment.status = "REFUND_REQUESTED";
      payment.refundRequestedBy = me._id;
      payment.refundRequestedAt = new Date();
      payment.refundMethod = refundMethod || "MANUAL";
      payment.refundTransactionId = refundTransactionId ? String(refundTransactionId).trim() : null;
      payment.note = `Driver cancelled ride: ${reasonText}`;
      await payment.save();

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
    ride.status = "cancelled";
    ride.cancelReason = reasonText;
    ride.cancellationFine = cancellationFine;
    await ride.save();

    await Booking.updateMany(
      { ride: ride._id, status: { $in: ["pending", "accepted", "declined"] } },
      { $set: { status: "cancelled", cancelReason: reasonText } }
    );
  }

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

  const acceptedRiderIds = new Set();
  const pendingRiderIds = new Set();
  for (const b of affectedBookings) {
    const riderId = String(b.rider);
    if (riderId === String(me._id)) continue;
    if (b.status === "accepted") {
      acceptedRiderIds.add(riderId);
    } else if (b.status === "pending") {
      pendingRiderIds.add(riderId);
    }
  }
  for (const riderId of acceptedRiderIds) {
    pendingRiderIds.delete(riderId);
  }

  for (const riderId of acceptedRiderIds) {
    await createNotification({
      recipientRole: "user",
      recipient: riderId,
      type: "RIDE_CANCELLED",
      title: "Ride cancelled",
      body: `The ride from ${ride.pickup} to ${ride.dropoff} was cancelled by ${me.name}.`,
      tone: "danger",
      referenceId: ride._id,
      data: {
        rideId: ride._id,
        actorName: me.name,
        reason: reasonText,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
      },
    });
  }

  for (const riderId of pendingRiderIds) {
    await createNotification({
      recipientRole: "user",
      recipient: riderId,
      type: "RIDE_UNAVAILABLE",
      title: "Ride no longer available",
      body: `The ride from ${ride.pickup} to ${ride.dropoff} has been cancelled by the host.`,
      tone: "warn",
      referenceId: ride._id,
      data: {
        rideId: ride._id,
        actorName: me.name,
        reason: reasonText,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
      },
    });
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

  const { pickup, dropoff, departureTime, seats, notes, pickupLat, pickupLng, dropoffLat, dropoffLng, charge, registrationNumber } = req.body || {};

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
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 8) {
      return res.status(400).json({ success: false, message: "Seats must be a whole number between 1 and 8" });
    }
    if (seatCount < acceptedSeats) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce seats below already accepted seats (${acceptedSeats})`,
      });
    }
    ride.seats = seatCount;
    await VehicleRide.updateOne({ ride: ride._id }, { $set: { allocatedSeats: seatCount } });
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

  if (registrationNumber !== undefined) {
    const regTrimmed = String(registrationNumber || "").trim();
    const regCheck = validateRegistrationPlate(regTrimmed);
    if (!regCheck.valid) {
      return res.status(400).json({
        success: false,
        message: regCheck.message || "Enter a valid Bangladesh vehicle registration number (e.g. Dhaka Metro-Ga 12-3456 or Gazipur-Ga 11-2456).",
      });
    }
    await VehicleRide.updateOne({ ride: ride._id }, { $set: { registrationNumber: regCheck.canonical } });
  }

  const finalPickupLat = pickupLat !== undefined ? pickupLat : ride.pickupLat;
  const finalPickupLng = pickupLng !== undefined ? pickupLng : ride.pickupLng;
  const finalDropoffLat = dropoffLat !== undefined ? dropoffLat : ride.dropoffLat;
  const finalDropoffLng = dropoffLng !== undefined ? dropoffLng : ride.dropoffLng;

  if (finalPickupLat != null || finalPickupLng != null) {
    if (!isInsideDhakaCoverage(finalPickupLat, finalPickupLng)) {
      return res.status(400).json({ success: false, message: "Pickup and destination must be within the Campus Ride service area (Dhaka, Gazipur and Narayanganj)." });
    }
  }

  if (finalDropoffLat != null || finalDropoffLng != null) {
    if (!isInsideDhakaCoverage(finalDropoffLat, finalDropoffLng)) {
      return res.status(400).json({ success: false, message: "Pickup and destination must be within the Campus Ride service area (Dhaka, Gazipur and Narayanganj)." });
    }
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
  if (!Number.isInteger(newSeats) || newSeats < 1 || newSeats > 8) {
    return res.status(400).json({ success: false, message: "Seats must be a whole number between 1 and 8" });
  }

  const currentSeats = booking.seats || 1;
  if (newSeats === currentSeats) {
    return res.json({ success: true, data: booking });
  }

  const vehicleRide = await VehicleRide.findOne({ ride: ride._id });
  const effectiveTotalSeats = Math.max(ride.seats, vehicleRide?.allocatedSeats || 0);
  if (ride.seats < effectiveTotalSeats) {
    ride.seats = effectiveTotalSeats;
    await ride.save();
  }

  const bookedAgg = await Booking.aggregate([
    { $match: { ride: ride._id, _id: { $ne: booking._id }, status: "accepted" } },
    { $group: { _id: null, count: { $sum: "$seats" } } },
  ]);
  const otherBooked = bookedAgg[0] ? bookedAgg[0].count : 0;
  if (otherBooked + newSeats > effectiveTotalSeats) {
    return res.status(400).json({ success: false, message: "Not enough seats available on this ride" });
  }

  booking.seats = newSeats;
  await booking.save();

  let payment = await RidePayment.findOne({ ride: ride._id, payer: me._id });
  if (payment) {
    await refreshPayment(payment);
    const perRider = seatCharge(ride.charge);
    const alreadyPaid = roundMoney(payment.amountPaid || 0);
    const paidSeatsCount = perRider > 0 ? Math.floor(alreadyPaid / perRider) : (payment.status === "PAID" ? currentSeats : 0);

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

  await syncRidePaymentsWithCostSplit(ride._id);

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

