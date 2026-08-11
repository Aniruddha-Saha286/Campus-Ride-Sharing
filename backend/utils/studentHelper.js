const Student = require("../models/Student");

const findMe = (req) => Student.findOne({ universityEmail: req.user.universityEmail });

const publicPosterSelect = "name department year profilePhoto idVerificationStatus";

const idVerified = (student) => Boolean(student && student.idVerificationStatus === "approved");

const formatPublicStudent = (student) => student ? {
  _id: student._id,
  name: student.name,
  department: student.department,
  year: student.year,
  profilePhoto: student.profilePhoto,
  idVerified: idVerified(student),
} : null;

module.exports = { findMe, publicPosterSelect, idVerified, formatPublicStudent };
