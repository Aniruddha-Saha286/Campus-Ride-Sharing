const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const { getBanMessage } = require("../utils/ban");

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Not authorized, no token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);

    // Ban enforcement applies to student accounts only (admin tokens have no universityEmail).
    if (req.user.universityEmail) {
      const student = await Student.findOne({ universityEmail: req.user.universityEmail });
      if (student && student.isBanned) {
        return res.status(403).json({ success: false, message: getBanMessage(student) });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Not authorized, token invalid or expired" });
  }
};

module.exports = protect;
