const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const {
  getSuggestedMatches,
  getContactInfo,
  getMyCommuterPreference,
  upsertCommuterPreference,
} = require("../controllers/matchController");

router.get("/suggestions", protect, idVerified, getSuggestedMatches);
router.get("/contact-info/:otherStudentId", protect, idVerified, getContactInfo);
router.get("/commuters", protect, idVerified, getMyCommuterPreference);
router.post("/commuters", protect, idVerified, upsertCommuterPreference);

module.exports = router;
