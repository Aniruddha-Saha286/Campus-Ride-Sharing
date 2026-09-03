const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const {
  createRide,
  listRides,
  getMyRides,
  requestSeat,
  respondToRequest,
  cancelRequest,
  cancelRide,
  updateRide,
  updateBookingSeats,
} = require("../controllers/rideController");
const { settlePayment } = require("../controllers/ridePaymentController");

router.get("/", protect, idVerified, listRides);
router.get("/mine", protect, idVerified, getMyRides);
router.post("/", protect, idVerified, createRide);
router.put("/:rideId", protect, idVerified, updateRide);
router.post("/:rideId/requests", protect, idVerified, requestSeat);
router.put("/:rideId/requests/:requestId", protect, idVerified, respondToRequest);
router.put("/:rideId/requests/:requestId/seats", protect, idVerified, updateBookingSeats);
router.put("/:rideId/requests/:requestId/settle-payment", protect, idVerified, settlePayment);
router.delete("/:rideId/requests/:requestId", protect, idVerified, cancelRequest);
router.delete("/:rideId", protect, idVerified, cancelRide);

module.exports = router;
