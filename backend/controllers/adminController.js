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

module.exports = {
  adminLogin,
  listVerifications,
  getVerification,
  listUsers,
  reviewVerification,
  getStats,
  banStudent,
  unbanStudent,
};
