const mongoose = require("mongoose");
const Student = require("../models/Student");
const Rating = require("../models/Rating");

const findMe = (req) => Student.findOne({ universityEmail: req.user.universityEmail });

const publicPosterSelect = "name department year profilePhoto idVerificationStatus phone";

const idVerified = (student) => Boolean(student && student.idVerificationStatus === "approved");

const formatPublicStudent = (student, rating = null) => {
  if (!student) return null;
  return {
    _id: student._id,
    name: student.name,
    department: student.department,
    year: student.year,
    phone: student.phone || null,
    profilePhoto: student.profilePhoto,
    idVerified: idVerified(student),
    rating: rating || student.rating || null,
  };
};

const getDriverRating = async (driverId) => {
  if (!driverId) return null;
  const objectId = mongoose.isValidObjectId(driverId)
    ? new mongoose.Types.ObjectId(driverId)
    : null;
  if (!objectId) return null;

  const result = await Rating.aggregate([
    { $match: { driver: objectId } },
    {
      $group: {
        _id: "$driver",
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (result.length === 0) return { average: null, count: 0 };
  return {
    average: Math.round(result[0].average * 10) / 10,
    count: result[0].count,
  };
};

const getRatingsForDrivers = async (driverIds) => {
  if (!driverIds || driverIds.length === 0) return new Map();
  const validIds = driverIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (validIds.length === 0) return new Map();

  const aggregates = await Rating.aggregate([
    { $match: { driver: { $in: validIds } } },
    {
      $group: {
        _id: "$driver",
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const map = new Map();
  aggregates.forEach((a) => {
    map.set(String(a._id), {
      average: Math.round(a.average * 10) / 10,
      count: a.count,
    });
  });
  return map;
};

module.exports = {
  findMe,
  publicPosterSelect,
  idVerified,
  formatPublicStudent,
  getDriverRating,
  getRatingsForDrivers,
};
