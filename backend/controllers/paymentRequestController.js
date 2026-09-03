const mongoose = require("mongoose");
const Student = require("../models/Student");
const { PaymentRequest, Payment, generateRequestCode } = require("../models/PaymentRequest");
const asyncHandler = require("../utils/asyncHandler");
const { findMe, formatPublicStudent } = require("../utils/studentHelper");
const { executePayment } = require("../utils/bkash");

// Fields to populate for public student profiles
const publicPayerSelect = "name department year profilePhoto homeArea";

// Safe floating-point rounding for currency amounts
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// Valid payment statuses that count towards total paid
const COUNTED_STATUSES = ["COMPLETED", "VERIFIED"];

// Helper: Calculate amount due, amount paid, remaining balance, and status
const computeSummary = (request, payments) => {
  const amountDue = roundMoney(request.amountDue);
  const amountPaid = roundMoney(
    payments
      .filter((p) => COUNTED_STATUSES.includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0)
  );
  const remaining = Math.max(0, roundMoney(amountDue - amountPaid));
  const status =
    amountPaid >= amountDue ? "PAID" : amountPaid === 0 ? "UNPAID" : "PARTIALLY_PAID";
  return { amountDue, amountPaid, remaining, status };
};

// Helper: Auto-update request status in the database if it changed
const refreshRequestStatus = async (request, payments) => {
  const summary = computeSummary(request, payments);
  if (request.status !== summary.status) {
    request.status = summary.status;
    await request.save();
  }
  return summary;
};

// Helper: Load all payment entries for a request in chronological order
const loadPayments = async (requestId) =>
  Payment.find({ paymentRequest: requestId }).sort({ paidAt: 1, createdAt: 1 });

// =============================================================================
// CONTROLLER HANDLERS
// =============================================================================

// 1. Search students to send a peer payment request to
const searchStudents = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const q = String(req.query.search || "").trim();
  const query = {
    _id: { $ne: me._id },
    isBanned: false,
    idVerificationStatus: "approved",
  };
  if (q) {
    query.name = { $regex: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
  }
  const students = await Student.find(query).select(publicPayerSelect).limit(10);
  res.json({
    success: true,
    data: students.map((s) => ({
      _id: s._id,
      name: s.name,
      department: s.department,
      year: s.year,
      homeArea: s.homeArea,
      profilePhoto: s.profilePhoto,
      idVerified: s.idVerificationStatus === "approved",
    })),
  });
});

// 2. Create a new peer payment request
const createPaymentRequest = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { payer, amountDue, description, dueDate } = req.body || {};

  // Input validation
  if (!payer || !mongoose.isValidObjectId(payer)) {
    return res.status(400).json({ success: false, message: "A valid payer is required" });
  }
  if (String(payer) === String(me._id)) {
    return res.status(400).json({ success: false, message: "You cannot request payment from yourself" });
  }

  const amount = roundMoney(Number(amountDue));
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: "Amount due must be a positive number" });
  }

  const trimmedDescription = description ? String(description).trim() : "";
  if (trimmedDescription.length > 1000) {
    return res.status(400).json({ success: false, message: "Description must be at most 1000 characters" });
  }

  const payee = await Student.findOne({ _id: payer, isBanned: false });
  if (!payee) return res.status(404).json({ success: false, message: "Payer not found" });

  let parsedDueDate = null;
  if (dueDate) {
    parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ success: false, message: "Due date must be a valid date" });
    }
  }

  // Generate unique request code
  let requestCode;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    requestCode = generateRequestCode();
    const taken = await PaymentRequest.findOne({ requestCode });
    if (!taken) break;
    requestCode = null;
  }
  if (!requestCode) {
    return res.status(500).json({ success: false, message: "Could not generate a unique request id" });
  }

  const paymentRequest = await PaymentRequest.create({
    requestCode,
    requester: me._id,
    payer: payee._id,
    amountDue: roundMoney(amount),
    description: trimmedDescription,
    dueDate: parsedDueDate,
    status: "UNPAID",
  });

  const data = paymentRequest.toObject();
  data.summary = computeSummary(paymentRequest, []);
  res.status(201).json({ success: true, data });
});

// 3. List all payment requests for the logged-in user
const getMyPaymentRequests = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const role = req.query.role === "requester" ? "requester" : req.query.role === "payer" ? "payer" : "all";
  const filter = role === "all" ? { $or: [{ requester: me._id }, { payer: me._id }] }
    : role === "requester" ? { requester: me._id }
    : { payer: me._id };

  const requests = await PaymentRequest.find(filter)
    .populate("requester", publicPayerSelect)
    .populate("payer", publicPayerSelect)
    .sort({ createdAt: -1 });

  const paymentRequests = await Payment.find({ paymentRequest: { $in: requests.map((r) => r._id) } });

  const data = requests.map((request) => {
    const payments = paymentRequests.filter((p) => String(p.paymentRequest) === String(request._id));
    const summary = computeSummary(request, payments);
    const amRequester = request.requester && String(request.requester._id) === String(me._id);
    const amPayer = request.payer && String(request.payer._id) === String(me._id);
    return {
      _id: request._id,
      requestCode: request.requestCode,
      amountDue: request.amountDue,
      description: request.description,
      dueDate: request.dueDate,
      status: request.status,
      createdAt: request.createdAt,
      summary,
      role: amRequester ? "requester" : amPayer ? "payer" : null,
      counterpart: amRequester
        ? formatPublicStudent(request.payer)
        : formatPublicStudent(request.requester),
    };
  });

  res.json({ success: true, data });
});

