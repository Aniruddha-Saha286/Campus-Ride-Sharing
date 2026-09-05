const mongoose = require("mongoose");

const confirmedRiderSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "PAID"],
      default: "PENDING",
    },
    confirmedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const splitHistorySchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: ["INIT", "RIDER_JOINED", "RIDER_LEFT", "COST_UPDATED"],
      required: true,
    },
    totalTripCost: { type: Number, required: true },
    confirmedCount: { type: Number, required: true },
    costPerRider: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const autoCostSplitSchema = new mongoose.Schema(
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
      default: "EQUAL", // By default: automatically divided equally among all confirmed riders
    },
    costPerRider: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    confirmedRidersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    confirmedRiders: {
      type: [confirmedRiderSchema],
      default: [],
    },
    history: {
      type: [splitHistorySchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true }
);

autoCostSplitSchema.index({ driver: 1 });
autoCostSplitSchema.index({ "confirmedRiders.rider": 1 });

/**
 * Recalculates and updates the equal cost split for a ride based on currently confirmed (accepted) bookings.
 * Total trip cost is automatically divided equally among all confirmed riders by default.
 */
autoCostSplitSchema.statics.recalculateSplit = async function (rideId, options = {}) {
  const Ride = mongoose.model("Ride");
  const Booking = mongoose.model("Booking");

  const ride = await Ride.findById(rideId);
  if (!ride) return null;

  // Retrieve all confirmed (accepted) bookings for this ride
  const confirmedBookings = await Booking.find({
    ride: ride._id,
    status: "accepted",
  }).populate("rider", "name department year profilePhoto phone idVerificationStatus");

  // Determine total trip cost (from override options or existing ride charge)
  let totalCost = typeof options.totalTripCost === "number"
    ? Math.max(0, options.totalTripCost)
    : (ride.charge || 0);

  totalCost = Math.round((Number(totalCost) + Number.EPSILON) * 100) / 100;

  const count = confirmedBookings.length;
  // Divide equally among confirmed riders by default
  const perRiderShare = count > 0
    ? Math.round((totalCost / count) * 100) / 100
    : totalCost;

  const ridersList = confirmedBookings.map((b) => ({
    rider: b.rider._id,
    booking: b._id,
    seats: b.seats || 1,
    splitShare: perRiderShare,
    status: b.paymentStatus === "SETTLED" ? "PAID" : "PENDING",
    confirmedAt: b.acceptedAt || b.createdAt || new Date(),
  }));

  let splitDoc = await this.findOne({ ride: ride._id });
  const event = options.event || (splitDoc ? "RIDER_JOINED" : "INIT");

  if (!splitDoc) {
    splitDoc = new this({
      ride: ride._id,
      driver: ride.poster,
      totalTripCost: totalCost,
      splitMode: "EQUAL",
      costPerRider: perRiderShare,
      confirmedRidersCount: count,
      confirmedRiders: ridersList,
      history: [
        {
          event,
          totalTripCost: totalCost,
          confirmedCount: count,
          costPerRider: perRiderShare,
          timestamp: new Date(),
        },
      ],
    });
  } else {
    splitDoc.totalTripCost = totalCost;
    splitDoc.splitMode = "EQUAL";
    splitDoc.costPerRider = perRiderShare;
    splitDoc.confirmedRidersCount = count;
    splitDoc.confirmedRiders = ridersList;
    splitDoc.history.push({
      event,
      totalTripCost: totalCost,
      confirmedCount: count,
      costPerRider: perRiderShare,
      timestamp: new Date(),
    });
    // Keep history trimmed to latest 20 events
    if (splitDoc.history.length > 20) {
      splitDoc.history = splitDoc.history.slice(-20);
    }
  }

  await splitDoc.save();

  // Synchronize unpaid RidePayment records so payment checkout reflects the active equal split
  try {
    if (mongoose.models.RidePayment) {
      const RidePayment = mongoose.model("RidePayment");
      for (const r of ridersList) {
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

module.exports = mongoose.model("AutoCostSplit", autoCostSplitSchema);
