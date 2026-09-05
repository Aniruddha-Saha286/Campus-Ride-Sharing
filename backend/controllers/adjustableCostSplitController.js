const mongoose = require("mongoose");
const AdjustableCostSplit = require("../models/AdjustableCostSplit");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const asyncHandler = require("../utils/asyncHandler");
const { findMe, formatPublicStudent } = require("../utils/studentHelper");
const { notifyUser } = require("../utils/notifier");

const roundMoney = (val) => Math.round((Number(val) + Number.EPSILON) * 100) / 100;

/**
 * @desc    Get adjustable cost split details for a ride
 * @route   GET /api/adjustable-cost-split/ride/:rideId
 * @access  Private (Authenticated student)
 */
const getAdjustableSplit = asyncHandler(async (req, res) => {
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

  const splitDoc = await AdjustableCostSplit.syncRideSplit(ride._id);
  if (!splitDoc) {
    return res.status(500).json({ success: false, message: "Failed to load cost split" });
  }

  await splitDoc.populate(
    "riders.rider",
    "name department year profilePhoto phone idVerificationStatus"
  );

  const isDriver = String(ride.poster._id || ride.poster) === String(me._id);
  const myEntry = splitDoc.riders.find(
    (r) => String(r.rider?._id || r.rider) === String(me._id)
  );

  res.json({
    success: true,
    data: {
      _id: splitDoc._id,
      rideId: ride._id,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      departureTime: ride.departureTime,
      driver: formatPublicStudent(ride.poster),
      totalTripCost: splitDoc.totalTripCost,
      splitMode: splitDoc.splitMode, // "EQUAL" or "CUSTOM"
      isOverridden: splitDoc.splitMode === "CUSTOM",
      costPerRider: splitDoc.costPerRider,
      confirmedRidersCount: splitDoc.confirmedRidersCount,
      riders: splitDoc.riders.map((r) => ({
        rider: formatPublicStudent(r.rider),
        seats: r.seats,
        splitShare: r.splitShare,
        isCustom: Boolean(r.isCustom),
        customNote: r.customNote || "",
        status: r.status,
        overriddenAt: r.overriddenAt,
      })),
      isDriver,
      myShare: myEntry ? myEntry.splitShare : isDriver ? 0 : splitDoc.costPerRider,
      myShareIsCustom: myEntry ? Boolean(myEntry.isCustom) : false,
      lastOverriddenAt: splitDoc.lastOverriddenAt,
    },
  });
});

/**
 * @desc    Driver manually overrides the default equal split and sets custom cost shares for individual riders
 * @route   PUT /api/adjustable-cost-split/ride/:rideId/custom-shares
 * @access  Private (Ride Poster only)
 */
const setCustomShares = asyncHandler(async (req, res) => {
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
    return res.status(403).json({
      success: false,
      message: "Only the student who posted the ride can override cost shares for riders",
    });
  }

  const { shares, reason } = req.body || {};
  if (!Array.isArray(shares) || shares.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of custom rider shares: [{ riderId, amount }]",
    });
  }

  // Validate custom amounts
  for (const s of shares) {
    if (!s.riderId || !mongoose.isValidObjectId(s.riderId)) {
      return res.status(400).json({ success: false, message: "Valid riderId is required for each custom share" });
    }
    const amt = Number(s.amount);
    if (isNaN(amt) || amt < 0) {
      return res.status(400).json({ success: false, message: "Custom share amount must be a non-negative number" });
    }
  }

  const splitDoc = await AdjustableCostSplit.syncRideSplit(ride._id, shares);
  if (reason && reason.trim()) {
    splitDoc.overrideReason = reason.trim();
    await splitDoc.save();
  }

  await splitDoc.populate(
    "riders.rider",
    "name department year profilePhoto phone idVerificationStatus"
  );

  // Notify each overridden rider in real time
  for (const s of shares) {
    notifyUser(s.riderId, {
      type: "CUSTOM_COST_SHARE_SET",
      rideId: ride._id,
      actorName: me.name,
      amount: roundMoney(Number(s.amount)),
      message: `The driver customized your trip cost share to ৳${roundMoney(Number(s.amount))}${s.note ? ` (${s.note})` : ""}.`,
    });
  }

  res.json({
    success: true,
    message: "Custom cost shares set successfully. Default equal split overridden.",
    data: {
      splitMode: splitDoc.splitMode,
      totalTripCost: splitDoc.totalTripCost,
      confirmedRidersCount: splitDoc.confirmedRidersCount,
      riders: splitDoc.riders.map((r) => ({
        rider: formatPublicStudent(r.rider),
        splitShare: r.splitShare,
        isCustom: r.isCustom,
        customNote: r.customNote,
      })),
    },
  });
});

