const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const RidePayment = require("../models/RidePayment");
const Transaction = require("../models/Transaction");
const { formatPublicStudent } = require("./studentHelper");
const { notifyUser } = require("./notifier");

// ==========================================
// CONSTANTS & CONFIGURATION
// ==========================================
const MINUTE_MS = 60000;
const CANCEL_FREE_MINUTES = 15;
const FINE_PER_15MIN = 30; // 30 Taka per interval
const FINE_INTERVAL_MINUTES = 10; // 10 minutes per interval
const PASSENGER_REFUND_WINDOW_MINUTES = 15;
const PASSENGER_CANCEL_FREE_MINUTES = 15;
const PASSENGER_FINE_PER_15MIN = 30;

const TERMINAL_STATUSES = ["REFUND_REQUESTED", "REFUNDED", "CANCELLED"];
const publicUserSelect = "name department year profilePhoto idVerificationStatus phone";

// ==========================================
// HELPER CALCULATIONS
// ==========================================

/**
 * Safely rounds monetary amounts to 2 decimal places to prevent float errors.
 */
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Returns the cost per rider seat.
 */
const seatCharge = (charge) => roundMoney(Number(charge));

/**
 * Generates a unique, collision-resistant transaction ID.
 */
const generateTransactionId = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    const taken = await Transaction.findOne({ transactionId: id });
    if (!taken) return id;
  }
  throw new Error("Could not generate a unique transaction ID. Please try again.");
};

/**
 * Computes cancellation fine for driver cancellation after free window.
 */
const computeCancellationFine = (acceptedAt) => {
  if (!acceptedAt) return 0;
  const elapsed = Date.now() - new Date(acceptedAt).getTime();
  const elapsedMin = elapsed / MINUTE_MS;
  if (elapsedMin <= CANCEL_FREE_MINUTES) return 0;
  return Math.ceil((elapsedMin - CANCEL_FREE_MINUTES) / FINE_INTERVAL_MINUTES) * FINE_PER_15MIN;
};

/**
 * Computes cancellation fine for passenger cancellation after free window.
 */
const computePassengerCancelFine = (acceptedAt) => {
  if (!acceptedAt) return 0;
  const elapsed = Date.now() - new Date(acceptedAt).getTime();
  const elapsedMin = elapsed / MINUTE_MS;
  if (elapsedMin <= PASSENGER_CANCEL_FREE_MINUTES) return 0;
  return Math.ceil((elapsedMin - PASSENGER_CANCEL_FREE_MINUTES) / FINE_INTERVAL_MINUTES) * PASSENGER_FINE_PER_15MIN;
};

// ==========================================
// PAYMENT DATABASE HELPERS
// ==========================================

/**
 * Refreshes payment status: passenger pays full amount, so status is either PAID or PENDING.
 */
const refreshPayment = async (payment) => {
  if (TERMINAL_STATUSES.includes(payment.status)) {
    payment.lateFee = 0;
    payment.lateFeePaid = 0;
    payment.totalOutstanding = 0;
    payment.remainingAmount = 0;
    await payment.save();
    return payment;
  }

  if (payment.ride) {
    const ride = await Ride.findById(payment.ride).select("status");
    if (ride && ride.status === "cancelled") {
      payment.status = "CANCELLED";
      payment.remainingAmount = 0;
      payment.lateFee = 0;
      payment.lateFeePaid = 0;
      payment.totalOutstanding = 0;
      payment.cancelledAt = payment.cancelledAt || new Date();
      await payment.save();
      return payment;
    }
  }

  const paid = roundMoney(payment.amountPaid || 0);
  const total = roundMoney(payment.originalAmount || 0);

  if (paid >= total && total > 0) {
    payment.status = "PAID";
    payment.remainingAmount = 0;
    payment.totalOutstanding = 0;
  } else {
    payment.status = "PENDING";
    payment.remainingAmount = total;
    payment.totalOutstanding = total;
  }

  payment.lateFee = 0;
  payment.lateFeePaid = 0;
  await payment.save();
  return payment;
};

/**
 * Ensures a RidePayment record exists for each accepted passenger of a ride (full charge).
 */
