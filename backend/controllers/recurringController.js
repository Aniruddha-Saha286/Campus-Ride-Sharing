const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const RecurringRide = require("../models/RecurringRide");
const asyncHandler = require("../utils/asyncHandler");
const { findMe } = require("../utils/studentHelper");
const { runRecurringGeneration } = require("../utils/recurringJob");

const { TIME_REGEX } = RecurringRide;

const routeError = (body) => {
  if (!body.pickup || !String(body.pickup).trim()) {
    return "Pickup location is required";
  }
  if (!body.dropoff || !String(body.dropoff).trim()) {
    return "Drop-off location is required";
  }
  if (!body.departureTime || !TIME_REGEX.test(body.departureTime)) {
    return "Departure time must be in HH:MM (24-hour) format";
  }
  const seats = Number(body.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 6) {
    return "Seats must be a whole number between 1 and 6";
  }
  return null;
};

const nextGeneration = (date) => {
  const next = date ? new Date(date) : new Date();
  next.setDate(next.getDate() + 1);
  return next;
};

const toTemplate = (template) => ({
  _id: template._id,
  pickup: template.pickup,
  dropoff: template.dropoff,
  pickupLat: template.pickupLat,
  pickupLng: template.pickupLng,
  dropoffLat: template.dropoffLat,
  dropoffLng: template.dropoffLng,
  departureTime: template.departureTime,
  seats: template.seats,
  notes: template.notes,
  status: template.status,
  generatedForDate: template.generatedForDate,
  createdAt: template.createdAt,
  nextGenerationDate:
    template.status === "active" ? nextGeneration(template.generatedForDate) : null,
});

const loadOwnedTemplate = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, message: "Invalid recurring offer id" });
    return null;
  }
  const me = await findMe(req);
  if (!me) {
    res.status(404).json({ success: false, message: "Profile not found" });
    return null;
  }
  const template = await RecurringRide.findById(req.params.id);
  if (!template) {
    res.status(404).json({ success: false, message: "Recurring offer not found" });
    return null;
  }
  if (String(template.poster) !== String(me._id)) {
    res.status(403).json({ success: false, message: "Only the poster can manage this recurring offer" });
    return null;
  }
  return template;
};

const createFromRide = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });
  if (String(ride.poster) !== String(me._id)) {
    return res.status(403).json({ success: false, message: "Only the ride poster can mark a ride as recurring" });
  }
  if (ride.status !== "open") {
    return res.status(400).json({ success: false, message: "Only an open ride can be marked as recurring" });
  }

  const duplicate = await RecurringRide.findOne({
    poster: me._id,
    status: "active",
    pickup: ride.pickup,
    dropoff: ride.dropoff,
    departureTime: ride.departureTime,
  });
  if (duplicate) {
    return res.status(409).json({ success: false, message: "This ride is already saved as a recurring offer" });
  }

  const template = await RecurringRide.create({
    poster: me._id,
    pickup: ride.pickup,
    dropoff: ride.dropoff,
    pickupLat: ride.pickupLat ?? null,
    pickupLng: ride.pickupLng ?? null,
    dropoffLat: ride.dropoffLat ?? null,
    dropoffLng: ride.dropoffLng ?? null,
    departureTime: ride.departureTime,
    seats: ride.seats,
    notes: ride.notes || "",
    generatedForDate: new Date(),
  });

  res.status(201).json({ success: true, data: toTemplate(template) });
});

const listMine = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const templates = await RecurringRide.find({ poster: me._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: templates.map(toTemplate) });
});

const updateRecurring = asyncHandler(async (req, res) => {
  const template = await loadOwnedTemplate(req, res);
  if (!template) return;

  const body = req.body || {};
  const error = routeError({
    pickup: body.pickup !== undefined ? body.pickup : template.pickup,
    dropoff: body.dropoff !== undefined ? body.dropoff : template.dropoff,
    departureTime: body.departureTime !== undefined ? body.departureTime : template.departureTime,
    seats: body.seats !== undefined ? body.seats : template.seats,
  });
  if (error) return res.status(400).json({ success: false, message: error });

  if (body.pickup !== undefined) template.pickup = String(body.pickup).trim();
  if (body.dropoff !== undefined) template.dropoff = String(body.dropoff).trim();
  if (body.pickupLat !== undefined) template.pickupLat = body.pickupLat ?? null;
  if (body.pickupLng !== undefined) template.pickupLng = body.pickupLng ?? null;
  if (body.dropoffLat !== undefined) template.dropoffLat = body.dropoffLat ?? null;
  if (body.dropoffLng !== undefined) template.dropoffLng = body.dropoffLng ?? null;
  if (body.departureTime !== undefined) template.departureTime = body.departureTime;
  if (body.seats !== undefined) template.seats = Number(body.seats);
  if (body.notes !== undefined) template.notes = body.notes ? String(body.notes).trim() : "";

  await template.save();
  res.json({ success: true, data: toTemplate(template) });
});

const setStatus = asyncHandler(async (req, res) => {
  const template = await loadOwnedTemplate(req, res);
  if (!template) return;

  const { status } = req.body || {};
  if (!["active", "disabled"].includes(status)) {
    return res.status(400).json({ success: false, message: "Status must be 'active' or 'disabled'" });
  }

  template.status = status;
  await template.save();
  res.json({ success: true, data: toTemplate(template) });
});

const removeRecurring = asyncHandler(async (req, res) => {
  const template = await loadOwnedTemplate(req, res);
  if (!template) return;

  await template.deleteOne();
  res.json({ success: true, data: { _id: req.params.id } });
});

const generateNow = asyncHandler(async (req, res) => {
  const generated = await runRecurringGeneration();
  res.json({ success: true, data: { generated } });
});

module.exports = {
  createFromRide,
  listMine,
  updateRecurring,
  setStatus,
  removeRecurring,
  generateNow,
};