// 4. Get detailed view of a single payment request
const getPaymentRequest = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid payment request id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const request = await PaymentRequest.findById(req.params.id)
    .populate("requester", publicPayerSelect)
    .populate("payer", publicPayerSelect);
  if (!request) return res.status(404).json({ success: false, message: "Payment request not found" });

  const isRequester = request.requester && String(request.requester._id) === String(me._id);
  const isPayer = request.payer && String(request.payer._id) === String(me._id);
  if (!isRequester && !isPayer) {
    return res.status(403).json({ success: false, message: "You are not part of this payment request" });
  }

  const payments = await loadPayments(request._id);
  const summary = computeSummary(request, payments);

  res.json({
    success: true,
    data: {
      _id: request._id,
      requestCode: request.requestCode,
      requester: formatPublicStudent(request.requester),
      payer: formatPublicStudent(request.payer),
      amountDue: request.amountDue,
      description: request.description,
      dueDate: request.dueDate,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      summary,
      role: isRequester ? "requester" : "payer",
      payments: payments.map((p) => ({
        _id: p._id,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        status: p.status,
        verifiedBy: p.verifiedBy,
        verifiedAt: p.verifiedAt,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
    },
  });
});

// 5. Record a payment against a peer request (via bKash or Manual Cash)
const recordPayment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid payment request id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const request = await PaymentRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: "Payment request not found" });

  if (String(request.payer) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the payer can record a payment" });
  }

  const { method, reference } = req.body || {};
  if (!["BKASH", "MANUAL"].includes(method)) {
    return res.status(400).json({ success: false, message: "Method must be 'BKASH' or 'MANUAL'" });
  }

  const amount = roundMoney(Number(req.body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: "Amount must be a positive number" });
  }

  const trimmedReference = reference ? String(reference).trim() : "";
  if (trimmedReference.length > 200) {
    return res.status(400).json({ success: false, message: "Reference must be at most 200 characters" });
  }

  const payments = await loadPayments(request._id);
  const summary = computeSummary(request, payments);
  if (summary.status === "PAID") {
    return res.status(400).json({ success: false, message: "This payment request is already fully paid" });
  }

  let payment;
  if (method === "BKASH") {
    payment = await Payment.create({
      paymentRequest: request._id,
      paidBy: me._id,
      paidTo: request.requester,
      amount,
      method: "BKASH",
      reference: trimmedReference || `BKASH-${Date.now().toString(36).toUpperCase()}`,
      status: "COMPLETED",
      paidAt: new Date(),
    });
  } else {
    payment = await Payment.create({
      paymentRequest: request._id,
      paidBy: me._id,
      paidTo: request.requester,
      amount,
      method: "MANUAL",
      reference: trimmedReference,
      status: "PENDING_VERIFICATION",
      paidAt: new Date(),
    });
  }

  const updatedSummary = await refreshRequestStatus(request, [...payments, payment]);
  res.status(201).json({
    success: true,
    data: {
      payment: {
        _id: payment._id,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        status: payment.status,
        paidAt: payment.paidAt,
      },
      summary: updatedSummary,
    },
  });
});

// 6. Requester verifies or rejects a manual payment
const verifyManualPayment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const request = await PaymentRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: "Payment request not found" });

  if (String(request.requester) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the requester can verify manual payments" });
  }

  const payment = await Payment.findOne({ _id: req.params.paymentId, paymentRequest: request._id });
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (payment.method !== "MANUAL" || payment.status !== "PENDING_VERIFICATION") {
    return res.status(400).json({ success: false, message: "Only a pending manual payment can be verified" });
  }

  const { decision } = req.body || {};
  if (!["verified", "rejected"].includes(decision)) {
    return res.status(400).json({ success: false, message: "Decision must be 'verified' or 'rejected'" });
  }

  payment.status = decision === "verified" ? "VERIFIED" : "REJECTED";
  payment.verifiedBy = me._id;
  payment.verifiedAt = new Date();
  await payment.save();

  const payments = await loadPayments(request._id);
  const summary = await refreshRequestStatus(request, payments);

  res.json({
    success: true,
    data: {
      payment: {
        _id: payment._id,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        status: payment.status,
        verifiedAt: payment.verifiedAt,
        paidAt: payment.paidAt,
      },
      summary,
    },
  });
});

module.exports = {
  searchStudents,
  createPaymentRequest,
  getMyPaymentRequests,
  getPaymentRequest,
  recordPayment,
  verifyManualPayment,
};
