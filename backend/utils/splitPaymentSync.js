const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const RidePayment = require("../models/RidePayment");
const AutoCostSplit = require("../models/AutoCostSplit");
const AdjustableCostSplit = require("../models/AdjustableCostSplit");

const roundMoney = (val) => Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;

const syncRidePaymentsWithCostSplit = async (rideId) => {
  if (!mongoose.isValidObjectId(rideId)) return [];

  const ride = await Ride.findById(rideId);
  if (!ride) return [];

  const confirmedBookings = await Booking.find({
    ride: ride._id,
    status: "accepted",
  });

  const count = confirmedBookings.length;
  const totalCost = roundMoney(ride.charge || 0);

  let customMap = new Map();
  let splitMode = "EQUAL";
  try {
    if (AdjustableCostSplit && typeof AdjustableCostSplit.syncRideSplit === "function") {
      const adjDoc = await AdjustableCostSplit.syncRideSplit(ride._id);
      if (adjDoc && adjDoc.splitMode === "CUSTOM" && Array.isArray(adjDoc.riders)) {
        splitMode = "CUSTOM";
        adjDoc.riders.forEach((r) => {
          customMap.set(String(r.rider?._id || r.rider), roundMoney(r.splitShare));
        });
      }
    }
  } catch (err) {}

  try {
    if (AutoCostSplit && typeof AutoCostSplit.recalculateSplit === "function") {
      await AutoCostSplit.recalculateSplit(ride._id);
    }
  } catch (err) {}

  const defaultEqualShare = count > 0 ? roundMoney(totalCost / count) : totalCost;
  const updatedPayments = [];

  for (const booking of confirmedBookings) {
    const riderId = String(booking.rider?._id || booking.rider);
    const splitShare =
      splitMode === "CUSTOM" && customMap.has(riderId)
        ? customMap.get(riderId)
        : defaultEqualShare;

    const payerId = booking.rider?._id || booking.rider;
    let payment = await RidePayment.findOne({ ride: ride._id, payer: payerId });

    if (!payment) {
      payment = new RidePayment({
        ride: ride._id,
        payer: payerId,
        receiver: ride.poster,
        seats: booking.seats || 1,
        originalAmount: splitShare,
        amountPaid: 0,
        remainingAmount: splitShare,
        totalOutstanding: splitShare,
        status: splitShare > 0 ? "PENDING" : "PAID",
      });
    } else {
      if (payment.status === "REFUNDED" || payment.status === "CANCELLED") {
        continue;
      }

      payment.originalAmount = splitShare;
      payment.seats = booking.seats || 1;
      const paid = roundMoney(payment.amountPaid || 0);
      const remaining = Math.max(0, roundMoney(splitShare - paid));

      payment.remainingAmount = remaining;
      payment.totalOutstanding = remaining;

      if (payment.status !== "REFUND_REQUESTED") {
        if (paid >= splitShare && splitShare > 0) {
          payment.status = "PAID";
        } else if (paid > 0 && paid < splitShare) {
          payment.status = "PARTIAL";
        } else if (splitShare === 0) {
          payment.status = "PAID";
        } else {
          payment.status = "PENDING";
        }
      }
    }

    await payment.save();
    updatedPayments.push(payment);
  }

  return updatedPayments;
};

module.exports = {
  syncRidePaymentsWithCostSplit,
};
