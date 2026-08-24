const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const { getDriverHistory, getPassengerHistory } = require("../controllers/rideHistoryController");

router.get("/driver", protect, getDriverHistory);
router.get("/passenger", protect, getPassengerHistory);

module.exports = router;
