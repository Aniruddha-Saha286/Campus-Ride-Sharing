const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const {
  getMyRideStatuses,
  getRideStatus,
  updateRideStatus,
} = require("../controllers/rideStatusController");

router.get("/mine", protect, idVerified, getMyRideStatuses);
router.get("/:rideId", protect, idVerified, getRideStatus);
router.put("/:rideId", protect, idVerified, updateRideStatus);

module.exports = router;
