const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const Student = require("../models/Student");
const RidePayment = require("../models/RidePayment");
const Transaction = require("../models/Transaction");
const asyncHandler = require("../utils/asyncHandler");
const { findMe, formatPublicStudent } = require("../utils/studentHelper");
const { createPayment, executePayment } = require("../utils/bkash");
const {
  MINUTE_MS,
  TERMINAL_STATUSES,
  publicUserSelect,
  roundMoney,
  seatCharge,
  generateTransactionId,
  refreshPayment,
  ensurePaymentsForRide,
  loadInvolvedPayments,
  assertActivePayment,
  isRideOpen,
  emitPaymentEvent,
  formatPayment,
  formatTransaction,
  computeTotals,
  computeNetByCounterparty,
  PASSENGER_REFUND_WINDOW_MINUTES,
  computePassengerCancelFine,
} = require("../utils/ridePaymentHelper");

// Helper to query a transaction populated with public student & ride info
const loadPopulatedTransaction = (id) =>
  Transaction.findById(id)
    .populate("payer", publicUserSelect)
    .populate("receiver", publicUserSelect)
    .populate("ride");

// Helper for bKash full payment completion
const applyVerifiedBkash = async ({ payment, amount, providerTransactionId }) => {
  const inactive = assertActivePayment(payment);
  if (inactive) return { error: inactive.error };
  if (payment.finalized) {
    return { error: { status: 400, message: "This payment is already finalized and cannot be changed" } };
  }
  if (payment.paymentMethod && payment.paymentMethod !== "BKASH") {
    return { error: { status: 400, message: "This payment uses manual settlement, not bKash" } };
  }
  if (!(await isRideOpen(payment))) {
    return { error: { status: 400, message: "Cannot pay on a cancelled ride" } };
  }
  await refreshPayment(payment);
  if (payment.status === "PAID") {
    return { error: { status: 400, message: "This payment is already fully paid" } };
  }

  // Enforce full payment
  const fullAmount = roundMoney(payment.originalAmount);
  payment.paymentMethod = "BKASH";
  payment.bkashPaymentID = null;
  payment.amountPaid = fullAmount;
  payment.remainingAmount = 0;
  payment.totalOutstanding = 0;
  payment.status = "PAID";
  payment.lastPaymentDate = new Date();
  await payment.save();

  let transaction;
  try {
    transaction = await Transaction.create({
      transactionId: await generateTransactionId(),
      payer: payment.payer,
      receiver: payment.receiver,
      amount: fullAmount,
      ride: payment.ride,
      payment: payment._id,
      paymentMethod: "BKASH",
      providerTransactionId: providerTransactionId || null,
      status: "COMPLETED",
    });
    transaction = await loadPopulatedTransaction(transaction._id);
  } catch (err) {
    if (err.code === 11000) {
      return { alreadyRecorded: true };
    }
    throw err;
  }

  return { transaction };
};

// ==========================================
// RIDE PAYMENT CONTROLLERS
// ==========================================

// 1. Create / initialize payment records for all accepted passengers in a ride
const createRidePayments = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
  if (String(ride.poster) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the ride poster can manage ride payments" });
  }
  if (!ride.charge || ride.charge <= 0) {
    return res.status(400).json({ success: false, message: "No charge is set for this ride" });
  }

  const payments = await ensurePaymentsForRide(ride);
  res.status(201).json({
    success: true,
    data: {
      ride: {
        _id: ride._id,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        charge: ride.charge,
        seats: ride.seats,
      },
      payments: payments.map(formatPayment),
    },
  });
});

// 2. Driver ride payment management overview (totals, passenger bills)
const getRidePaymentManagement = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
  if (String(ride.poster) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the ride poster can view payment management" });
  }

  await ensurePaymentsForRide(ride);

  const payments = await RidePayment.find({ ride: ride._id })
    .populate("payer", publicUserSelect)
    .populate("receiver", publicUserSelect)
    .sort({ createdAt: 1 });

  let expected = 0;
  let received = 0;
  let outstanding = 0;
  const counts = { paid: 0, pending: 0, refundRequested: 0, refunded: 0, cancelled: 0 };

  for (const payment of payments) {
    await refreshPayment(payment);
    if (!["REFUNDED", "CANCELLED"].includes(payment.status)) {
      expected += payment.originalAmount;
      received += payment.amountPaid;
      outstanding += payment.totalOutstanding;
    }
    if (payment.status === "PAID") counts.paid += 1;
    else if (payment.status === "REFUND_REQUESTED") counts.refundRequested += 1;
    else if (payment.status === "REFUNDED") counts.refunded += 1;
    else if (payment.status === "CANCELLED") counts.cancelled += 1;
    else counts.pending += 1;
  }

  res.json({
    success: true,
    data: {
      ride: {
        _id: ride._id,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        departureTime: ride.departureTime,
        seats: ride.seats,
        charge: ride.charge,
        status: ride.status,
        createdAt: ride.createdAt,
      },
      chargePerRider: ride.charge > 0 ? seatCharge(ride.charge) : 0,
      expected: roundMoney(expected),
      received: roundMoney(received),
      outstanding: roundMoney(outstanding),
      counts,
      payments: payments.map((p) => ({
        _id: p._id,
        passenger: formatPublicStudent(p.payer),
        seats: p.seats,
        paymentMethod: p.paymentMethod,
        originalAmount: p.originalAmount,
        amountPaid: p.amountPaid,
        remainingAmount: p.remainingAmount,
        totalOutstanding: p.totalOutstanding,
        status: p.status,
        manualStatus: p.manualStatus,
        finalized: p.finalized,
        refundRequestedBy: p.refundRequestedBy ? String(p.refundRequestedBy) : null,
        refundRequestedAt: p.refundRequestedAt,
        refundConfirmedAt: p.refundConfirmedAt,
        cancelledAt: p.cancelledAt,
        dueDate: p.dueDate,
        lastPaymentDate: p.lastPaymentDate,
      })),
    },
  });
});

