const mongoose = require("mongoose");

const riderShareSchema = new mongoose.Schema(
  {
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    seats: {
      type: Number,
      default: 1,
      min: 1,
      max: 6,
    },
    splitShare: {
      type: Number,
      required: true,
      min: 0,
    },
    isCustom: {
      type: Boolean,
      default: false, // false = default equal split, true = manually overridden by driver
    },
    customNote: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "PAID"],
      default: "PENDING",
    },
    overriddenAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const adjustableCostSplitSchema = new mongoose.Schema(
  {
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      unique: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    totalTripCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    splitMode: {
      type: String,
      enum: ["EQUAL", "CUSTOM"],
      default: "EQUAL", // Default is equal division; driver can manually override to CUSTOM
    },
    costPerRider: {
      type: Number,
      default: 0,
      min: 0,
    },
    confirmedRidersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    riders: {
      type: [riderShareSchema],
      default: [],
    },
    overrideReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    lastOverriddenAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

adjustableCostSplitSchema.index({ driver: 1 });
adjustableCostSplitSchema.index({ "riders.rider": 1 });

/**
 * Recalculate or synchronize split.
 * If splitMode === "EQUAL", divides equally.
 * If splitMode === "CUSTOM", preserves driver overrides for existing riders and equally splits remaining for new ones.
 */
adjustableCostSplitSchema.statics.syncRideSplit = async function (rideId, customOverrides = null) {
  const Ride = mongoose.model("Ride");
  const Booking = mongoose.model("Booking");

  const ride = await Ride.findById(rideId);
  if (!ride) return null;

  const confirmedBookings = await Booking.find({
    ride: ride._id,
    status: "accepted",
  }).populate("rider", "name department year profilePhoto phone idVerificationStatus");

  let splitDoc = await this.findOne({ ride: ride._id });
  const totalCost = ride.charge || 0;
  const count = confirmedBookings.length;
  const equalShare = count > 0 ? Math.round((totalCost / count) * 100) / 100 : totalCost;

  if (!splitDoc) {
    splitDoc = new this({
      ride: ride._id,
      driver: ride.poster,
      totalTripCost: totalCost,
      splitMode: "EQUAL",
      costPerRider: equalShare,
      confirmedRidersCount: count,
      riders: confirmedBookings.map((b) => ({
        rider: b.rider._id,
        booking: b._id,
        seats: b.seats || 1,
        splitShare: equalShare,
        isCustom: false,
        status: b.paymentStatus === "SETTLED" ? "PAID" : "PENDING",
      })),
    });
  }

  splitDoc.totalTripCost = totalCost;
  splitDoc.confirmedRidersCount = count;

  if (customOverrides && Array.isArray(customOverrides)) {
    // Driver manually overriding specific rider shares
    splitDoc.splitMode = "CUSTOM";
    splitDoc.lastOverriddenAt = new Date();

    const overrideMap = new Map(
      customOverrides.map((o) => [String(o.riderId), { amount: Number(o.amount), note: o.note || "" }])
    );

    splitDoc.riders = confirmedBookings.map((b) => {
      const override = overrideMap.get(String(b.rider._id));
      if (override && !isNaN(override.amount) && override.amount >= 0) {
        return {
          rider: b.rider._id,
          booking: b._id,
          seats: b.seats || 1,
          splitShare: Math.round((override.amount + Number.EPSILON) * 100) / 100,
          isCustom: true,
          customNote: override.note,
          status: b.paymentStatus === "SETTLED" ? "PAID" : "PENDING",
          overriddenAt: new Date(),
        };
      }
      // Check existing custom share if already set
      const existing = splitDoc.riders.find((r) => String(r.rider) === String(b.rider._id));
      if (existing && existing.isCustom) {
        return existing;
      }
      return {
        rider: b.rider._id,
        booking: b._id,
        seats: b.seats || 1,
        splitShare: equalShare,
        isCustom: false,
        status: b.paymentStatus === "SETTLED" ? "PAID" : "PENDING",
      };
    });
  } else if (splitDoc.splitMode === "EQUAL") {
    splitDoc.costPerRider = equalShare;
    splitDoc.riders = confirmedBookings.map((b) => ({
      rider: b.rider._id,
      booking: b._id,
      seats: b.seats || 1,
      splitShare: equalShare,
      isCustom: false,
      status: b.paymentStatus === "SETTLED" ? "PAID" : "PENDING",
    }));
  }

  await splitDoc.save();

  // Synchronize unpaid RidePayment records with active custom or restored shares
  try {
    if (mongoose.models.RidePayment) {
      const RidePayment = mongoose.model("RidePayment");
      for (const r of splitDoc.riders) {
        if (r.splitShare > 0) {
          await RidePayment.updateMany(
            {
              ride: ride._id,
              payer: r.rider,
              status: { $in: ["PENDING", "DUE"] },
              amountPaid: 0,
            },
            {
              $set: {
                originalAmount: r.splitShare,
                remainingAmount: r.splitShare,
                totalOutstanding: r.splitShare,
              },
            }
          );
        }
      }
    }
  } catch (e) {
    // Model may not be loaded in isolated tests
  }

  return splitDoc;
};

module.exports = mongoose.model("AdjustableCostSplit", adjustableCostSplitSchema);
