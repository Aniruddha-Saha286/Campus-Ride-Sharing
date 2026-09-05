const mongoose = require("mongoose");
const AutoCostSplit = require("../models/AutoCostSplit");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const Student = require("../models/Student");
const asyncHandler = require("../utils/asyncHandler");
const { findMe, formatPublicStudent } = require("../utils/studentHelper");
const { notifyUser } = require("../utils/notifier");

/**
 * Helper to round monetary amounts to 2 decimal places.
 */
const roundMoney = (val) => Math.round((Number(val) + Number.EPSILON) * 100) / 100;

/**
 * @desc    Get automatic cost split details for a specific ride
 * @route   GET /api/auto-cost-split/ride/:rideId
 * @access  Private (Authenticated student)
 */
const getRideSplit = asyncHandler(async (req, res) => {
  const { rideId } = req.params;
  if (!mongoose.isValidObjectId(rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride ID" });
  }

  const me = await findMe(req);
  if (!me) {
    return res.status(404).json({ success: false, message: "Student profile not found" });
  }

  const ride = await Ride.findById(rideId).populate(
    "poster",
    "name department year profilePhoto phone idVerificationStatus"
  );
  if (!ride) {
    return res.status(404).json({ success: false, message: "Ride not found" });
  }

  // Recalculate to ensure real-time consistency with confirmed bookings
  const splitDoc = await AutoCostSplit.recalculateSplit(ride._id);
  if (!splitDoc) {
    return res.status(500).json({ success: false, message: "Failed to calculate cost split" });
  }

  // Populate confirmed riders info
  await splitDoc.populate(
    "confirmedRiders.rider",
    "name department year profilePhoto phone idVerificationStatus"
  );

  const isDriver = String(ride.poster._id || ride.poster) === String(me._id);
  const myBooking = splitDoc.confirmedRiders.find(
    (r) => String(r.rider?._id || r.rider) === String(me._id)
  );
  const isConfirmedRider = Boolean(myBooking);

  const totalCost = splitDoc.totalTripCost;
  const count = splitDoc.confirmedRidersCount;
  const costPerRider = splitDoc.costPerRider;

  const savingsPerRider = count > 1 ? roundMoney(totalCost - costPerRider) : 0;
  const savingsPercent = totalCost > 0 && count > 1
    ? Math.round(((totalCost - costPerRider) / totalCost) * 100)
    : 0;

  // Build progressive tier preview (1 to ride.seats)
  const tiers = [];
  const maxSeats = ride.seats || 4;
  for (let n = 1; n <= Math.max(maxSeats, count, 4); n += 1) {
    const tierCost = roundMoney(totalCost / n);
    const tierSave = totalCost > 0 ? Math.round(((totalCost - tierCost) / totalCost) * 100) : 0;
    tiers.push({
      riderCount: n,
      costPerRider: tierCost,
      savingsPercent: tierSave,
      isCurrentTier: n === count,
    });
  }

  res.json({
    success: true,
    data: {
      _id: splitDoc._id,
      rideId: ride._id,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      departureTime: ride.departureTime,
      rideStatus: ride.status,
      seats: ride.seats,
      driver: formatPublicStudent(ride.poster),
      totalTripCost: totalCost,
      splitMode: splitDoc.splitMode, // "EQUAL" by default
      costPerRider,
      confirmedRidersCount: count,
      confirmedRiders: splitDoc.confirmedRiders.map((item) => ({
        rider: formatPublicStudent(item.rider),
        seats: item.seats,
        splitShare: item.splitShare,
        status: item.status,
        confirmedAt: item.confirmedAt,
      })),
      savingsPerRider,
      savingsPercent,
      tiers,
      history: splitDoc.history,
      isDriver,
      isConfirmedRider,
      myShare: isConfirmedRider ? myBooking.splitShare : isDriver ? 0 : costPerRider,
    },
  });
});

/**
 * @desc    Update total trip cost (Driver only) and recalculate equal split automatically
 * @route   PUT /api/auto-cost-split/ride/:rideId/total-cost
 * @access  Private (Driver only)
 */
const updateTotalCost = asyncHandler(async (req, res) => {
  const { rideId } = req.params;
  if (!mongoose.isValidObjectId(rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride ID" });
  }

  const me = await findMe(req);
  if (!me) {
    return res.status(404).json({ success: false, message: "Student profile not found" });
  }

  const ride = await Ride.findById(rideId);
  if (!ride) {
    return res.status(404).json({ success: false, message: "Ride not found" });
  }

  if (String(ride.poster) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the ride poster can update the total trip cost" });
  }

  const { totalTripCost } = req.body || {};
  if (totalTripCost === undefined || totalTripCost === null || isNaN(Number(totalTripCost)) || Number(totalTripCost) < 0) {
    return res.status(400).json({ success: false, message: "Total trip cost must be a non-negative number" });
  }

  const newTotalCost = roundMoney(Number(totalTripCost));

  // Sync ride charge
  ride.charge = newTotalCost;
  await ride.save();

  // Recalculate equal split among confirmed riders
  const splitDoc = await AutoCostSplit.recalculateSplit(ride._id, {
    totalTripCost: newTotalCost,
    event: "COST_UPDATED",
  });

  await splitDoc.populate(
    "confirmedRiders.rider",
    "name department year profilePhoto phone idVerificationStatus"
  );

  // Notify all confirmed riders of the updated equal share
  const confirmedBookings = await Booking.find({ ride: ride._id, status: "accepted" });
  for (const booking of confirmedBookings) {
    notifyUser(booking.rider, {
      type: "COST_SPLIT_UPDATED",
      rideId: ride._id,
      totalTripCost: newTotalCost,
      costPerRider: splitDoc.costPerRider,
      confirmedCount: splitDoc.confirmedRidersCount,
      actorName: me.name,
      message: `The total cost for ride from ${ride.pickup} to ${ride.dropoff} was updated to ৳${newTotalCost}. Your equal split is now ৳${splitDoc.costPerRider}.`,
    });
  }

  res.json({
    success: true,
    message: `Total trip cost updated to ৳${newTotalCost}. Cost divided equally among ${splitDoc.confirmedRidersCount} confirmed rider(s): ৳${splitDoc.costPerRider} each.`,
    data: {
      totalTripCost: splitDoc.totalTripCost,
      splitMode: splitDoc.splitMode,
      costPerRider: splitDoc.costPerRider,
      confirmedRidersCount: splitDoc.confirmedRidersCount,
      confirmedRiders: splitDoc.confirmedRiders.map((item) => ({
        rider: formatPublicStudent(item.rider),
        seats: item.seats,
        splitShare: item.splitShare,
        status: item.status,
      })),
    },
  });
});

/**
 * @desc    Get all active cost splits for the logged-in student (as driver or confirmed rider)
 * @route   GET /api/auto-cost-split/mine
 * @access  Private (Authenticated student)
 */
const getMySplits = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) {
    return res.status(404).json({ success: false, message: "Student profile not found" });
  }

  // Find splits where user is driver OR a confirmed rider
  const splits = await AutoCostSplit.find({
    $or: [{ driver: me._id }, { "confirmedRiders.rider": me._id }],
  })
    .populate("ride", "pickup dropoff departureTime seats charge status")
    .populate("driver", "name department year profilePhoto idVerificationStatus")
    .populate("confirmedRiders.rider", "name department year profilePhoto idVerificationStatus")
    .sort({ updatedAt: -1 })
    .limit(20);

  const data = splits.map((s) => {
    const isDriver = String(s.driver?._id || s.driver) === String(me._id);
    const myRiderEntry = s.confirmedRiders.find(
      (r) => String(r.rider?._id || r.rider) === String(me._id)
    );
    return {
      _id: s._id,
      ride: s.ride,
      driver: formatPublicStudent(s.driver),
      totalTripCost: s.totalTripCost,
      splitMode: s.splitMode,
      costPerRider: s.costPerRider,
      confirmedRidersCount: s.confirmedRidersCount,
      isDriver,
      myShare: myRiderEntry ? myRiderEntry.splitShare : isDriver ? 0 : s.costPerRider,
      status: myRiderEntry ? myRiderEntry.status : "ACTIVE",
      updatedAt: s.updatedAt,
    };
  });

  res.json({ success: true, data });
});

