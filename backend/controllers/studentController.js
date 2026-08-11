const mongoose = require("mongoose");
const Student = require("../models/Student");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const { deleteUploadedFile } = require("../utils/file");
const asyncHandler = require("../utils/asyncHandler");

const profileFields = (body) => ({
  studentId: body.studentId,
  name: body.name,
  department: body.department,
  year: body.year,
  homeArea: body.homeArea,
  phone: body.phone,
  dateOfBirth: body.dateOfBirth,
  studentNid: body.studentNid || null,
  passport: body.passport || null,
  emergencyContact: body.emergencyContact,
  parentInfo: body.parentInfo,
  localGuardian: body.localGuardian,
});

const findStudentByEmail = (email) => Student.findOne({ universityEmail: email });

const createProfile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "University ID card is required" });
  }

  const cardPath = req.file.path;

  const existing = await findStudentByEmail(req.user.universityEmail);
  if (existing) {
    await deleteUploadedFile(cardPath);
    return res.status(409).json({ success: false, message: "Profile already exists for this account" });
  }

  let student;
  try {
    student = await Student.create({
      universityEmail: req.user.universityEmail,
      studentIdCard: cardPath,
      idVerificationStatus: "pending",
      ...profileFields(req.body),
    });
  } catch (err) {
    deleteUploadedFile(cardPath);
    if (err.code === 11000) {
      err.status = 409;
      err.message = "Profile already exists for this account";
    }
    throw err;
  }

  res.status(201).json({ success: true, data: student });
});

const getMyProfile = asyncHandler(async (req, res) => {
  const student = await findStudentByEmail(req.user.universityEmail);
  if (!student) return res.status(404).json({ success: false, message: "Profile not found" });
  res.json({ success: true, data: student });
});

const getPublicProfile = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid student id" });
  }
  const student = await Student.findById(req.params.id).select("name department year profilePhoto");
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });
  res.json({ success: true, data: student });
});

const updateProfile = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ universityEmail: req.user.universityEmail });
  if (!student) return res.status(404).json({ success: false, message: "Profile not found" });

  Object.assign(student, profileFields(req.body));
  await student.save();
  res.json({ success: true, data: student });
});

const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No image file provided" });

  const student = await findStudentByEmail(req.user.universityEmail);
  if (!student) {
    await deleteUploadedFile(req.file.path);
    return res.status(404).json({ success: false, message: "Profile not found. Complete setup first." });
  }

  if (student.profilePhoto) await deleteUploadedFile(student.profilePhoto);

  student.profilePhoto = req.file.path;
  await student.save();

  res.json({ success: true, data: student });
});

const deletePhoto = asyncHandler(async (req, res) => {
  const student = await findStudentByEmail(req.user.universityEmail);
  if (!student) return res.status(404).json({ success: false, message: "Profile not found" });

  if (student.profilePhoto) await deleteUploadedFile(student.profilePhoto);
  student.profilePhoto = null;
  await student.save();

  res.json({ success: true, data: student });
});

const uploadStudentIdCard = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No ID card image provided" });
  }

  const student = await findStudentByEmail(req.user.universityEmail);
  if (!student) {
    await deleteUploadedFile(req.file.path);
    return res.status(404).json({ success: false, message: "Profile not found. Complete setup first." });
  }

  if (student.studentIdCard) await deleteUploadedFile(student.studentIdCard);

  student.studentIdCard = req.file.path;
  student.idVerificationStatus = "pending";
  student.idVerificationNote = null;
  await student.save();

  res.json({ success: true, data: student });
});

const deleteProfile = asyncHandler(async (req, res) => {
  const student = await Student.findOneAndDelete({
    universityEmail: req.user.universityEmail,
  });
  if (!student) return res.status(404).json({ success: false, message: "Profile not found" });

  if (student.profilePhoto) await deleteUploadedFile(student.profilePhoto);
  if (student.studentIdCard) await deleteUploadedFile(student.studentIdCard);

  const rides = await Ride.find({ poster: student._id }).select("_id");
  const rideIds = rides.map((r) => r._id);
  await Booking.deleteMany({ $or: [{ ride: { $in: rideIds } }, { rider: student._id }] });
  await Ride.deleteMany({ poster: student._id });

  res.json({ success: true, message: "Account deleted" });
});

module.exports = {
  createProfile,
  getMyProfile,
  getPublicProfile,
  updateProfile,
  uploadPhoto,
  deletePhoto,
  uploadStudentIdCard,
  deleteProfile,
};
