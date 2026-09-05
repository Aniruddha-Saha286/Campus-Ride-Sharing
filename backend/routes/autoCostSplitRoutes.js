const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const {
  getRideSplit,
  updateTotalCost,
  getMySplits,
  previewSplit,
  confirmRiderShare,
} = require("../controllers/autoCostSplitController");

// Public/preview endpoint
router.post("/preview", previewSplit);

// Protected endpoints for authenticated university students with verified IDs
router.get("/mine", protect, idVerified, getMySplits);
router.get("/ride/:rideId", protect, idVerified, getRideSplit);
router.put("/ride/:rideId/total-cost", protect, idVerified, updateTotalCost);
router.post("/ride/:rideId/confirm", protect, idVerified, confirmRiderShare);

module.exports = router;
