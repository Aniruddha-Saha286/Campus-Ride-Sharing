const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const {
  searchStudents,
  createPaymentRequest,
  getMyPaymentRequests,
  getPaymentRequest,
  recordPayment,
  verifyManualPayment,
} = require("../controllers/paymentRequestController");

router.get("/students", protect, idVerified, searchStudents);
router.post("/", protect, idVerified, createPaymentRequest);
router.get("/", protect, idVerified, getMyPaymentRequests);
router.get("/:id", protect, idVerified, getPaymentRequest);
router.post("/:id/payments", protect, idVerified, recordPayment);
router.put("/:id/payments/:paymentId", protect, idVerified, verifyManualPayment);

module.exports = router;
