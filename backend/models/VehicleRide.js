const mongoose = require("mongoose");
const {
  isValidRegistrationForModel,
  generateCanonicalDummyRegistration,
} = require("../utils/vehicleRegistration");

const VEHICLE_CATEGORIES = ["Two-wheeler", "Four-wheeler"];
const VEHICLE_TYPES = ["Motorbike", "Car", "Jeep", "Microbus"];
const VEHICLE_SPECS = {
  Motorbike: {
    category: "Two-wheeler",
    minSeats: 1,
    maxSeats: 1,
    description: "Two-wheeler motorbike (1 passenger seat)",
  },
  Car: {
    category: "Four-wheeler",
    minSeats: 1,
    maxSeats: 4,
    description: "Four-wheeler sedan/hatchback (1 to 4 seats)",
  },
  Jeep: {
    category: "Four-wheeler",
    minSeats: 1,
    maxSeats: 6,
    description: "Four-wheeler SUV/Jeep (1 to 6 seats)",
  },
  Microbus: {
    category: "Four-wheeler",
    minSeats: 1,
    maxSeats: 8,
    description: "Four-wheeler Microbus (1 to 8 seats)",
  },
};

const generateDummyRegistration = generateCanonicalDummyRegistration;

const vehicleRideSchema = new mongoose.Schema(
  {
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      unique: true,
    },
    poster: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    vehicleCategory: {
      type: String,
      required: true,
      enum: VEHICLE_CATEGORIES,
    },
    vehicleType: {
      type: String,
      required: true,
      enum: VEHICLE_TYPES,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          return isValidRegistrationForModel(v);
        },
        message: "Invalid vehicle registration number",
      },
    },
    maxSeats: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    allocatedSeats: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

vehicleRideSchema.index({ vehicleCategory: 1 });
vehicleRideSchema.index({ vehicleType: 1 });
vehicleRideSchema.index({ poster: 1 });

const VehicleRide = mongoose.model("VehicleRide", vehicleRideSchema);

module.exports = VehicleRide;
module.exports.VEHICLE_CATEGORIES = VEHICLE_CATEGORIES;
module.exports.VEHICLE_TYPES = VEHICLE_TYPES;
module.exports.VEHICLE_SPECS = VEHICLE_SPECS;
module.exports.generateDummyRegistration = generateDummyRegistration;
