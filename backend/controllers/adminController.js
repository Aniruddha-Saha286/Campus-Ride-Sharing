const mongoose = require("mongoose");
const Student = require("../models/Student");
const { signToken } = require("../utils/jwt");
const asyncHandler = require("../utils/asyncHandler");

const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ success: false, message: "Admin credentials are not configured" });
  }

  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Invalid admin credentials" });
  }

  const token = signToken({ id: "admin", role: "admin" });

  res.json({ success: true, token });
});

const listVerifications = asyncHandler(async (req, res) => {
  const allowed = ["pending", "approved", "rejected"];
  const status = allowed.includes(req.query.status) ? req.query.status : "pending";

  const students = await Student.find({ idVerificationStatus: status })
    .select(
      "name department year studentId universityEmail studentIdCard " +
        "idVerificationStatus idVerificationNote createdAt"
    )
    .sort({ createdAt: 1 });

  res.json({ success: true, data: students });
});

const getVerification = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid student id" });
  }

  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });

  res.json({ success: true, data: student });
});

const listUsers = asyncHandler(async (req, res) => {
  const { search } = req.query || {};
  const filter = {};
  if (search && search.trim()) {
    const term = search.trim();
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { studentId: { $regex: term, $options: "i" } },
      { universityEmail: { $regex: term, $options: "i" } },
    ];
  }

  const students = await Student.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: students });
});

const getStats = asyncHandler(async (req, res) => {
  const registeredStudents = await Student.countDocuments();
  res.json({ success: true, data: { registeredStudents } });
});

const banStudent = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid student id" });
  }
  const { reason } = req.body || {};
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });

  student.isBanned = true;
  student.banReason = (reason && reason.trim()) || "Account banned for breaking the rules";
  student.bannedAt = new Date();
  await student.save();

  res.json({ success: true, data: student });
});

const unbanStudent = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid student id" });
  }
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });

  student.isBanned = false;
  student.banReason = null;
  student.bannedAt = null;
  await student.save();

  res.json({ success: true, data: student });
});

const reviewVerification = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid student id" });
  }
  const { decision, note } = req.body || {};

  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ success: false, message: "Decision must be 'approved' or 'rejected'" });
  }

  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });

  if (!student.studentIdCard) {
    return res.status(400).json({ success: false, message: "Student has not uploaded an ID card" });
  }

  if (decision === "rejected") {
    student.idVerificationNote = (note && note.trim()) || "ID could not be verified.";
  } else {
    student.idVerificationNote = null;
  }
  student.idVerificationStatus = decision;
  await student.save();

  res.json({ success: true, data: student });
});

const getAdminRideTracker = asyncHandler(async (req, res) => {
  const Ride = require("../models/Ride");
  const Booking = require("../models/Booking");
  const RideStatus = require("../models/RideStatus");

  // 1. Find all open rides and ensure a RideStatus doc exists for each (upsert = no duplicate key errors)
  const openRides = await Ride.find({ status: "open" }).lean();
  for (const r of openRides) {
    await RideStatus.findOneAndUpdate(
      { ride: r._id },
      { $setOnInsert: { ride: r._id, tripStatus: "upcoming", timeline: [{ status: "upcoming", timestamp: r.createdAt || new Date() }] } },
      { upsert: true }
    );
  }

  // 2. Fetch all statuses for active / non-cancelled rides
  const statuses = await RideStatus.find()
    .populate({
      path: "ride",
      populate: { path: "poster", select: "name studentId phone universityEmail profilePhoto department year" },
    })
    .populate("timeline.updatedBy", "name profilePhoto")
    .sort({ updatedAt: -1 })
    .lean();

  const validStatuses = statuses.filter((s) => s.ride && s.ride.status !== "cancelled");
  const rideIds = validStatuses.map((s) => s.ride._id);

  const acceptedBookings = await Booking.find({
    ride: { $in: rideIds },
    status: "accepted",
  })
    .populate("rider", "name studentId phone universityEmail profilePhoto department year")
    .lean();

  const bookingsByRide = new Map();
  acceptedBookings.forEach((b) => {
    const key = String(b.ride);
    if (!bookingsByRide.has(key)) bookingsByRide.set(key, []);
    bookingsByRide.get(key).push(b);
  });

  const data = validStatuses.map((s) => ({
    _id: s._id,
    tripStatus: s.tripStatus,
    timeline: s.timeline,
    updatedAt: s.updatedAt,
    createdAt: s.createdAt,
    ride: s.ride,
    passengers: (bookingsByRide.get(String(s.ride._id)) || []).map((b) => ({
      _id: b._id,
      rider: b.rider,
      seats: b.seats,
      paymentStatus: b.paymentStatus,
    })),
  }));

  res.json({ success: true, data });
});

const getUserRideHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid student ID" });
  }

  const student = await Student.findById(id);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });

  const Ride = require("../models/Ride");
  const Booking = require("../models/Booking");

  const postedRides = await Ride.find({ poster: student._id })
    .sort({ createdAt: -1 })
    .lean();

  const postedRideIds = postedRides.map((r) => r._id);
  const acceptedBookings = await Booking.find({
    ride: { $in: postedRideIds },
    status: "accepted",
  })
    .populate("rider", "name studentId phone department year")
    .lean();

  const bookingsMap = new Map();
  acceptedBookings.forEach((b) => {
    const key = String(b.ride);
    if (!bookingsMap.has(key)) bookingsMap.set(key, []);
    bookingsMap.get(key).push(b);
  });

  const asDriver = postedRides.map((r) => ({
    _id: r._id,
    pickup: r.pickup,
    dropoff: r.dropoff,
    departureTime: r.departureTime,
    seats: r.seats,
    charge: r.charge,
    status: r.status,
    createdAt: r.createdAt,
    passengers: bookingsMap.get(String(r._id)) || [],
  }));

  const passengerBookings = await Booking.find({ rider: student._id })
    .populate({
      path: "ride",
      populate: { path: "poster", select: "name studentId phone department year" },
    })
    .sort({ createdAt: -1 })
    .lean();

  const asPassenger = passengerBookings
    .filter((b) => b.ride)
    .map((b) => ({
      _id: b._id,
      rideId: b.ride._id,
      pickup: b.ride.pickup,
      dropoff: b.ride.dropoff,
      departureTime: b.ride.departureTime,
      seats: b.seats,
      charge: b.ride.charge,
      bookingStatus: b.status,
      paymentStatus: b.paymentStatus,
      driver: b.ride.poster,
      createdAt: b.createdAt,
    }));

  res.json({
    success: true,
    data: {
      student: {
        _id: student._id,
        name: student.name,
        studentId: student.studentId,
        universityEmail: student.universityEmail,
      },
      asDriver,
      asPassenger,
    },
  });
});

module.exports = {
  adminLogin,
  listVerifications,
  getVerification,
  listUsers,
  reviewVerification,
  getStats,
  banStudent,
  unbanStudent,
  getAdminRideTracker,
  getUserRideHistory,
};