// 3. Get details of a specific payment bill (with permissions and action flags)
const getPaymentDetails = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId)
    .populate("payer", publicUserSelect)
    .populate("receiver", publicUserSelect);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  const amPayer = payment.payer && String(payment.payer._id) === String(me._id);
  const amReceiver = payment.receiver && String(payment.receiver._id) === String(me._id);
  if (!amPayer && !amReceiver) {
    return res.status(403).json({ success: false, message: "You are not part of this payment" });
  }

  await refreshPayment(payment);
  const ride = payment.ride ? await Ride.findById(payment.ride) : null;

  const transactions = await Transaction.find({ payment: payment._id })
    .populate("payer", publicUserSelect)
    .populate("receiver", publicUserSelect)
    .populate("ride")
    .sort({ createdAt: 1 });

  res.json({
    success: true,
    data: {
      _id: payment._id,
      ride: ride
        ? {
            _id: ride._id,
            pickup: ride.pickup,
            dropoff: ride.dropoff,
            departureTime: ride.departureTime,
            seats: ride.seats,
            charge: ride.charge,
          }
        : null,
      payer: formatPublicStudent(payment.payer),
      receiver: formatPublicStudent(payment.receiver),
      seats: payment.seats,
      paymentMethod: payment.paymentMethod,
      originalAmount: payment.originalAmount,
      amountPaid: payment.amountPaid,
      remainingAmount: payment.remainingAmount,
      totalOutstanding: payment.totalOutstanding,
      status: payment.status,
      manualStatus: payment.manualStatus,
      finalized: payment.finalized,
      finalizedBy: payment.finalizedBy || null,
      finalizedAt: payment.finalizedAt,
      refundRequestedBy: payment.refundRequestedBy || null,
      refundRequestedAt: payment.refundRequestedAt,
      refundMethod: payment.refundMethod || null,
      refundTransactionId: payment.refundTransactionId || null,
      refundConfirmedBy: payment.refundConfirmedBy || null,
      refundConfirmedAt: payment.refundConfirmedAt,
      cancelledAt: payment.cancelledAt,
      dueDate: payment.dueDate,
      lastPaymentDate: payment.lastPaymentDate,
      createdAt: payment.createdAt,
      role: amPayer ? "payer" : "receiver",
      canSelectMethod: Boolean(
        amPayer &&
          !payment.finalized &&
          !payment.paymentMethod &&
          payment.status !== "PAID" &&
          !TERMINAL_STATUSES.includes(payment.status)
      ),
      canSubmitManualStatus: Boolean(
        amPayer &&
          payment.paymentMethod === "MANUAL" &&
          !payment.finalized &&
          payment.status !== "PAID" &&
          !TERMINAL_STATUSES.includes(payment.status)
      ),
      canPayOnline: Boolean(
        amPayer &&
          payment.paymentMethod === "BKASH" &&
          !payment.finalized &&
          payment.status !== "PAID" &&
          !TERMINAL_STATUSES.includes(payment.status)
      ),
      canMarkPaid: Boolean(amReceiver && payment.status !== "PAID" && !TERMINAL_STATUSES.includes(payment.status)),
      canRequestRefund: Boolean(
        amReceiver &&
          roundMoney(payment.amountPaid || 0) > 0 &&
          !TERMINAL_STATUSES.includes(payment.status)
      ),
      canCancelRefund: Boolean(
        amReceiver &&
          payment.status === "REFUND_REQUESTED" &&
          payment.refundRequestedBy &&
          String(payment.refundRequestedBy) === String(me._id)
      ),
      canConfirmRefund: Boolean(amPayer && payment.status === "REFUND_REQUESTED"),
      canPassengerRequestRefund: Boolean(
        amPayer &&
          roundMoney(payment.amountPaid || 0) > 0 &&
          !TERMINAL_STATUSES.includes(payment.status) &&
          payment.lastPaymentDate &&
          (Date.now() - new Date(payment.lastPaymentDate).getTime()) / MINUTE_MS <= PASSENGER_REFUND_WINDOW_MINUTES
      ),
      canDriverConfirmRefund: Boolean(
        amReceiver &&
          payment.status === "REFUND_REQUESTED" &&
          payment.refundRequestedBy &&
          String(payment.refundRequestedBy) !== String(me._id)
      ),
      canPassengerCancel: Boolean(
        amPayer &&
          !TERMINAL_STATUSES.includes(payment.status) &&
          payment.ride
      ),
      transactions: transactions.map((t) => formatTransaction(t, me)),
    },
  });
});

