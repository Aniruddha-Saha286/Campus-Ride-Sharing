const mongoose = require("mongoose");

const ridePaymentSchema = new mongoose.Schema(
  {
    ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", default: null },
    payer: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    seats: { type: Number, default: 1, min: 1, max: 6 },
    paymentMethod: { type: String, enum: ["BKASH", "MANUAL"], default: null },
    originalAmount: { type: Number, required: true, min: 0.01 },
    amountPaid: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, default: 0, min: 0 },
    lateFee: { type: Number, default: 0, min: 0 },
    lateFeePaid: { type: Number, default: 0, min: 0 },
    totalOutstanding: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: [
        "PENDING",
        "DUE",
        "PARTIAL",
        "PAID",
        "OVERDUE",
        "REFUND_REQUESTED",
        "REFUNDED",
        "CANCELLED",
      ],
      default: "PENDING",
    },
    manualStatus: {
      type: String,
      enum: ["PENDING", "DUE", "PAID"],
      default: null,
    },
    finalized: { type: Boolean, default: false },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    finalizedAt: { type: Date, default: null },
    refundRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    refundRequestedAt: { type: Date, default: null },
    driverRefundConfirmedAt: { type: Date, default: null },
    refundConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    refundConfirmedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    lastPaymentDate: { type: Date, default: null },
    bkashPaymentID: { type: String, default: null, trim: true },
    bkashTrxId: { type: String, default: null, trim: true },
    refundMethod: { type: String, enum: ["BKASH", "MANUAL"], default: null },
    refundTransactionId: { type: String, default: null, trim: true },
    note: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

ridePaymentSchema.index(
  { ride: 1, payer: 1 },
  { unique: true, partialFilterExpression: { ride: { $type: "objectId" } } }
);
ridePaymentSchema.index({ payer: 1, createdAt: -1 });
ridePaymentSchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model("RidePayment", ridePaymentSchema);
