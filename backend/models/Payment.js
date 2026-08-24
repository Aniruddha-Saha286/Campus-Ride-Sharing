const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentRequest: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentRequest", required: true },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    paidTo: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: ["BKASH", "MANUAL"], required: true },
    reference: { type: String, default: "", trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["COMPLETED", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"],
      default: "COMPLETED",
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },
    verifiedAt: { type: Date, default: null },
    paidAt: { type: Date, required: true },
  },
  { timestamps: true }
);

paymentSchema.index({ paymentRequest: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
