const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Student = require("../models/Student");

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      return res.status(500).json({ success: false, message: "Admin credentials are not configured" });
    }

    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: "Invalid admin credentials" });
    }

    const token = jwt.sign(
      { id: "admin", role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listVerifications = async (req, res) => {
  try {
    const allowed = ["pending", "approved", "rejected"];
    const status = allowed.includes(req.query.status) ? req.query.status : "pending";

    const students = await Student.find({ idVerificationStatus: status })
      .select(
        "name department year studentId universityEmail studentIdCard " +
          "idVerificationStatus idVerificationNote createdAt"
      )
      .sort({ createdAt: 1 });

    res.json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getVerification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid student id" });
    }

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listUsers = async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const banStudent = async (req, res) => {
  try {
    const { reason } = req.body || {};
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    student.isBanned = true;
    student.banReason = (reason && reason.trim()) || "Account banned for breaking the rules";
    student.bannedAt = new Date();
    await student.save();

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const unbanStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    student.isBanned = false;
    student.banReason = null;
    student.bannedAt = null;
    await student.save();

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const reviewVerification = async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  adminLogin,
  listVerifications,
  getVerification,
  listUsers,
  reviewVerification,
  banStudent,
  unbanStudent,
};
