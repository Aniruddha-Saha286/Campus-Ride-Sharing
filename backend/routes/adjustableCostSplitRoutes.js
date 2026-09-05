const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const {
  getAdjustableSplit,
  setCustomShares,
  setSingleRiderShare,
  resetToEqualSplit,
} = require("../controllers/adjustableCostSplitController");

router.get("/ride/:rideId", protect, idVerified, getAdjustableSplit);
router.put("/ride/:rideId/custom-shares", protect, idVerified, setCustomShares);
router.put("/ride/:rideId/riders/:riderId", protect, idVerified, setSingleRiderShare);
router.post("/ride/:rideId/reset-equal", protect, idVerified, resetToEqualSplit);

module.exports = router;
