const RidePayment = require("../models/RidePayment");
const { notifyUser } = require("./notifier");

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const TERMINAL_STATUSES = ["REFUND_REQUESTED", "REFUNDED", "CANCELLED", "PAID"];

let running = false;
let timer = null;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const runDueReminders = async () => {
  if (running) return 0;
  running = true;
  try {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const payments = await RidePayment.find({
      dueDate: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: TERMINAL_STATUSES },
      remainingAmount: { $gt: 0 },
    }).select("payer receiver ride originalAmount remainingAmount dueDate");

    let notified = 0;
    for (const p of payments) {
      notifyUser(p.payer, {
        type: "due-reminder",
        paymentId: p._id,
        rideId: p.ride,
        message: `Today is the last day to pay ${Number(p.remainingAmount).toFixed(0)} BDT. A late fee of 50 BDT/day starts tomorrow.`,
      });
      notified += 1;
    }
    return notified;
  } finally {
    running = false;
  }
};

const startDueReminderJob = () => {
  if (timer) return;
  runDueReminders().catch((err) => {
    console.error("Due reminder error:", err.message);
  });
  timer = setInterval(() => {
    runDueReminders().catch((err) => {
      console.error("Due reminder error:", err.message);
    });
  }, CHECK_INTERVAL_MS);
  if (timer.unref) timer.unref();
};

module.exports = { runDueReminders, startDueReminderJob };