// 4. Record manual cash payment entry (Passenger pays full fare)
const recordManualPayment = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  const amPayer = String(payment.payer) === String(me._id);
  const amReceiver = String(payment.receiver) === String(me._id);
  if (!amPayer && !amReceiver) {
    return res.status(403).json({ success: false, message: "You are not part of this payment" });
  }

  const inactive = assertActivePayment(payment);
  if (inactive) return res.status(inactive.error.status).json({ success: false, message: inactive.error.message });
  if (!(await isRideOpen(payment))) {
    return res.status(400).json({ success: false, message: "Cannot record payment on a cancelled ride" });
  }

  await refreshPayment(payment);
  if (payment.status === "PAID") {
    return res.status(400).json({ success: false, message: "This payment is already fully paid" });
  }

  const fullAmount = roundMoney(payment.originalAmount);
  const reference = String(req.body.reference || "").trim();
  if (!reference) {
    return res.status(400).json({ success: false, message: "Transaction reference is required" });
  }

  payment.paymentMethod = "MANUAL";
  payment.amountPaid = fullAmount;
  payment.remainingAmount = 0;
  payment.totalOutstanding = 0;
  payment.status = "PAID";
  payment.manualStatus = "PAID";
  payment.lastPaymentDate = new Date();
  await payment.save();

  let transaction;
  try {
    transaction = await Transaction.create({
      transactionId: await generateTransactionId(),
      payer: payment.payer,
      receiver: payment.receiver,
      amount: fullAmount,
      ride: payment.ride,
      payment: payment._id,
      paymentMethod: "MANUAL",
      kind: payment.note === "Cancellation fine" ? "FINE" : "PAYMENT",
      providerTransactionId: reference,
      status: "COMPLETED",
    });
    transaction = await loadPopulatedTransaction(transaction._id);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate payment reference already recorded" });
    }
    throw err;
  }

  await emitPaymentEvent({
    userId: String(payment.payer) === String(me._id) ? payment.receiver : payment.payer,
    type: "PAYMENT_MADE",
    actorName: me.name,
    amount: fullAmount,
    method: "MANUAL",
    payment,
  });

  res.status(201).json({
    success: true,
    data: {
      payment: formatPayment(payment),
      transaction: formatTransaction(transaction, me),
    },
  });
});

// 5. Driver marks manual payment as paid in full
const markManualPaid = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (String(payment.receiver) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the receiver can mark this payment as paid" });
  }

  const inactive = assertActivePayment(payment);
  if (inactive) return res.status(inactive.error.status).json({ success: false, message: inactive.error.message });
  if (!(await isRideOpen(payment))) {
    return res.status(400).json({ success: false, message: "Cannot mark as paid on a cancelled ride" });
  }

  await refreshPayment(payment);
  if (payment.status === "PAID") {
    return res.status(400).json({ success: false, message: "This payment is already fully paid" });
  }

  const fullAmount = roundMoney(payment.originalAmount);
  const reference = String(req.body.reference || "").trim() || payment.bkashTrxId || `APPROVED-${Date.now().toString(36).toUpperCase()}`;

  payment.paymentMethod = payment.paymentMethod || "MANUAL";
  payment.finalized = true;
  payment.finalizedBy = me._id;
  payment.finalizedAt = new Date();
  payment.manualStatus = "PAID";
  payment.amountPaid = fullAmount;
  payment.remainingAmount = 0;
  payment.totalOutstanding = 0;
  payment.status = "PAID";
  payment.lastPaymentDate = new Date();
  await payment.save();

  if (payment.ride) {
    await Booking.updateOne(
      { ride: payment.ride, rider: payment.payer },
      {
        $set: {
          paymentStatus: "SETTLED",
          settledManually: true,
          settledBy: "RIDE_POSTER",
          settledByUserId: me._id,
          settledAt: new Date(),
        },
      }
    );
  }

  let transaction;
  try {
    transaction = await Transaction.create({
      transactionId: await generateTransactionId(),
      payer: payment.payer,
      receiver: payment.receiver,
      amount: fullAmount,
      ride: payment.ride,
      payment: payment._id,
      paymentMethod: payment.paymentMethod || "MANUAL",
      providerTransactionId: reference,
      status: "COMPLETED",
    });
    transaction = await loadPopulatedTransaction(transaction._id);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate payment reference already recorded" });
    }
    throw err;
  }

  await emitPaymentEvent({
    userId: payment.payer,
    type: "PAYMENT_CONFIRMED",
    actorName: me.name,
    amount: fullAmount,
    method: payment.paymentMethod || "MANUAL",
    payment,
  });

  res.status(201).json({
    success: true,
    data: {
      payment: formatPayment(payment),
      transaction: formatTransaction(transaction, me),
    },
  });
});

// 6. Initiate online bKash payment gateway session for full fare
const initiateBkash = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (String(payment.payer) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the payer can pay online" });
  }

  const inactive = assertActivePayment(payment);
  if (inactive) return res.status(inactive.error.status).json({ success: false, message: inactive.error.message });
  if (payment.finalized) {
    return res.status(400).json({ success: false, message: "This payment is already finalized and cannot be changed" });
  }
  if (payment.paymentMethod && payment.paymentMethod !== "BKASH") {
    return res.status(400).json({ success: false, message: "This payment uses manual settlement, not bKash" });
  }
  if (!(await isRideOpen(payment))) {
    return res.status(400).json({ success: false, message: "Cannot pay on a cancelled ride" });
  }

  await refreshPayment(payment);
  if (payment.status === "PAID") {
    return res.status(400).json({ success: false, message: "This payment is already fully paid" });
  }

  const fullAmount = roundMoney(payment.originalAmount);
  payment.paymentMethod = "BKASH";

  if (payment.bkashPaymentID) {
    return res.json({
      success: true,
      data: {
        paymentID: payment.bkashPaymentID,
        bkashURL: null,
        amount: fullAmount,
        message: "A bKash payment is already initiated for this bill. Complete it in your bKash app, then verify it here.",
      },
    });
  }

  const cbBase = process.env.CLIENT_URL || "http://localhost:3000";
  const callbackURL = `${req.protocol}://${req.get("host")}/api/ride-payments/bkash/callback?paymentId=${payment._id}&clientId=${encodeURIComponent(cbBase)}`;
  const result = await createPayment({
    amount: fullAmount,
    payerReference: me.phone || me._id,
    callbackURL,
    invoiceNumber: `RIDE-${payment._id}`,
  });
  payment.bkashPaymentID = result.paymentID;
  await payment.save();

  await emitPaymentEvent({
    userId: payment.receiver,
    type: "PAYMENT_INITIATED",
    actorName: me.name,
    amount: fullAmount,
    method: "BKASH",
    payment,
  });

  res.json({
    success: true,
    data: {
      paymentID: result.paymentID,
      bkashURL: result.bkashURL,
      amount: fullAmount,
      message: "Payment initiated. You will be redirected to bKash to complete the payment.",
    },
  });
});

