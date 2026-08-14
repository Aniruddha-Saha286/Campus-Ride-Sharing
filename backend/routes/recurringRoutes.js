const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const adminOnly = require("../middleware/admin");
const {
  createFromRide,
  listMine,
  updateRecurring,
  setStatus,
  removeRecurring,
  generateNow,
} = require("../controllers/recurringController");
const {
  listSkips,
  skipOccurrence,
  restoreOccurrence,
} = require("../controllers/recurringSkipController");

router.get("/mine", protect, idVerified, listMine);
router.post("/from/:rideId", protect, idVerified, createFromRide);
router.post("/generate", protect, idVerified, generateNow);
router.put("/:id", protect, idVerified, updateRecurring);
router.put("/:id/status", protect, idVerified, setStatus);
router.delete("/:id", protect, idVerified, removeRecurring);
router.get("/:id/skips", protect, idVerified, listSkips);
router.post("/:id/skips", protect, idVerified, skipOccurrence);
router.delete("/:id/skips/:date", protect, idVerified, restoreOccurrence);

module.exports = router;
