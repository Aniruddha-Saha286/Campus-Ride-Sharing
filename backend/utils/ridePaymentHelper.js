const GRACE_DAYS = 3;
const LATE_FEE_PER_DAY = 50;
const DAY_MS = 86400000;
const MINUTE_MS = 60000;
const CANCEL_FREE_MINUTES = 30;
const FINE_PER_15MIN = 100;
const PASSENGER_REFUND_WINDOW_MINUTES = 5;
const PASSENGER_CANCEL_FREE_MINUTES = 20;
const PASSENGER_FINE_PER_15MIN = 100;

const TERMINAL_STATUSES = ["REFUND_REQUESTED", "REFUNDED", "CANCELLED"];

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const seatCharge = (charge) => roundMoney(Number(charge));

const computeLateFee = (payment, now = Date.now()) => {
  if (payment.status === "PAID" || TERMINAL_STATUSES.includes(payment.status)) return 0;
  const dueMs = payment.dueDate ? new Date(payment.dueDate).getTime() : null;
  if (dueMs === null) return 0;
  const nowMs = new Date(now).getTime();
  if (nowMs <= dueMs) return 0;
  return roundMoney(Math.floor((nowMs - dueMs) / DAY_MS) * LATE_FEE_PER_DAY);
};

const computePaymentStatus = (payment, now = Date.now()) => {
  if (TERMINAL_STATUSES.includes(payment.status)) return payment.status;
  const paid = roundMoney(payment.amountPaid || 0);
  const remaining = roundMoney(payment.remainingAmount || 0);
  if (paid > 0 && remaining === 0) return "PAID";
  const dueMs = payment.dueDate ? new Date(payment.dueDate).getTime() : null;
  if (remaining > 0 && dueMs !== null && new Date(now).getTime() > dueMs) return "OVERDUE";
  if (paid > 0) return "PARTIAL";
  if (payment.manualStatus === "DUE") return "DUE";
  return "PENDING";
};

const computeCancellationFine = (acceptedAt) => {
  if (!acceptedAt) return 0;
  const elapsed = Date.now() - new Date(acceptedAt).getTime();
  const elapsedMin = elapsed / MINUTE_MS;
  if (elapsedMin <= CANCEL_FREE_MINUTES) return 0;
  return Math.ceil((elapsedMin - CANCEL_FREE_MINUTES) / 15) * FINE_PER_15MIN;
};

const computePassengerCancelFine = (acceptedAt) => {
  if (!acceptedAt) return 0;
  const elapsed = Date.now() - new Date(acceptedAt).getTime();
  const elapsedMin = elapsed / MINUTE_MS;
  if (elapsedMin <= PASSENGER_CANCEL_FREE_MINUTES) return 0;
  return Math.ceil((elapsedMin - PASSENGER_CANCEL_FREE_MINUTES) / 15) * PASSENGER_FINE_PER_15MIN;
};

const refreshPayment = async (payment) => {
  if (TERMINAL_STATUSES.includes(payment.status)) {
    payment.lateFee = 0;
    payment.totalOutstanding = 0;
    await payment.save();
    return payment;
  }
  if (payment.ride) {
    const Ride = require("../models/Ride");
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
  payment.status = computePaymentStatus(payment);
  payment.lateFee = computeLateFee(payment);
  const unpaidFee = roundMoney(Math.max(0, roundMoney(payment.lateFee) - roundMoney(payment.lateFeePaid)));
  payment.totalOutstanding =
    payment.status === "PAID" ? 0 : roundMoney(roundMoney(payment.remainingAmount) + unpaidFee);
  await payment.save();
  return payment;
};

module.exports = {
  GRACE_DAYS,
  LATE_FEE_PER_DAY,
  DAY_MS,
  MINUTE_MS,
  CANCEL_FREE_MINUTES,
  FINE_PER_15MIN,
  PASSENGER_REFUND_WINDOW_MINUTES,
  PASSENGER_CANCEL_FREE_MINUTES,
  PASSENGER_FINE_PER_15MIN,
  TERMINAL_STATUSES,
  roundMoney,
  seatCharge,
  computeLateFee,
  computePaymentStatus,
  computeCancellationFine,
  computePassengerCancelFine,
  refreshPayment,
};