// 7. Verify bKash payment execution
const verifyBkash = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (String(payment.payer) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the payer can verify an online payment" });
  }

  const rawTrx = req.body?.trxId || req.body?.paymentID || req.body?.reference;
  const trxId = rawTrx ? String(rawTrx).trim() : "";
  if (!trxId) {
    return res.status(400).json({ success: false, message: "bKash Transaction ID (TrxID) is required" });
  }

  const inactive = assertActivePayment(payment);
  if (inactive) return res.status(inactive.error.status).json({ success: false, message: inactive.error.message });
  if (!(await isRideOpen(payment))) {
    return res.status(400).json({ success: false, message: "Cannot pay on a cancelled ride" });
  }

  await refreshPayment(payment);
  if (payment.status === "PAID") {
    return res.status(400).json({ success: false, message: "This payment is already fully paid" });
  }

  const existing = await Transaction.findOne({ providerTransactionId: trxId });
  if (existing) {
    if (existing.payment && String(existing.payment) === String(payment._id)) {
      await refreshPayment(payment);
      return res.json({
        success: true,
        data: {
          alreadyRecorded: true,
          payment: formatPayment(payment),
          transaction: formatTransaction(existing, me),
        },
      });
    }
    return res.status(409).json({ success: false, message: "This bKash transaction ID has already been recorded" });
  }

  const fullAmount = roundMoney(payment.originalAmount);
  payment.paymentMethod = "BKASH";
  payment.bkashTrxId = trxId;
  payment.amountPaid = fullAmount;
  payment.remainingAmount = 0;
  payment.totalOutstanding = 0;
  payment.status = "PAID";
  payment.lastPaymentDate = new Date();
  await payment.save();

  let transaction;
  try {
    transaction = await Transaction.create({
      transactionId: await generateTransactionId(),
      payer: payment.payer,
      receiver: payment.receiver,
      amount: fullAmount,
      ride: payment.ride,
      payment: payment._id,
      paymentMethod: "BKASH",
      providerTransactionId: trxId,
      status: "COMPLETED",
    });
    transaction = await loadPopulatedTransaction(transaction._id);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate transaction ID" });
    }
    throw err;
  }

  await emitPaymentEvent({
    userId: payment.receiver,
    type: "PAYMENT_MADE",
    actorName: me.name,
    amount: fullAmount,
    method: "BKASH",
    payment,
  });

  res.status(201).json({
    success: true,
    data: {
      payment: formatPayment(payment),
      transaction: formatTransaction(transaction, me),
    },
  });
});

// 8. bKash payment callback handler
const bkashCallback = asyncHandler(async (req, res) => {
  const isBrowserRedirect = !!(req.query && req.query.paymentID);
  const paymentIDParam = req.query.paymentID || req.body?.paymentID;
  const paymentIdParam = req.query.paymentId || req.body?.paymentId;
  const clientId = req.query.clientId || process.env.CLIENT_URL || "http://localhost:3000";
  const status = req.query.status || req.body?.status;

  const goHome = (path, qs) => {
    if (isBrowserRedirect) return res.redirect(`${clientId}${path}${qs ? `?bkash=${qs}` : ""}`);
    return null;
  };

  if (status === "failure" || status === "cancel") {
    const fb = goHome(`/ride-payments/${paymentIdParam || ""}`, "failed");
    if (fb) return fb;
    return res.json({ success: true, data: { status: "failed" } });
  }

  if (!paymentIDParam || !String(paymentIDParam).trim()) {
    const fb = goHome(`/ride-payments/${paymentIdParam || ""}`, "error");
    if (fb) return fb;
    return res.status(400).json({ success: false, message: "Payment ID is required" });
  }

  let executeResult;
  try {
    executeResult = await executePayment(String(paymentIDParam).trim());
  } catch (err) {
    const fb = goHome(`/ride-payments/${paymentIdParam || ""}`, "error");
    if (fb) return fb;
    return res.status(400).json({ success: false, message: err.message || "bKash execution failed" });
  }

  if (executeResult.transactionStatus !== "Completed") {
    const fb = goHome(`/ride-payments/${paymentIdParam || ""}`, "failed");
    if (fb) return fb;
    return res.json({ success: true, data: { status: executeResult.transactionStatus } });
  }

  const providerTrxId = executeResult.trxID;

  const existing = await Transaction.findOne({ providerTransactionId: providerTrxId });
  if (existing) {
    const fb = goHome(`/ride-payments/${paymentIdParam || existing.payment || ""}`, "success");
    if (fb) return fb;
    return res.json({ success: true, data: { alreadyRecorded: true, transaction: existing.transactionId } });
  }

  const payment = paymentIdParam && mongoose.isValidObjectId(paymentIdParam)
    ? await RidePayment.findById(paymentIdParam)
    : await RidePayment.findOne({ bkashPaymentID: String(paymentIDParam).trim() });
  if (!payment) {
    const fb = goHome(`/ride-payments/${paymentIdParam || ""}`, "error");
    if (fb) return fb;
    return res.status(404).json({ success: false, message: "Payment not found for this bKash payment" });
  }

  const fullAmount = roundMoney(payment.originalAmount);
  const outcome = await applyVerifiedBkash({
    payment,
    amount: fullAmount,
    providerTransactionId: providerTrxId,
  });
  if (outcome.error) {
    const fb = goHome(`/ride-payments/${payment._id}`, "error");
    if (fb) return fb;
    return res.status(outcome.error.status).json({ success: false, message: outcome.error.message });
  }
  if (outcome.alreadyRecorded) {
    const fb = goHome(`/ride-payments/${payment._id}`, "success");
    if (fb) return fb;
    return res.json({ success: true, data: { alreadyRecorded: true } });
  }

  const payerDoc = await Student.findById(payment.payer).select("name");
  await emitPaymentEvent({
    userId: payment.receiver,
    type: "PAYMENT_MADE",
    actorName: payerDoc?.name || "A passenger",
    amount: fullAmount,
    method: "BKASH",
    payment,
  });

  const fb = goHome(`/ride-payments/${payment._id}`, "success");
  if (fb) return fb;
  res.json({ success: true, data: { transaction: outcome.transaction.transactionId } });
});

