const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const {
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
  markDue,
  setPaymentAmount,
  requestRefund,
  confirmRefund,
  cancelRefundRequest,
  createManualDue,
  getPaymentSummary,
  getDues,
  getNetBalances,
  getTransactionHistory,
  deleteTransaction,
  getTransactionReceipt,
  passengerRefundRequest,
  driverConfirmRefund,
  passengerCancelRide,
} = require("../controllers/ridePaymentController");

router.get("/summary", protect, idVerified, getPaymentSummary);
router.get("/dues", protect, idVerified, getDues);
router.get("/balances", protect, idVerified, getNetBalances);
router.get("/transactions/:id/receipt", protect, idVerified, getTransactionReceipt);
router.delete("/transactions/:id", protect, idVerified, deleteTransaction);
router.get("/transactions", protect, idVerified, getTransactionHistory);
router.post("/manual-due", protect, idVerified, createManualDue);
router.post("/ride/:rideId", protect, idVerified, createRidePayments);
router.get("/ride/:rideId", protect, idVerified, getRidePaymentManagement);
router.post("/bkash/callback", bkashCallback);
router.post("/:paymentId/method", protect, idVerified, selectPaymentMethod);
router.post("/:paymentId/manual-status", protect, idVerified, submitManualStatus);
router.post("/:paymentId/mark-due", protect, idVerified, markDue);
router.post("/:paymentId/amount", protect, idVerified, setPaymentAmount);
router.post("/:paymentId/refund/request", protect, idVerified, requestRefund);
router.post("/:paymentId/refund/cancel", protect, idVerified, cancelRefundRequest);
router.post("/:paymentId/refund/confirm", protect, idVerified, confirmRefund);
router.post("/:paymentId/passenger-refund-request", protect, idVerified, passengerRefundRequest);
router.post("/:paymentId/driver-confirm-refund", protect, idVerified, driverConfirmRefund);
router.post("/:paymentId/passenger-cancel", protect, idVerified, passengerCancelRide);
router.get("/:paymentId", protect, idVerified, getPaymentDetails);
router.post("/:paymentId/manual", protect, idVerified, recordManualPayment);
router.post("/:paymentId/mark-paid", protect, idVerified, markManualPaid);
router.post("/:paymentId/bkash/initiate", protect, idVerified, initiateBkash);
router.post("/:paymentId/bkash/verify", protect, idVerified, verifyBkash);

module.exports = router;
