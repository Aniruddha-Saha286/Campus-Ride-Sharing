require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const studentRoutes = require("./routes/studentRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const rideRoutes = require("./routes/rideRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const contactRoutes = require("./routes/contactRoutes");
const matchRoutes = require("./routes/matchRoutes");
const recurringRoutes = require("./routes/recurringRoutes");
const recurringSkipRoutes = require("./routes/recurringSkipRoutes");
const paymentRequestRoutes = require("./routes/paymentRequestRoutes");
const ridePaymentRoutes = require("./routes/ridePaymentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const rideStatusRoutes = require("./routes/rideStatusRoutes");
const rideHistoryRoutes = require("./routes/rideHistoryRoutes");
const chatRoutes = require("./routes/chatRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const { startRecurringJob } = require("./utils/recurringJob");
const { startDueReminderJob } = require("./utils/dueReminderJob");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/rides", paymentRoutes);
app.use("/api", contactRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/recurring", recurringRoutes);
app.use("/api/recurring", recurringSkipRoutes);
app.use("/api/payments", paymentRequestRoutes);
app.use("/api/ride-payments", ridePaymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ride-statuses", rideStatusRoutes);
app.use("/api/ride-history", rideHistoryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ratings", ratingRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Campus Ride Sharing API" });
});

app.use((err, req, res, next) => {
  if (err.name === "MulterError") {
    return res.status(400).json({ success: false, message: err.message });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err.stack);
  res.status(status).json({ success: false, message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startRecurringJob();
      startDueReminderJob();
    });
  } catch (err) {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
})();