const ensurePaymentsForRide = async (ride) => {
  if (!ride.charge || ride.charge <= 0) return [];
  const bookings = await Booking.find({ ride: ride._id, status: "accepted" });
  const perRider = seatCharge(ride.charge);
  const payments = [];

  for (const booking of bookings) {
    const paymentAmount = roundMoney(perRider * (booking.seats || 1));
    const existing = await RidePayment.findOne({ ride: ride._id, payer: booking.rider });

    if (existing) {
      if (existing.status === "CANCELLED") {
        existing.status = "PENDING";
        existing.paymentMethod = null;
        existing.manualStatus = null;
        existing.finalized = false;
        existing.finalizedBy = null;
        existing.finalizedAt = null;
        existing.refundRequestedBy = null;
        existing.refundRequestedAt = null;
        existing.refundConfirmedBy = null;
        existing.refundConfirmedAt = null;
        existing.cancelledAt = null;
        existing.seats = booking.seats || 1;
        existing.originalAmount = paymentAmount;
        existing.amountPaid = 0;
        existing.remainingAmount = paymentAmount;
        existing.totalOutstanding = paymentAmount;
        existing.lateFee = 0;
        existing.lateFeePaid = 0;
        existing.lastPaymentDate = null;
        existing.bkashPaymentID = null;
        await refreshPayment(existing);
      }
      payments.push(existing);
      continue;
    }

    const created = await RidePayment.create({
      ride: ride._id,
      payer: booking.rider,
      receiver: ride.poster,
      seats: booking.seats || 1,
      originalAmount: paymentAmount,
      amountPaid: 0,
      remainingAmount: paymentAmount,
      totalOutstanding: paymentAmount,
      lateFee: 0,
      lateFeePaid: 0,
      status: "PENDING",
    });
    await refreshPayment(created);
    payments.push(created);
  }
  return payments;
};

/**
 * Automatically creates/updates payments for any rides the user is involved in.
 */
const ensurePaymentsForUser = async (me) => {
  const riderRideIds = await Booking.find({ rider: me._id, status: "accepted" }).distinct("ride");
  const rides = await Ride.find({
    $or: [{ poster: me._id }, { _id: { $in: riderRideIds } }],
  });
  const payments = [];
  for (const ride of rides) {
    const created = await ensurePaymentsForRide(ride);
    payments.push(...created);
  }
  return payments;
};

/**
 * Loads and refreshes all ride payments where the user is payer or receiver.
 */
const loadInvolvedPayments = async (me) => {
  await ensurePaymentsForUser(me);
  const payments = await RidePayment.find({ $or: [{ payer: me._id }, { receiver: me._id }] });
  for (const p of payments) {
    await refreshPayment(p);
  }
  return payments;
};

/**
 * Verifies if payment record is in an active, payable state.
 */
const assertActivePayment = (payment) => {
  if (TERMINAL_STATUSES.includes(payment.status)) {
    return { error: { status: 400, message: "This payment is no longer active" } };
  }
  return null;
};

/**
 * Checks if the underlying ride is active/open.
 */
const isRideOpen = async (payment) => {
  if (!payment.ride) return true;
  const ride = await Ride.findById(payment.ride);
  return Boolean(ride && ride.status === "open");
};

/**
 * Emits in-app real-time notification to user about payment events.
 */
const emitPaymentEvent = async ({ userId, type, actorName, amount, method, payment }) => {
  let ride = null;
  if (payment.ride) {
    const doc = await Ride.findById(payment.ride).select("pickup dropoff");
    if (doc) ride = { _id: doc._id, pickup: doc.pickup, dropoff: doc.dropoff };
  }
  notifyUser(userId, {
    type,
    paymentId: payment._id,
    actorName,
    amount: roundMoney(Number(amount)),
    method,
    ride,
  });
};

// ==========================================
// PRESENTATION / RESPONSE FORMATTERS
// ==========================================

/**
 * Formats a RidePayment object for API responses.
 */