// 9. Select payment method (BKASH or MANUAL)
const selectPaymentMethod = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (String(payment.payer) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the payer can choose the payment method" });
  }

  const method = String(req.body.method || "").trim().toUpperCase();
  if (!["BKASH", "MANUAL"].includes(method)) {
    return res.status(400).json({ success: false, message: "Payment method must be BKASH or MANUAL" });
  }

  const inactive = assertActivePayment(payment);
  if (inactive) return res.status(inactive.error.status).json({ success: false, message: inactive.error.message });
  if (payment.finalized || payment.status === "PAID") {
    return res.status(400).json({ success: false, message: "This payment is already finalized and cannot be changed" });
  }

  payment.paymentMethod = method;
  payment.manualStatus = "PENDING";

  if (method === "BKASH" && req.body.trxId) {
    payment.bkashTrxId = String(req.body.trxId).trim();
  }

  await payment.save();
  await refreshPayment(payment);

  await emitPaymentEvent({
    userId: payment.receiver,
    type: "METHOD_SELECTED",
    actorName: me.name,
    amount: payment.remainingAmount,
    method,
    payment,
  });

  res.json({ success: true, data: formatPayment(payment) });
});

// 10. Passenger submits manual status update
const submitManualStatus = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const manualStatus = String(req.body.status || "").trim().toUpperCase();
  if (manualStatus !== "PENDING") {
    return res
      .status(400)
      .json({ success: false, message: "Manual status must be PENDING." });
  }

  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  const claim = await RidePayment.findOneAndUpdate(
    {
      _id: req.params.paymentId,
      payer: me._id,
      paymentMethod: "MANUAL",
      finalized: false,
      status: { $nin: ["PAID", ...TERMINAL_STATUSES] },
    },
    { $set: { manualStatus } },
    { new: true }
  );

  if (!claim) {
    return res
      .status(400)
      .json({ success: false, message: "This payment is already finalized or no longer active" });
  }

  await refreshPayment(claim);

  await emitPaymentEvent({
    userId: claim.receiver,
    type: "MANUAL_STATUS_PENDING",
    actorName: me.name,
    amount: roundMoney(claim.remainingAmount),
    method: "MANUAL",
    payment,
  });

  res.status(201).json({ success: true, data: formatPayment(claim) });
});

// 11. Driver requests refund for passenger
const requestRefund = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (String(payment.receiver) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the receiver can request a refund" });
  }

  await refreshPayment(payment);
  if (roundMoney(payment.amountPaid || 0) <= 0 || TERMINAL_STATUSES.includes(payment.status)) {
    return res.status(400).json({ success: false, message: "No payment recorded to refund" });
  }

  const { refundMethod, refundTransactionId } = req.body || {};
  if (!["BKASH", "MANUAL"].includes(refundMethod)) {
    return res.status(400).json({ success: false, message: "refundMethod must be 'BKASH' or 'MANUAL'" });
  }
  if (refundMethod === "BKASH" && (!refundTransactionId || !String(refundTransactionId).trim())) {
    return res.status(400).json({ success: false, message: "Transaction reference is required for bKash refund" });
  }

  const updated = await RidePayment.findOneAndUpdate(
    { _id: payment._id, status: { $nin: TERMINAL_STATUSES }, amountPaid: { $gt: 0 } },
    {
      $set: {
        status: "REFUND_REQUESTED",
        refundRequestedBy: me._id,
        refundRequestedAt: new Date(),
        refundMethod,
        refundTransactionId: refundTransactionId ? String(refundTransactionId).trim() : null,
      },
    },
    { new: true }
  );
  if (!updated) {
    return res.status(409).json({ success: false, message: "This payment is no longer in a refundable state" });
  }

  await refreshPayment(updated);

  await emitPaymentEvent({
    userId: updated.payer,
    type: "REFUND_REQUESTED",
    actorName: me.name,
    amount: roundMoney(updated.amountPaid),
    method: updated.paymentMethod,
    payment: updated,
  });

  res.json({ success: true, data: formatPayment(updated) });
});

