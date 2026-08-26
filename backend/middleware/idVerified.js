const Student = require("../models/Student");

const idVerified = async (req, res, next) => {
  try {
    if (req.user && (req.user.role === "admin" || req.user.admin)) {
      return next();
    }
    if (!req.user || !req.user.universityEmail) {
      return res.status(403).json({ success: false, message: "ID card verification required to access this feature" });
    }
    const student = await Student.findOne({ universityEmail: req.user.universityEmail }).select("idVerificationStatus");
    if (!student) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    if (student.idVerificationStatus !== "approved") {
      return res.status(403).json({ success: false, message: "Your university ID card must be verified by an admin before you can use this feature" });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = idVerified;
