const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const {
  submitRating,
  getPendingRatingForUser,
  getDriverRatingSummary,
} = require("../controllers/ratingController");

router.post("/", protect, idVerified, submitRating);
router.get("/pending", protect, idVerified, getPendingRatingForUser);
router.get("/driver/:driverId", protect, idVerified, getDriverRatingSummary);

module.exports = router;
