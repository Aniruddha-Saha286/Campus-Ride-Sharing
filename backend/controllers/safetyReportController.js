const mongoose = require("mongoose");
const SafetyReport = require("../models/SafetyReport");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const asyncHandler = require("../utils/asyncHandler");
const { findMe } = require("../utils/studentHelper");
const { notifyUser } = require("../utils/notifier");
const {
  PASSENGER_CATEGORIES,
  DRIVER_CATEGORIES,
  ALL_CATEGORIES,
  STATUS_OPTIONS,
} = require("../models/SafetyReport");

/**
 * @desc    Submit a safety concern report for a trip
 * @route   POST /api/safety-reports
 * @access  Private (Authenticated Driver or Passenger of the trip)
 */
const createSafetyReport = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) {
    return res.status(404).json({ success: false, message: "User profile not found" });
  }

  const { tripId, category, description } = req.body || {};

  // 1. Validate Trip ID
  if (!tripId || !mongoose.isValidObjectId(tripId)) {
    return res.status(400).json({ success: false, message: "A valid trip must be selected" });
  }

  const ride = await Ride.findById(tripId).populate("poster", "name universityEmail");
  if (!ride) {
    return res.status(404).json({ success: false, message: "Trip not found" });
  }

  // 2. Security Check: User MUST be part of an ACCEPTED ride relationship
  const isDriver = String(ride.poster._id || ride.poster) === String(me._id);
  const acceptedBookingAsPassenger = await Booking.findOne({
    ride: ride._id,
    rider: me._id,
    status: "accepted",
  });

  if (!isDriver && !acceptedBookingAsPassenger) {
    return res.status(403).json({
      success: false,
      message: "Security check failed: You can only report safety concerns after a ride request has been accepted.",
    });
  }

  // If user is the driver, verify at least one passenger was accepted on this ride
  if (isDriver) {
    const hasAcceptedPassenger = await Booking.exists({
      ride: ride._id,
      status: "accepted",
    });
    if (!hasAcceptedPassenger) {
      return res.status(403).json({
        success: false,
        message: "Safety concerns can only be reported after at least one passenger request has been accepted.",
      });
    }
  }

  // 3. Validate Category & Description based on reporter role (Driver vs Passenger)
  const allowedCategories = isDriver ? DRIVER_CATEGORIES : PASSENGER_CATEGORIES;
  if (!category || (!allowedCategories.includes(category) && !ALL_CATEGORIES.includes(category))) {
    return res.status(400).json({
      success: false,
      message: `Please select a valid category: ${allowedCategories.join(", ")}`,
    });
  }

  if (!description || !description.trim() || description.trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: "Please provide a clear description of the safety concern (at least 5 characters)",
    });
  }

  // 4. Create and Save Report
  const report = await SafetyReport.create({
    trip: ride._id,
    reporter: me._id,
    category,
    description: description.trim(),
    status: "Pending",
  });

  // 5. Notify Reporter & Admin in real-time
  try {
    // Real-time toast notification to the student who submitted
    notifyUser([me.universityEmail, String(me._id)], {
      type: "SAFETY_REPORT_SUBMITTED",
      message: "Your safety report has been submitted and is currently pending review.",
      status: "Pending",
      reportId: report._id,
      tripId: ride._id,
    });

    // Real-time notification to admin
    notifyUser(["admin", process.env.ADMIN_EMAIL || "admin"], {
      type: "SAFETY_REPORT_CREATED",
      title: "New Safety Concern Reported",
      body: `${me.name} reported "${category}" on trip: ${ride.pickup} → ${ride.dropoff}`,
      reportId: report._id,
      category,
      createdAt: report.createdAt,
    });
  } catch (notifErr) {
    console.error("Failed to trigger notifications:", notifErr.message);
  }

  res.status(201).json({
    success: true,
    message: "Your safety report has been submitted and is currently pending review.",
    data: report,
  });
});

/**
 * @desc    Get all safety reports for Admin with filter & sorting
 * @route   GET /api/safety-reports/admin
 * @access  Private (Admin Only)
 */
const getAdminSafetyReports = asyncHandler(async (req, res) => {
  const { status, sort } = req.query || {};

  // Build filter query
  const query = {};
  if (status === "needs_resolution") {
    query.status = { $in: ["Pending", "Reviewed"] };
  } else if (status === "resolved") {
    query.status = "Resolved";
  } else if (status && STATUS_OPTIONS.includes(status)) {
    query.status = status;
  }

  // Determine sort order
  const sortOption = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

  const reports = await SafetyReport.find(query)
    .populate({
      path: "trip",
      select: "pickup dropoff departureTime poster charge seats status createdAt",
      populate: {
        path: "poster",
        select: "name studentId phone universityEmail profilePhoto department year",
      },
    })
    .populate("reporter", "name studentId phone universityEmail profilePhoto department year")
    .sort(sortOption)
    .lean();

  res.json({ success: true, data: reports });
});

/**
 * @desc    Update status of a safety report
 * @route   PUT /api/safety-reports/admin/:id/status
 * @access  Private (Admin Only)
 */
const updateSafetyReportStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid report ID" });
  }

  if (!status || !STATUS_OPTIONS.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${STATUS_OPTIONS.join(", ")}`,
    });
  }

  const report = await SafetyReport.findById(id).populate(
    "reporter",
    "name universityEmail"
  );
  if (!report) {
    return res.status(404).json({ success: false, message: "Safety report not found" });
  }

  report.status = status;
  await report.save();

  // Notify the reporting student in real time
  try {
    const reporterEmail = report.reporter?.universityEmail;
    const reporterId = String(report.reporter?._id || report.reporter);
    const targets = [reporterEmail, reporterId].filter(Boolean);

    notifyUser(targets, {
      type: "SAFETY_REPORT_STATUS_UPDATED",
      message: `Your safety report has been updated to "${status}" by administrators.`,
      status: status,
      reportId: report._id,
    });
  } catch (notifErr) {
    console.error("Failed to notify student of safety report status update:", notifErr.message);
  }

  res.json({
    success: true,
    message: `Report status updated to ${status}`,
    data: report,
  });
});

/**
 * @desc    Get safety reports submitted by the logged-in student
 * @route   GET /api/safety-reports/my
 * @access  Private (Authenticated User)
 */
const getMySafetyReports = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) {
    return res.status(404).json({ success: false, message: "User profile not found" });
  }

  const reports = await SafetyReport.find({ reporter: me._id })
    .populate({
      path: "trip",
      select: "pickup dropoff departureTime poster charge seats status createdAt",
      populate: {
        path: "poster",
        select: "name studentId phone universityEmail profilePhoto department year",
      },
    })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: reports });
});

module.exports = {
  createSafetyReport,
  getMySafetyReports,
  getAdminSafetyReports,
  updateSafetyReportStatus,
};