// 12. Passenger confirms refund received
const confirmRefund = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (String(payment.payer) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the payer can confirm the refund" });
  }

  const updated = await RidePayment.findOneAndUpdate(
    { _id: payment._id, status: "REFUND_REQUESTED" },
    { $set: { status: "REFUNDED", refundConfirmedBy: me._id, refundConfirmedAt: new Date() } },
    { new: true }
  );
  if (!updated) {
    return res.status(400).json({ success: false, message: "This payment is not awaiting refund confirmation" });
  }

  const refundAmount = roundMoney(updated.amountPaid);
  updated.totalOutstanding = 0;
  updated.remainingAmount = 0;
  updated.finalized = true;
  updated.finalizedBy = me._id;
  updated.finalizedAt = new Date();
  await updated.save();

  if (updated.ride) {
    await Booking.updateOne(
      { ride: updated.ride, rider: updated.payer, status: { $in: ["pending", "accepted"] } },
      { $set: { status: "cancelled", cancelReason: "Refund confirmed by passenger" } }
    );
    const rideDoc = await Ride.findById(updated.ride).select("status");
    if (rideDoc && rideDoc.status === "pending_cancellation") {
      const activeUnrefunded = await RidePayment.find({
        ride: updated.ride,
        status: { $in: ["REFUND_REQUESTED", "PAID"] },
      });
      if (activeUnrefunded.length === 0) {
        await Ride.findByIdAndUpdate(updated.ride, { $set: { status: "cancelled" } });
      }
    }
  }

  try {
    const refundTxnRef = updated.refundTransactionId || `REFUND-${String(updated._id)}-${Date.now()}`;
    await Transaction.create({
      transactionId: await generateTransactionId(),
      payer: updated.receiver,
      receiver: updated.payer,
      amount: refundAmount,
      ride: updated.ride,
      payment: updated._id,
      paymentMethod: updated.refundMethod || (updated.paymentMethod === "BKASH" ? "BKASH" : "MANUAL"),
      kind: "REFUND",
      providerTransactionId: refundTxnRef,
      status: "COMPLETED",
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  await emitPaymentEvent({
    userId: updated.receiver,
    type: "REFUND_CONFIRMED",
    actorName: me.name,
    amount: refundAmount,
    method: updated.paymentMethod === "BKASH" ? "BKASH" : "MANUAL",
    payment,
  });

  res.json({ success: true, data: formatPayment(updated) });
});

// 13. Driver cancels a previously initiated refund request
const cancelRefundRequest = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (String(payment.receiver) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the ride owner can cancel a refund request" });
  }

  const updated = await RidePayment.findOneAndUpdate(
    { _id: payment._id, status: "REFUND_REQUESTED", refundRequestedBy: me._id },
    { $set: { status: "PENDING", refundRequestedBy: null, refundRequestedAt: null } },
    { new: true }
  );
  if (!updated) {
    return res.status(409).json({ success: false, message: "This payment is not awaiting a refund you requested" });
  }

  await refreshPayment(updated);

  await emitPaymentEvent({
    userId: updated.payer,
    type: "REFUND_REQUEST_CANCELLED",
    actorName: me.name,
    amount: roundMoney(updated.amountPaid),
    method: updated.paymentMethod,
    payment: updated,
  });

  res.json({ success: true, data: formatPayment(updated) });
});

// 14. Passenger requests refund
const passengerRefundRequest = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (String(payment.payer) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the payer can request a refund" });
  }

  await refreshPayment(payment);
  if (roundMoney(payment.amountPaid || 0) <= 0 || TERMINAL_STATUSES.includes(payment.status)) {
    return res.status(400).json({ success: false, message: "No payment recorded to refund" });
  }

  if (!payment.lastPaymentDate) {
    return res.status(400).json({ success: false, message: "No payment date found" });
  }

  const elapsedMin = (Date.now() - new Date(payment.lastPaymentDate).getTime()) / MINUTE_MS;
  if (elapsedMin > PASSENGER_REFUND_WINDOW_MINUTES) {
    return res.status(400).json({
      success: false,
      message: `Refund window of ${PASSENGER_REFUND_WINDOW_MINUTES} minutes has passed.`,
    });
  }

  const updated = await RidePayment.findOneAndUpdate(
    { _id: payment._id, status: { $nin: TERMINAL_STATUSES }, amountPaid: { $gt: 0 } },
    {
      $set: {
        status: "REFUND_REQUESTED",
        refundRequestedBy: me._id,
        refundRequestedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!updated) {
    return res.status(409).json({ success: false, message: "This payment is no longer in a refundable state" });
  }

  await refreshPayment(updated);

  await emitPaymentEvent({
    userId: updated.receiver,
    type: "REFUND_REQUESTED",
    actorName: me.name,
    amount: roundMoney(updated.amountPaid),
    method: updated.paymentMethod,
    payment: updated,
  });

  res.json({ success: true, data: formatPayment(updated) });
});

// 15. Driver confirms refund for passenger
const driverConfirmRefund = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid payment id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (String(payment.receiver) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the ride owner can confirm a refund" });
  }

  if (payment.status !== "REFUND_REQUESTED") {
    return res.status(400).json({ success: false, message: "This payment is not awaiting refund confirmation" });
  }

  const { refundMethod, refundTransactionId } = req.body;
  const chosenRefundMethod = refundMethod || payment.refundMethod || (payment.paymentMethod === "BKASH" ? "BKASH" : "MANUAL");
  if (chosenRefundMethod === "BKASH" && (!refundTransactionId || !String(refundTransactionId).trim())) {
    return res.status(400).json({ success: false, message: "Transaction reference is required for bKash refund" });
  }

  const refundAmount = roundMoney(payment.amountPaid || payment.originalAmount || 0);

  payment.status = "REFUND_REQUESTED";
  payment.refundMethod = chosenRefundMethod;
  payment.refundTransactionId = refundTransactionId ? String(refundTransactionId).trim() : null;
  payment.driverRefundConfirmedAt = new Date();
  await payment.save();

  await emitPaymentEvent({
    userId: payment.payer,
    type: "REFUND_CONFIRMED",
    actorName: me.name,
    amount: refundAmount,
    method: chosenRefundMethod,
    payment,
  });

  res.json({
    success: true,
    data: formatPayment(payment),
    message: "Refund processed. Waiting for passenger confirmation.",
  });
});