/**
 * @desc    Driver manually overrides a single rider's cost share
 * @route   PUT /api/adjustable-cost-split/ride/:rideId/riders/:riderId
 * @access  Private (Ride Poster only)
 */
const setSingleRiderShare = asyncHandler(async (req, res) => {
  const { rideId, riderId } = req.params;
  const { amount, note } = req.body || {};

  if (!mongoose.isValidObjectId(rideId) || !mongoose.isValidObjectId(riderId)) {
    return res.status(400).json({ success: false, message: "Invalid ID parameters" });
  }

  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Student profile not found" });

  const ride = await Ride.findById(rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  if (String(ride.poster) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the ride poster can set custom shares" });
  }

  const customAmount = Number(amount);
  if (isNaN(customAmount) || customAmount < 0) {
    return res.status(400).json({ success: false, message: "Cost share amount must be a non-negative number" });
  }

  const splitDoc = await AdjustableCostSplit.syncRideSplit(ride._id, [
    { riderId, amount: customAmount, note: note || "" },
  ]);

  await splitDoc.populate(
    "riders.rider",
    "name department year profilePhoto phone idVerificationStatus"
  );

  notifyUser(riderId, {
    type: "CUSTOM_COST_SHARE_SET",
    rideId: ride._id,
    actorName: me.name,
    amount: roundMoney(customAmount),
    message: `The driver customized your trip cost share to ৳${roundMoney(customAmount)}.`,
  });

  res.json({
    success: true,
    message: `Rider's cost share overridden to ৳${roundMoney(customAmount)}.`,
    data: splitDoc,
  });
});

/**
 * @desc    Driver resets custom shares back to default equal split
 * @route   POST /api/adjustable-cost-split/ride/:rideId/reset-equal
 * @access  Private (Ride Poster only)
 */
const resetToEqualSplit = asyncHandler(async (req, res) => {
  const { rideId } = req.params;
  if (!mongoose.isValidObjectId(rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride ID" });
  }

  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Student profile not found" });

  const ride = await Ride.findById(rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  if (String(ride.poster) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the ride poster can reset the split mode" });
  }

  let splitDoc = await AdjustableCostSplit.findOne({ ride: ride._id });
  if (!splitDoc) {
    splitDoc = await AdjustableCostSplit.syncRideSplit(ride._id);
  }

  splitDoc.splitMode = "EQUAL";
  splitDoc.overrideReason = "";
  await splitDoc.save();

  // Re-sync with equal division
  const updated = await AdjustableCostSplit.syncRideSplit(ride._id);

  // Notify riders that split has returned to default equal division
  const confirmedBookings = await Booking.find({ ride: ride._id, status: "accepted" });
  for (const b of confirmedBookings) {
    notifyUser(b.rider, {
      type: "SPLIT_RESET_EQUAL",
      rideId: ride._id,
      actorName: me.name,
      amount: updated.costPerRider,
      message: `The driver reset the trip cost to the default equal split (৳${updated.costPerRider} each).`,
    });
  }

  res.json({
    success: true,
    message: "Split mode reset to default equal split.",
    data: {
      splitMode: updated.splitMode,
      costPerRider: updated.costPerRider,
      confirmedRidersCount: updated.confirmedRidersCount,
    },
  });
});

module.exports = {
  getAdjustableSplit,
  setCustomShares,
  setSingleRiderShare,
  resetToEqualSplit,
};
