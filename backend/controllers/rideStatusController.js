const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const RideStatus = require("../models/RideStatus");
const asyncHandler = require("../utils/asyncHandler");
const { findMe, formatPublicStudent } = require("../utils/studentHelper");
const { TRIP_STATUSES } = require("../models/RideStatus");
const { formatTimeline, formatRide, POSTER_SELECT } = require("../utils/rideStatusHelper");

const VALID_TRANSITIONS = {
  upcoming: ["ongoing", "completed"],
  ongoing: ["completed"],
  completed: [],
};

const TIMELINE_POPULATE = { path: "timeline.updatedBy", select: "name profilePhoto" };

const getOrCreateStatus = async (rideId) => {
  let doc = await RideStatus.findOne({ ride: rideId });
  if (!doc) {
    doc = await RideStatus.create({ ride: rideId, tripStatus: "upcoming", timeline: [{ status: "upcoming" }] });
  }
  return doc;
};

const checkRideAccess = async (rideId, me) => {
  const isPoster = String(rideId.poster?._id || rideId.poster) === String(me._id);
  const booking = await Booking.findOne({ ride: rideId._id, rider: me._id, status: "accepted" });
  return { isPoster, hasAccess: isPoster || !!booking };
};

const getMyRideStatuses = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const postedRides = await Ride.find({ poster: me._id, status: "open" }).select("_id");
  const acceptedBookings = await Booking.find({
    rider: me._id,
    status: "accepted",
  }).select("ride");
  const acceptedRideIds = acceptedBookings.map((b) => b.ride);

  const rideIds = [
    ...new Set([
      ...postedRides.map((r) => String(r._id)),
      ...acceptedRideIds.map((r) => String(r)),
    ]),
  ];

  if (rideIds.length === 0) {
    return res.json({ success: true, data: [] });
  }

  let statuses = await RideStatus.find({
    ride: { $in: rideIds },
    tripStatus: { $ne: "completed" },
  });

  const existingRideIds = new Set(statuses.map((s) => String(s.ride)));
  const missing = rideIds.filter((id) => !existingRideIds.has(id));
  if (missing.length > 0) {
    const newDocs = await RideStatus.insertMany(
      missing.map((id) => ({ ride: id, tripStatus: "upcoming", timeline: [{ status: "upcoming" }] }))
    );
    statuses = statuses.concat(newDocs);
  }

  await RideStatus.populate(statuses, TIMELINE_POPULATE);

  const rideMap = new Map();
  const rides = await Ride.find({ _id: { $in: rideIds } })
    .populate("poster", POSTER_SELECT)
    .select("pickup dropoff pickupLat pickupLng dropoffLat dropoffLng departureTime seats charge poster status");

  rides.forEach((r) => rideMap.set(String(r._id), r));

  const data = statuses.map((s) => {
    const ride = rideMap.get(String(s.ride));
    return {
      _id: s._id,
      tripStatus: s.tripStatus,
      updatedAt: s.updatedAt,
      timeline: formatTimeline(s.timeline),
      ride: formatRide(ride, formatPublicStudent),
      role: ride && String(ride.poster._id) === String(me._id) ? "poster" : "rider",
    };
  });

  res.json({ success: true, data });
});

const getRideStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const ride = await Ride.findById(req.params.rideId).populate("poster", POSTER_SELECT);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  const { isPoster, hasAccess } = await checkRideAccess(ride, me);
  if (!hasAccess) {
    return res.status(403).json({ success: false, message: "You are not part of this ride" });
  }

  const statusDoc = await getOrCreateStatus(ride._id);
  await statusDoc.populate(TIMELINE_POPULATE);

  res.json({
    success: true,
    data: {
      _id: statusDoc._id,
      tripStatus: statusDoc.tripStatus,
      updatedAt: statusDoc.updatedAt,
      timeline: formatTimeline(statusDoc.timeline),
      ride: formatRide(ride, formatPublicStudent),
      role: isPoster ? "poster" : "rider",
    },
  });
});

const updateRideStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.rideId)) {
    return res.status(400).json({ success: false, message: "Invalid ride id" });
  }
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { tripStatus } = req.body || {};
  if (!tripStatus || !TRIP_STATUSES.includes(tripStatus)) {
    return res.status(400).json({ success: false, message: "tripStatus must be one of: upcoming, ongoing, completed" });
  }

  const ride = await Ride.findById(req.params.rideId);
  if (!ride) return res.status(404).json({ success: false, message: "Ride not found" });

  const { isPoster, hasAccess } = await checkRideAccess(ride, me);
  if (!hasAccess) {
    return res.status(403).json({ success: false, message: "Only the ride poster or an accepted rider can update status" });
  }

  const statusDoc = await getOrCreateStatus(ride._id);

  if (statusDoc.tripStatus === tripStatus) {
    return res.status(400).json({ success: false, message: `Ride is already ${tripStatus}` });
  }

  const allowed = VALID_TRANSITIONS[statusDoc.tripStatus] || [];
  if (!allowed.includes(tripStatus)) {
    return res.status(400).json({ success: false, message: `Cannot transition from ${statusDoc.tripStatus} to ${tripStatus}` });
  }

  statusDoc.tripStatus = tripStatus;
  statusDoc.updatedBy = me._id;
  statusDoc.timeline.push({ status: tripStatus, timestamp: new Date(), updatedBy: me._id });
  await statusDoc.save();


  await statusDoc.populate(TIMELINE_POPULATE);

  res.json({
    success: true,
    data: {
      _id: statusDoc._id,
      tripStatus: statusDoc.tripStatus,
      updatedAt: statusDoc.updatedAt,
      timeline: formatTimeline(statusDoc.timeline),
      ride: {
        _id: ride._id,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        departureTime: ride.departureTime,
      },
      role: isPoster ? "poster" : "rider",
    },
  });
});

module.exports = { getMyRideStatuses, getRideStatus, updateRideStatus };
