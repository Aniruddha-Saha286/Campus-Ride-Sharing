import { client } from "./api";

export const getRidePaymentManagement = (rideId) => client.get(`/ride-payments/ride/${rideId}`);

export const getRidePaymentDetails = (paymentId) => client.get(`/ride-payments/${paymentId}`);

export const getPaymentSummary = () => client.get("/ride-payments/summary");

export const getDues = () => client.get("/ride-payments/dues");

export const getNetBalances = () => client.get("/ride-payments/balances");

export const getTransactionHistory = (params) =>
  client.get("/ride-payments/transactions", { params });

export const getTransactionReceipt = (id) => client.get(`/ride-payments/transactions/${id}/receipt`);

export const deleteTransaction = (id) => client.delete(`/ride-payments/transactions/${id}`);

export const createManualDue = (receiver, amount, ride) =>
  client.post("/ride-payments/manual-due", { receiver, amount, ride });

export const recordManualPayment = (paymentId, amount, reference) =>
  client.post(`/ride-payments/${paymentId}/manual`, { amount, reference });

export const markManualPaid = (paymentId, amount, reference) =>
  client.post(`/ride-payments/${paymentId}/mark-paid`, { amount, reference });

export const initiateBkashPayment = (paymentId, amount) =>
  client.post(`/ride-payments/${paymentId}/bkash/initiate`, { amount });

export const verifyBkashPayment = (paymentId, paymentID, amount) =>
  client.post(`/ride-payments/${paymentId}/bkash/verify`, { paymentID, amount });

export const selectPaymentMethod = (paymentId, method) =>
  client.post(`/ride-payments/${paymentId}/method`, { method });

export const submitManualStatus = (paymentId, status) =>
  client.post(`/ride-payments/${paymentId}/manual-status`, { status });

export const markDue = (paymentId, due = true) =>
  client.post(`/ride-payments/${paymentId}/mark-due`, { due });

export const setPaymentAmount = (paymentId, amount) =>
  client.post(`/ride-payments/${paymentId}/amount`, { amount });

export const requestRefund = (paymentId, refundMethod, refundTransactionId) =>
  client.post(`/ride-payments/${paymentId}/refund/request`, { refundMethod, refundTransactionId });

export const cancelRefundRequest = (paymentId) => client.post(`/ride-payments/${paymentId}/refund/cancel`);

export const confirmRefund = (paymentId) => client.post(`/ride-payments/${paymentId}/refund/confirm`);

export const passengerRefundRequest = (paymentId) =>
  client.post(`/ride-payments/${paymentId}/passenger-refund-request`);

export const driverConfirmRefund = (paymentId, refundMethod, refundTransactionId) =>
  client.post(`/ride-payments/${paymentId}/driver-confirm-refund`, { refundMethod, refundTransactionId });

export const passengerCancelRide = (paymentId) =>
  client.post(`/ride-payments/${paymentId}/passenger-cancel`);
