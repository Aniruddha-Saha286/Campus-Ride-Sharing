const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const {
  createSafetyReport,
  getMySafetyReports,
  getAdminSafetyReports,
  updateSafetyReportStatus,
} = require("../controllers/safetyReportController");

// User routes (Authenticated Driver / Passenger)
router.post("/", protect, createSafetyReport);
router.get("/my", protect, getMySafetyReports);

// Admin routes
router.get("/admin", protect, adminOnly, getAdminSafetyReports);
router.put("/admin/:id/status", protect, adminOnly, updateSafetyReportStatus);

module.exports = router;
