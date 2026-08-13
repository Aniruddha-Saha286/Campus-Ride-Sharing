const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const {
  listSkips,
  skipOccurrence,
  restoreOccurrence,
} = require("../controllers/recurringSkipController");

router.get("/:id/skips", protect, idVerified, listSkips);
router.post("/:id/skips", protect, idVerified, skipOccurrence);
router.delete("/:id/skips/:date", protect, idVerified, restoreOccurrence);

module.exports = router;
