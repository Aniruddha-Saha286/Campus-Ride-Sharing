const mongoose = require("mongoose");
const Student = require("../models/Student");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const CommuteProfile = require("../models/CommuteProfile");
const CommutePreference = require("../models/CommutePreference");
const asyncHandler = require("../utils/asyncHandler");
const { findMe } = require("../utils/studentHelper");

const { WEEKDAYS } = CommuteProfile;
const { TIME_12H_REGEX } = CommutePreference;

const timeToMinutes = (time) => {
  if (!time || typeof time !== "string") return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const preferredTimeToMinutes = (time) => {
  if (!time || typeof time !== "string") return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hours !== 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const normalizePreferredTime = (time) => {
  const match = String(time).trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return String(time).trim();
  const hours = String(Number(match[1])).padStart(2, "0");
  return `${hours}:${match[2]} ${match[3].toUpperCase()}`;
};

const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const similarity = (a, b) => {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  left.forEach((word) => {
    if (right.has(word)) intersection += 1;
  });
  return intersection / new Set([...left, ...right]).size;
};

const validateDays = (days, label = "Days") => {
  const validDays = Array.isArray(days) ? days.filter((d) => WEEKDAYS.includes(d)) : [];
  if (Array.isArray(days) && validDays.length !== days.length) {
    return { validDays, error: `${label} must be valid weekday abbreviations: Sun, Mon, Tue, Wed, Thu, Fri, Sat` };
  }
  return { validDays };
};

const resolveCommuteData = (pref, profile, student) => ({
  area: pref?.homeArea || student.homeArea,
  minutes: pref ? preferredTimeToMinutes(pref.preferredTime) : timeToMinutes(profile?.departureTime),
  days: pref?.recurringDays?.length ? pref.recurringDays : profile?.days || [],
});

const calculateScore = (myData, theirData) => {
  const parts = [{ value: similarity(myData.area, theirData.area), weight: 50 }];

  if (myData.minutes !== null && theirData.minutes !== null) {
    const diff = Math.abs(myData.minutes - theirData.minutes);
    parts.push({
      value: diff === 0 ? 1 : diff <= 15 ? 0.9 : diff <= 30 ? 0.8 : diff <= 60 ? 0.6 : 0.2,
      weight: 40,
    });
  }

  if (myData.days.length > 0 && theirData.days.length > 0) {
    const union = new Set([...myData.days, ...theirData.days]).size;
    const overlap = theirData.days.filter((d) => myData.days.includes(d)).length;
    parts.push({ value: union ? overlap / union : 0, weight: 10 });
  }

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const weighted = parts.reduce((sum, part) => sum + part.value * part.weight, 0);
  return totalWeight ? Math.round((weighted / totalWeight) * 100) : 0;
};

const acceptedBetween = async (meId, otherId) => {
  const myRideIds = await Ride.find({ poster: meId }).select("_id");
  const theirRideIds = await Ride.find({ poster: otherId }).select("_id");
  const [mine, theirs] = await Promise.all([
    Booking.exists({ ride: { $in: myRideIds.map((r) => r._id) }, rider: otherId, status: "accepted" }),
    Booking.exists({ ride: { $in: theirRideIds.map((r) => r._id) }, rider: meId, status: "accepted" }),
  ]);
  return Boolean(mine || theirs);
};

const getSuggestedMatches = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const [myPref, myProfile] = await Promise.all([
    CommutePreference.findOne({ student: me._id }),
    CommuteProfile.findOne({ student: me._id }),
  ]);
  const myData = resolveCommuteData(myPref, myProfile, me);

  const candidates = await Student.find({
    _id: { $ne: me._id },
    isBanned: false,
    idVerificationStatus: "approved",
  }).select("name department year homeArea profilePhoto");

  if (candidates.length === 0) return res.json({ success: true, data: [] });

  const ids = candidates.map((c) => c._id);
  const [prefs, profiles] = await Promise.all([
    CommutePreference.find({ student: { $in: ids } }),
    CommuteProfile.find({ student: { $in: ids } }),
  ]);
  const prefByStudent = new Map(prefs.map((p) => [String(p.student), p]));
  const profileByStudent = new Map(profiles.map((p) => [String(p.student), p]));

  const matches = candidates
    .map((candidate) => {
      const pref = prefByStudent.get(String(candidate._id));
      const profile = profileByStudent.get(String(candidate._id));

      const theirData = resolveCommuteData(pref, profile, candidate);
      const score = calculateScore(myData, theirData);

      return {
        student: {
          _id: candidate._id,
          name: candidate.name,
          department: candidate.department,
          year: candidate.year,
          homeArea: candidate.homeArea,
          profilePhoto: candidate.profilePhoto,
          idVerified: true,
        },
        score,
        destination: pref?.destination || profile?.destination || null,
        preferredTime: pref ? pref.preferredTime : null,
        departureTime: profile && !pref ? profile.departureTime : null,
        days: pref ? pref.recurringDays : profile?.days || [],
      };
    })
    .filter((match) => match && match.score > 0);

  matches.sort((a, b) => b.score - a.score);
  res.json({ success: true, data: matches.slice(0, 8) });
});

const getContactInfo = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.otherStudentId)) {
    return res.status(400).json({ success: false, message: "Invalid student id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const other = await Student.findById(req.params.otherStudentId);
  if (!other) return res.status(404).json({ success: false, message: "Student not found" });

  const accepted = await acceptedBetween(me._id, other._id);
  if (!accepted) {
    return res.status(403).json({
      success: false,
      message: "Contact info is hidden until seat request is accepted.",
    });
  }

  res.json({
    success: true,
    data: {
      _id: other._id,
      name: other.name,
      phone: other.phone,
      homeArea: other.homeArea,
      profilePhoto: other.profilePhoto,
      emergencyContact: other.emergencyContact,
    },
  });
});

const getMyCommuterPreference = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });
  const pref = await CommutePreference.findOne({ student: me._id });
  res.json({ success: true, data: pref || null });
});

const upsertCommuterPreference = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { homeArea, destination, preferredTime, recurringDays } = req.body || {};
  if (!homeArea || !String(homeArea).trim()) {
    return res.status(400).json({ success: false, message: "Home area is required" });
  }
  if (!destination || !String(destination).trim()) {
    return res.status(400).json({ success: false, message: "Destination is required" });
  }
  if (!preferredTime || !TIME_12H_REGEX.test(String(preferredTime).trim())) {
    return res.status(400).json({
      success: false,
      message: "Preferred time must be in 12-hour format, e.g. 08:30 AM",
    });
  }

  const { validDays, error: daysError } = validateDays(recurringDays, "Recurring days");
  if (daysError) return res.status(400).json({ success: false, message: daysError });

  const pref = await CommutePreference.findOneAndUpdate(
    { student: me._id },
    {
      student: me._id,
      homeArea: String(homeArea).trim(),
      destination: String(destination).trim(),
      preferredTime: normalizePreferredTime(preferredTime),
      recurringDays: validDays,
    },
    { new: true, runValidators: true, upsert: true }
  );

  res.json({ success: true, data: pref });
});

module.exports = {
  getSuggestedMatches,
  getContactInfo,
  getMyCommuterPreference,
  upsertCommuterPreference,
};
