const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const RecurringRide = require("../models/RecurringRide");
const RecurringSkip = require("../models/RecurringSkip");
const asyncHandler = require("../utils/asyncHandler");
const { findMe } = require("../utils/studentHelper");

const { DATE_REGEX } = RecurringSkip;

const dateKey = (date) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

const todayKey = () => dateKey(new Date());

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

const toSkip = (skip) => ({
  _id: skip._id,
  recurring: skip.recurring,
  date: skip.date,
  createdAt: skip.createdAt,
});

const listSkips = asyncHandler(async (req, res) => {
  const template = await loadOwnedTemplate(req, res);
  if (!template) return;

  const skips = await RecurringSkip.find({ recurring: template._id }).sort({ date: 1 });
  res.json({ success: true, data: skips.map(toSkip) });
});

const skipOccurrence = asyncHandler(async (req, res) => {
  const template = await loadOwnedTemplate(req, res);
  if (!template) return;

  const { date } = req.body || {};
  if (!date || !DATE_REGEX.test(date)) {
    return res.status(400).json({ success: false, message: "Date must be in YYYY-MM-DD format" });
  }
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || dateKey(parsed) !== date) {
    return res.status(400).json({ success: false, message: "Date is not a valid calendar day" });
  }
  if (date < todayKey()) {
    return res.status(400).json({ success: false, message: "Can only cancel today's or a future occurrence" });
  }

  const existing = await RecurringSkip.findOne({ recurring: template._id, date });
  if (existing) {
    return res.status(409).json({ success: false, message: "This occurrence is already cancelled" });
  }

  const skip = await RecurringSkip.create({ recurring: template._id, student: template.poster, date });

  if (date === todayKey()) {
    await Ride.updateMany(
      { recurringRef: template._id, status: "open" },
      { $set: { status: "cancelled" } }
    );
  }

  res.status(201).json({ success: true, data: toSkip(skip) });
});

const restoreOccurrence = asyncHandler(async (req, res) => {
  const template = await loadOwnedTemplate(req, res);
  if (!template) return;

  const { date } = req.params;
  if (!date || !DATE_REGEX.test(date)) {
    return res.status(400).json({ success: false, message: "Date must be in YYYY-MM-DD format" });
  }

  const skip = await RecurringSkip.findOneAndDelete({ recurring: template._id, date });
  if (!skip) {
    return res.status(404).json({ success: false, message: "This occurrence is not cancelled" });
  }

  res.json({ success: true, data: toSkip(skip) });
});

module.exports = { listSkips, skipOccurrence, restoreOccurrence };
