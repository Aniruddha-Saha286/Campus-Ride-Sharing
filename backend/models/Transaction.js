const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, trim: true },
    payer: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", default: null },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "RidePayment", default: null },
    paymentMethod: { type: String, enum: ["BKASH", "MANUAL"], required: true },
    kind: { type: String, enum: ["PAYMENT", "REFUND", "FINE"], default: "PAYMENT" },
    providerTransactionId: { type: String, default: null, trim: true },
    status: { type: String, enum: ["COMPLETED", "PENDING"], default: "COMPLETED" },
    hiddenFor: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
      default: [],
    },
  },
  { timestamps: true }
);

transactionSchema.index({ payer: 1, createdAt: -1 });
transactionSchema.index({ receiver: 1, createdAt: -1 });
transactionSchema.index(
  { providerTransactionId: 1 },
  { unique: true, partialFilterExpression: { providerTransactionId: { $type: "string" } } }
);

module.exports = mongoose.model("Transaction", transactionSchema);
