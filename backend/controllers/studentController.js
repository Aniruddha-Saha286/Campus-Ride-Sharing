const mongoose = require("mongoose");
const Student = require("../models/Student");
const { deleteUploadedFile } = require("../utils/file");

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

const createProfile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "University ID card is required" });
    }

    const cardPath = `uploads/id-cards/${req.file.filename}`;

    const existing = await Student.findOne({ universityEmail: req.user.universityEmail });
    if (existing) {
      deleteUploadedFile(cardPath);
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
      throw err;
    }

    res.status(201).json({ success: true, data: student });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Profile already exists for this account" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const student = await Student.findOne({ universityEmail: req.user.universityEmail });
    if (!student) return res.status(404).json({ success: false, message: "Profile not found" });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getPublicProfile = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid student id" });
    }
    const student = await Student.findById(req.params.id).select("name department year profilePhoto");
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { universityEmail: req.user.universityEmail },
      {
        ...profileFields(req.body),
        profileCompleted: Student.isProfileComplete(req.body),
      },
      { new: true, runValidators: true }
    );

    if (!student) return res.status(404).json({ success: false, message: "Profile not found" });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No image file provided" });

    const student = await Student.findOne({ universityEmail: req.user.universityEmail });
    if (!student) {
      deleteUploadedFile(`uploads/profile-photos/${req.file.filename}`);
      return res.status(404).json({ success: false, message: "Profile not found. Complete setup first." });
    }

    if (student.profilePhoto) await deleteUploadedFile(student.profilePhoto);

    student.profilePhoto = `uploads/profile-photos/${req.file.filename}`;
    await student.save();

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deletePhoto = async (req, res) => {
  try {
    const student = await Student.findOne({ universityEmail: req.user.universityEmail });
    if (!student) return res.status(404).json({ success: false, message: "Profile not found" });

    if (student.profilePhoto) await deleteUploadedFile(student.profilePhoto);
    student.profilePhoto = null;
    await student.save();

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const uploadStudentIdCard = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No ID card image provided" });
    }

    const student = await Student.findOne({ universityEmail: req.user.universityEmail });
    if (!student) {
      deleteUploadedFile(`uploads/id-cards/${req.file.filename}`);
      return res.status(404).json({ success: false, message: "Profile not found. Complete setup first." });
    }

    if (student.studentIdCard) await deleteUploadedFile(student.studentIdCard);

    student.studentIdCard = `uploads/id-cards/${req.file.filename}`;
    student.idVerificationStatus = "pending";
    student.idVerificationNote = null;
    await student.save();

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteProfile = async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({
      universityEmail: req.user.universityEmail,
    });
    if (!student) return res.status(404).json({ success: false, message: "Profile not found" });

    if (student.profilePhoto) await deleteUploadedFile(student.profilePhoto);
    if (student.studentIdCard) await deleteUploadedFile(student.studentIdCard);

    res.json({ success: true, message: "Account deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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
