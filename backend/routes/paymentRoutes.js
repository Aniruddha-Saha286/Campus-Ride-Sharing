const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const { settlePayment } = require("../controllers/paymentController");

router.put("/:rideId/requests/:requestId/settle-payment", protect, idVerified, settlePayment);

module.exports = router;