// 16. Passenger cancels ride
const passengerCancelRide = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.paymentId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const payment = await RidePayment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

  if (String(payment.payer) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the payer can cancel" });
  }

  if (TERMINAL_STATUSES.includes(payment.status)) {
    return res.status(400).json({ success: false, message: "This payment is already closed" });
  }

  if (!payment.ride) {
    return res.status(400).json({ success: false, message: "No ride linked to this payment" });
  }

  const ride = await Ride.findById(payment.ride);
  if (!ride || ride.status !== "open") {
    return res.status(400).json({ success: false, message: "This ride is not active" });
  }

  const booking = await Booking.findOne({ ride: ride._id, rider: me._id, status: { $in: ["pending", "accepted"] } });
  if (!booking) {
    return res.status(400).json({ success: false, message: "No active booking found" });
  }

  await refreshPayment(payment);
  const hasPaid = roundMoney(payment.amountPaid || 0) > 0;

  if (hasPaid) {
    const updated = await RidePayment.findOneAndUpdate(
      { _id: payment._id, status: { $nin: TERMINAL_STATUSES }, amountPaid: { $gt: 0 } },
      {
        $set: {
          status: "REFUND_REQUESTED",
          refundRequestedBy: me._id,
          refundRequestedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: "This payment is no longer in a refundable state" });
    }

    await emitPaymentEvent({
      userId: updated.receiver,
      type: "REFUND_REQUESTED",
      actorName: me.name,
      amount: roundMoney(updated.amountPaid),
      method: updated.paymentMethod,
      payment: updated,
    });

    res.json({ success: true, data: { payment: formatPayment(updated), fine: 0, refundPending: true } });
  } else {
    const fine = computePassengerCancelFine(booking.acceptedAt);

    payment.status = "CANCELLED";
    payment.remainingAmount = 0;
    payment.totalOutstanding = 0;
    payment.cancelledAt = new Date();
    await payment.save();

    booking.status = "cancelled";
    booking.cancelReason = "Cancelled by passenger";
    await booking.save();

    res.json({ success: true, data: { payment: formatPayment(payment), fine, refundPending: false } });
  }
});

// 17. User payment financial summary (owed to me vs owed by me)
const getPaymentSummary = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const payments = await loadInvolvedPayments(me);

  let youWillReceive = 0;
  let youOwe = 0;
  const counts = {
    owedToMe: { pending: 0, paid: 0 },
    owedByMe: { pending: 0, paid: 0 },
  };
  for (const p of payments) {
    if (String(p.receiver) === String(me._id)) {
      youWillReceive += p.totalOutstanding;
      if (p.status === "PENDING") counts.owedToMe.pending += 1;
      else if (p.status === "PAID") counts.owedToMe.paid += 1;
    }
    if (String(p.payer) === String(me._id)) {
      youOwe += p.totalOutstanding;
      if (p.status === "PENDING") counts.owedByMe.pending += 1;
      else if (p.status === "PAID") counts.owedByMe.paid += 1;
    }
  }

  youWillReceive = roundMoney(youWillReceive);
  youOwe = roundMoney(youOwe);

  const transactions = await Transaction.find({
    $or: [{ payer: me._id }, { receiver: me._id }],
    hiddenFor: { $ne: me._id },
  })
    .populate("payer", publicUserSelect)
    .populate("receiver", publicUserSelect)
    .populate("ride")
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      youWillReceive,
      youOwe,
      net: roundMoney(youWillReceive - youOwe),
      counts,
      recentTransactions: transactions.map((t) => formatTransaction(t, me)),
    },
  });
});

// 18. Dues list by counterparty (outstanding ride fares to be paid in full)
const getDues = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const payments = await loadInvolvedPayments(me);
  const netMap = computeNetByCounterparty(me, payments);

  const youOwe = [];
  const owedToYou = [];
  for (const [id, net] of netMap) {
    const value = roundMoney(net);
    if (value === 0) continue;
    const person = await Student.findById(id).select(publicUserSelect);
    if (!person) continue;
    if (value > 0) {
      youOwe.push({ counterparty: formatPublicStudent(person), amount: value });
    } else {
      owedToYou.push({ counterparty: formatPublicStudent(person), amount: roundMoney(-value) });
    }
  }
  youOwe.sort((a, b) => b.amount - a.amount);
  owedToYou.sort((a, b) => b.amount - a.amount);

  const youOweTotal = roundMoney(youOwe.reduce((sum, d) => sum + d.amount, 0));
  const owedToYouTotal = roundMoney(owedToYou.reduce((sum, d) => sum + d.amount, 0));

  res.json({
    success: true,
    data: {
      youOwe,
      owedToYou,
      youOweTotal,
      owedToYouTotal,
      net: roundMoney(owedToYouTotal - youOweTotal),
    },
  });
});

// 19. Net balances overview
const getNetBalances = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const payments = await loadInvolvedPayments(me);
  const netMap = computeNetByCounterparty(me, payments);

  const balances = [];
  let youWillReceive = 0;
  let youOwe = 0;
  for (const [id, net] of netMap) {
    const value = roundMoney(net);
    if (value === 0) continue;
    const person = await Student.findById(id).select(publicUserSelect);
    if (!person) continue;
    const owed = value > 0;
    const amount = Math.abs(value);
    if (owed) youOwe += amount;
    else youWillReceive += amount;
    balances.push({
      counterparty: formatPublicStudent(person),
      direction: owed ? "owe" : "owedToYou",
      amount,
    });
  }
  balances.sort((a, b) => b.amount - a.amount);

  res.json({
    success: true,
    data: {
      balances,
      youWillReceive: roundMoney(youWillReceive),
      youOwe: roundMoney(youOwe),
      net: roundMoney(youWillReceive - youOwe),
    },
  });
});