const formatPayment = (payment) => ({
  _id: payment._id,
  ride: payment.ride,
  payer: payment.payer,
  receiver: payment.receiver,
  seats: payment.seats,
  paymentMethod: payment.paymentMethod,
  originalAmount: payment.originalAmount,
  amountPaid: payment.amountPaid,
  remainingAmount: payment.remainingAmount,
  lateFee: 0,
  lateFeePaid: 0,
  totalOutstanding: payment.totalOutstanding,
  status: payment.status,
  manualStatus: payment.manualStatus,
  finalized: payment.finalized,
  finalizedBy: payment.finalizedBy,
  finalizedAt: payment.finalizedAt,
  refundRequestedBy: payment.refundRequestedBy,
  refundRequestedAt: payment.refundRequestedAt,
  driverRefundConfirmedAt: payment.driverRefundConfirmedAt,
  refundMethod: payment.refundMethod,
  refundTransactionId: payment.refundTransactionId,
  refundConfirmedBy: payment.refundConfirmedBy,
  refundConfirmedAt: payment.refundConfirmedAt,
  cancelledAt: payment.cancelledAt,
  dueDate: payment.dueDate,
  lastPaymentDate: payment.lastPaymentDate,
  bkashPaymentID: payment.bkashPaymentID,
  bkashTrxId: payment.bkashTrxId,
  note: payment.note,
  createdAt: payment.createdAt,
});

/**
 * Formats a Transaction object relative to the currently logged in user.
 */
const formatTransaction = (transaction, me) => {
  const amReceiver =
    transaction.receiver && String(transaction.receiver._id || transaction.receiver) === String(me._id);
  const amPayer = transaction.payer && String(transaction.payer._id || transaction.payer) === String(me._id);
  const direction = amReceiver ? "received" : amPayer ? "paid" : null;
  const counterparty = amReceiver ? transaction.payer : transaction.receiver;

  let role = null;
  if (transaction.ride && transaction.ride.poster) {
    const posterId = String(transaction.ride.poster._id || transaction.ride.poster);
    role = posterId === String(me._id) ? "driver" : "passenger";
  } else if (transaction.kind === "FINE" || transaction.kind === "REFUND") {
    role = amPayer ? "driver" : "passenger";
  }

  return {
    _id: transaction._id,
    transactionId: transaction.transactionId,
    amount: transaction.amount,
    direction,
    kind: transaction.kind || "PAYMENT",
    role,
    method: transaction.paymentMethod,
    providerTransactionId: transaction.providerTransactionId,
    status: transaction.status,
    createdAt: transaction.createdAt,
    ride: transaction.ride
      ? {
          _id: transaction.ride._id || transaction.ride,
          pickup: transaction.ride.pickup,
          dropoff: transaction.ride.dropoff,
          departureTime: transaction.ride.departureTime,
          poster: formatPublicStudent(transaction.ride.poster),
        }
      : null,
    payer: formatPublicStudent(transaction.payer),
    receiver: formatPublicStudent(transaction.receiver),
    counterparty: formatPublicStudent(counterparty),
  };
};

/**
 * Computes received, paid, and net totals from transaction list.
 */
const computeTotals = (data) => {
  let received = 0;
  let paid = 0;
  for (const t of data) {
    if (t.direction === "received") received += t.amount;
    else if (t.direction === "paid") paid += t.amount;
  }
  received = roundMoney(received);
  paid = roundMoney(paid);
  return { received, paid, net: roundMoney(received - paid) };
};

/**
 * Computes balances broken down by counterparties (for pending full fares).
 */
const computeNetByCounterparty = (me, payments) => {
  const map = new Map();
  for (const p of payments) {
    const amPayer = String(p.payer) === String(me._id);
    const amReceiver = String(p.receiver) === String(me._id);
    if (!amPayer && !amReceiver) continue;
    const other = String(amPayer ? p.receiver : p.payer);
    const delta = amPayer ? p.totalOutstanding : -p.totalOutstanding;
    map.set(other, roundMoney((map.get(other) || 0) + delta));
  }
  return map;
};

module.exports = {
  MINUTE_MS,
  CANCEL_FREE_MINUTES,
  FINE_PER_15MIN,
  PASSENGER_REFUND_WINDOW_MINUTES,
  PASSENGER_CANCEL_FREE_MINUTES,
  PASSENGER_FINE_PER_15MIN,
  TERMINAL_STATUSES,
  publicUserSelect,
  roundMoney,
  seatCharge,
  generateTransactionId,
  computeCancellationFine,
  computePassengerCancelFine,
  refreshPayment,
  ensurePaymentsForRide,
  ensurePaymentsForUser,
  loadInvolvedPayments,
  assertActivePayment,
  isRideOpen,
  emitPaymentEvent,
  formatPayment,
  formatTransaction,
  computeTotals,
  computeNetByCounterparty,
};
