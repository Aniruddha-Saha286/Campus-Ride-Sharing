const { OAuth2Client } = require("google-auth-library");
const Student = require("../models/Student");
const { signToken } = require("../utils/jwt");
const { getBanMessage } = require("../utils/ban");

const ALLOWED_DOMAINS = ["g.bracu.ac.bd", "bracu.ac.bd"];

const googleLogin = async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res
        .status(500)
        .json({ success: false, message: "GOOGLE_CLIENT_ID is not configured on the server" });
    }

    const google = new OAuth2Client(clientId);
    const ticket = await google.verifyIdToken({
      idToken: req.body.credential,
      audience: clientId,
    });

    const { sub, email, email_verified } = ticket.getPayload();

    if (!email_verified) {
      return res.status(401).json({ success: false, message: "Your Google email is not verified" });
    }

    const domain = (email || "").split("@")[1];
    if (!ALLOWED_DOMAINS.includes(domain)) {
      return res
        .status(403)
        .json({ success: false, message: "Please sign in with your university GSuite account" });
    }

    const student = await Student.findOne({ universityEmail: email });
    if (student && student.isBanned) {
      return res.status(403).json({ success: false, message: getBanMessage(student) });
    }

    const token = signToken({ id: sub, universityEmail: email });

    res.json({ success: true, token, universityEmail: email });
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid Google sign-in" });
  }
};

module.exports = { googleLogin };
