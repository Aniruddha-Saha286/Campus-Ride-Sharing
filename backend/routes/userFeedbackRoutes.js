const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const {
  submitFeedback,
  getMyFeedbacks,
  getAdminFeedbacks,
  updateAdminFeedback,
  deleteAdminFeedback,
} = require("../controllers/userFeedbackController");

router.post("/", protect, submitFeedback);
router.get("/my", protect, getMyFeedbacks);

router.get("/admin", protect, adminOnly, getAdminFeedbacks);
router.put("/admin/:id", protect, adminOnly, updateAdminFeedback);
router.delete("/admin/:id", protect, adminOnly, deleteAdminFeedback);

module.exports = router;
