const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const {
  adminLogin,
  listVerifications,
  getVerification,
  listUsers,
  reviewVerification,
  getStats,
  banStudent,
  unbanStudent,
  getAdminRideTracker,
  getUserRideHistory,
} = require("../controllers/adminController");

router.post("/login", adminLogin);
router.get("/stats", protect, adminOnly, getStats);
router.get("/verifications", protect, adminOnly, listVerifications);
router.get("/verifications/:id", protect, adminOnly, getVerification);
router.put("/verifications/:id", protect, adminOnly, reviewVerification);
router.get("/users", protect, adminOnly, listUsers);
router.put("/users/:id/ban", protect, adminOnly, banStudent);
router.put("/users/:id/unban", protect, adminOnly, unbanStudent);
router.get("/rides/tracker", protect, adminOnly, getAdminRideTracker);
router.get("/users/:id/rides", protect, adminOnly, getUserRideHistory);

module.exports = router;
