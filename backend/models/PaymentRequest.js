const mongoose = require("mongoose");

// ==========================================
// 1. PEER PAYMENT REQUEST SCHEMA (Student A requests money from Student B)
// ==========================================
const paymentRequestSchema = new mongoose.Schema(
  {
    requestCode: { type: String, required: true, unique: true, trim: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    payer: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    amountDue: { type: Number, required: true, min: 0.01 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    dueDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["UNPAID", "PARTIALLY_PAID", "PAID"],
      default: "UNPAID",
    },
  },
  { timestamps: true }
);

paymentRequestSchema.index({ requester: 1, createdAt: -1 });
paymentRequestSchema.index({ payer: 1, createdAt: -1 });

// ==========================================
// 2. PAYMENT ATTEMPT / ENTRY SCHEMA (Record of cash or bKash payment)
// ==========================================
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

// Helper to generate a unique readable request code (e.g. PR-M1X8-AB12)
const generateRequestCode = () => {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
  return `PR-${time}-${random}`;
};

const PaymentRequest = mongoose.model("PaymentRequest", paymentRequestSchema);
const Payment = mongoose.model("Payment", paymentSchema);

module.exports = {
  PaymentRequest,
  Payment,
  generateRequestCode,
};