/**
 * @desc    Preview equal cost split progression for any trip cost
 * @route   POST /api/auto-cost-split/preview
 * @access  Public / Private
 */
const previewSplit = asyncHandler(async (req, res) => {
  const { totalCost = 300, maxSeats = 4 } = req.body || {};
  const cost = Math.max(0, Number(totalCost) || 0);
  const seats = Math.min(6, Math.max(1, Number(maxSeats) || 4));

  const tiers = [];
  for (let n = 1; n <= seats; n += 1) {
    const perRider = roundMoney(cost / n);
    const saved = cost > 0 ? Math.round(((cost - perRider) / cost) * 100) : 0;
    tiers.push({
      riders: n,
      costPerRider: perRider,
      totalCost: cost,
      savingsPercent: saved,
      label: `${n} rider${n > 1 ? "s" : ""}: ৳${perRider} each (${saved}% saved)`,
    });
  }

  res.json({
    success: true,
    data: {
      totalCost: cost,
      splitMode: "EQUAL",
      rule: "The total trip cost is automatically divided equally among all confirmed riders by default",
      tiers,
    },
  });
});

/**
 * @desc    Confirmed rider acknowledges/confirms their equal share
 * @route   POST /api/auto-cost-split/ride/:rideId/confirm
 * @access  Private (Confirmed rider)
 */
const confirmRiderShare = asyncHandler(async (req, res) => {
  const { rideId } = req.params;
  const me = await findMe(req);
  if (!me) {
    return res.status(404).json({ success: false, message: "Student profile not found" });
  }

  const splitDoc = await AutoCostSplit.findOne({ ride: rideId });
  if (!splitDoc) {
    return res.status(404).json({ success: false, message: "Cost split record not found for this ride" });
  }

  const riderIndex = splitDoc.confirmedRiders.findIndex(
    (r) => String(r.rider) === String(me._id)
  );
  if (riderIndex === -1) {
    return res.status(403).json({ success: false, message: "You are not an accepted rider on this ride" });
  }

  splitDoc.confirmedRiders[riderIndex].status = "CONFIRMED";
  await splitDoc.save();

  res.json({
    success: true,
    message: `You confirmed your equal share of ৳${splitDoc.confirmedRiders[riderIndex].splitShare}.`,
    data: splitDoc.confirmedRiders[riderIndex],
  });
});

module.exports = {
  getRideSplit,
  updateTotalCost,
  getMySplits,
  previewSplit,
  confirmRiderShare,
};
