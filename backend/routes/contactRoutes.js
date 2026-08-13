const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const { getRideContacts, getRequestContact } = require("../controllers/contactController");

router.get("/rides/:rideId/contacts", protect, idVerified, getRideContacts);
router.get("/requests/:requestId/contact", protect, idVerified, getRequestContact);

module.exports = router;