// 20. Filtered transaction history
const getTransactionHistory = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { direction, method, ride, person, from, to, search } = req.query;

  const filter = {
    $or: [{ payer: me._id }, { receiver: me._id }],
    hiddenFor: { $ne: me._id },
  };

  if (direction === "received") {
    filter.receiver = me._id;
  } else if (direction === "paid") {
    filter.payer = me._id;
  }

  if (method === "bkash") filter.paymentMethod = "BKASH";
  else if (method === "manual") filter.paymentMethod = "MANUAL";

  if (ride && mongoose.isValidObjectId(ride)) filter.ride = ride;

  if (person && mongoose.isValidObjectId(person)) {
    const conds =
      direction === "received"
        ? { payer: person }
        : direction === "paid"
          ? { receiver: person }
          : [{ payer: person }, { receiver: person }];
    filter.$and = [{ $or: Array.isArray(conds) ? conds : [conds] }];
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) {
      const parsed = new Date(from);
      if (!Number.isNaN(parsed.getTime())) filter.createdAt.$gte = parsed;
    }
    if (to) {
      const parsed = new Date(to);
      if (!Number.isNaN(parsed.getTime())) filter.createdAt.$lte = new Date(parsed.getTime() + 86399999);
    }
  }

  let transactions = await Transaction.find(filter)
    .populate("payer", publicUserSelect)
    .populate("receiver", publicUserSelect)
    .populate("ride")
    .sort({ createdAt: -1 });

  const searchTerm = String(search || "").trim();
  if (searchTerm) {
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "i");
    const personIds = (await Student.find({ name: re }).select("_id")).map((s) => String(s._id));
    const rideIds = (
      await Ride.find({ $or: [{ pickup: re }, { dropoff: re }] }).select("_id")
    ).map((r) => String(r._id));
    transactions = transactions.filter(
      (t) =>
        re.test(t.transactionId) ||
        personIds.includes(String(t.payer?._id || t.payer)) ||
        personIds.includes(String(t.receiver?._id || t.receiver)) ||
        rideIds.some((id) => t.ride && String(t.ride._id || t.ride) === id)
    );
  }

  const data = transactions.map((t) => formatTransaction(t, me));
  res.json({ success: true, data, totals: computeTotals(data) });
});

// 21. Soft delete transaction for current user
const deleteTransaction = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid transaction id" });
  }
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) return res.status(404).json({ success: false, message: "Transaction not found" });

  const involved =
    String(transaction.payer) === String(me._id) || String(transaction.receiver) === String(me._id);
  if (!involved) {
    return res.status(403).json({ success: false, message: "You cannot delete another user's transaction" });
  }

  if (!transaction.hiddenFor.some((id) => String(id) === String(me._id))) {
    transaction.hiddenFor.push(me._id);
    await transaction.save();
  }

  res.json({ success: true, data: { _id: transaction._id, hidden: true } });
});

// 22. Get receipt details for a transaction
const getTransactionReceipt = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid transaction id" });
  }
  const transaction = await Transaction.findById(req.params.id)
    .populate("payer", publicUserSelect)
    .populate("receiver", publicUserSelect)
    .populate("ride");
  if (!transaction) return res.status(404).json({ success: false, message: "Transaction not found" });

  const involved =
    (transaction.payer && String(transaction.payer._id) === String(me._id)) ||
    (transaction.receiver && String(transaction.receiver._id) === String(me._id));
  if (!involved) {
    return res.status(403).json({ success: false, message: "You are not part of this transaction" });
  }

  res.json({ success: true, data: formatTransaction(transaction, me) });
});

// 23. Legacy ride booking payment settlement
const settlePayment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId) || !mongoose.isValidObjectId(req.params.requestId)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  const booking = await Booking.findOne({ _id: req.params.requestId, ride: ride._id });
  if (!booking) return res.status(404).json({ success: false, message: "Ride request not found" });

  const isPoster = String(ride.poster) === String(me._id);
  const isRider = String(booking.rider) === String(me._id);
  if (!isPoster && !isRider) {
    return res.status(403).json({ success: false, message: "Only the ride poster or the accepted rider can settle the payment" });
  }

  if (booking.status !== "accepted") {
    return res.status(400).json({ success: false, message: "Only an accepted request can be settled" });
  }

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "accepted", paymentStatus: "PENDING" },
    {
      $set: {
        paymentStatus: "SETTLED",
        settledBy: isPoster ? "RIDE_POSTER" : "RIDER",
        settledByUserId: me._id,
        settledAt: new Date(),
        settledManually: true,
      },
    },
    { new: true }
  );

  if (!updated) {
    return res.status(400).json({ success: false, message: "This payment is already settled" });
  }

  res.json({ success: true, data: updated });
});

module.exports = {
  createRidePayments,
  getRidePaymentManagement,
  getPaymentDetails,
  recordManualPayment,
  markManualPaid,
  initiateBkash,
  verifyBkash,
  bkashCallback,
  selectPaymentMethod,
  submitManualStatus,
  requestRefund,
  confirmRefund,
  cancelRefundRequest,
  passengerRefundRequest,
  driverConfirmRefund,
  passengerCancelRide,
  getPaymentSummary,
  getDues,
  getNetBalances,
  getTransactionHistory,
  deleteTransaction,
  getTransactionReceipt,
  settlePayment,
};
