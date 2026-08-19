const mongoose = require("mongoose");

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

const generateRequestCode = () => {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
  return `PR-${time}-${random}`;
};

module.exports = mongoose.model("PaymentRequest", paymentRequestSchema);
module.exports.generateRequestCode = generateRequestCode;
