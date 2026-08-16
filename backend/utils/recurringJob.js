const Ride = require("../models/Ride");
const RecurringRide = require("../models/RecurringRide");
const RecurringSkip = require("../models/RecurringSkip");

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let running = false;
let timer = null;

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const dateKey = (date) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

const runRecurringGeneration = async () => {
  if (running) return 0;
  running = true;
  try {
    const today = startOfToday();
    const skipDate = dateKey(new Date());
    const skips = await RecurringSkip.find({ date: skipDate });
    const skipped = new Set(skips.map((skip) => String(skip.recurring)));
    const templates = await RecurringRide.find({ status: "active" });
    let generated = 0;
    for (const template of templates) {
      if (template.generatedForDate && template.generatedForDate >= today) continue;

      const claimed = await RecurringRide.findOneAndUpdate(
        {
          _id: template._id,
          status: "active",
          $or: [{ generatedForDate: null }, { generatedForDate: { $lt: today } }],
        },
        { $set: { generatedForDate: new Date() } }
      );
      if (!claimed) continue;

      if (skipped.has(String(template._id))) continue;

      try {
        await Ride.create({
          poster: template.poster,
          pickup: template.pickup,
          dropoff: template.dropoff,
          pickupLat: template.pickupLat ?? null,
          pickupLng: template.pickupLng ?? null,
          dropoffLat: template.dropoffLat ?? null,
          dropoffLng: template.dropoffLng ?? null,
          departureTime: template.departureTime,
          seats: template.seats,
          notes: template.notes || "",
          recurringRef: template._id,
        });
        generated += 1;
      } catch (err) {
        console.error(`Recurring generation failed for template ${template._id}:`, err.message);
        await RecurringRide.updateOne(
          { _id: template._id },
          { $set: { generatedForDate: null } }
        );
      }
    }
    return generated;
  } finally {
    running = false;
  }
};

const startRecurringJob = () => {
  if (timer) return;
  runRecurringGeneration().catch((err) => {
    console.error("Recurring generation error:", err.message);
  });
  timer = setInterval(() => {
    runRecurringGeneration().catch((err) => {
      console.error("Recurring generation error:", err.message);
    });
  }, CHECK_INTERVAL_MS);
  if (timer.unref) timer.unref();
};

module.exports = { runRecurringGeneration, startRecurringJob };
