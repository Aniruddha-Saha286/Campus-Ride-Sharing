const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const idVerified = require("../middleware/idVerified");
const {
  createVehicleRide,
  listVehicleRides,
  getVehicleSpecs,
  getDummyRegistration,
} = require("../controllers/vehicleRideController");

router.get("/specs", protect, idVerified, getVehicleSpecs);
router.get("/dummy-registration", protect, idVerified, getDummyRegistration);
router.get("/rides", protect, idVerified, listVehicleRides);
router.post("/rides", protect, idVerified, createVehicleRide);

module.exports = router;
