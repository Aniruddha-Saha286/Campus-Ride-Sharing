const jwt = require("jsonwebtoken");
const Student = require("../models/Student");
const { getBanMessage } = require("../utils/ban");
const { subscribe } = require("../utils/notifier");

const streamEvents = async (req, res) => {
  const token = req.query.token;
  if (!token || !String(token).trim()) {
    return res.status(401).json({ success: false, message: "Not authorized, no token provided" });
  }

  let user;
  try {
    user = jwt.verify(String(token).trim(), process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: "Not authorized, token invalid or expired" });
  }

  if (!user || !user.id) {
    return res.status(401).json({ success: false, message: "Not authorized, token invalid or expired" });
  }

  if (user.universityEmail) {
    const student = await Student.findOne({ universityEmail: user.universityEmail });
    if (student && student.isBanned) {
      return res.status(403).json({ success: false, message: getBanMessage(student) });
    }
  }

  subscribe(user.id, res);
};

module.exports = { streamEvents };
