const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const { findMe, formatPublicStudent } = require("../utils/studentHelper");

exports.getDriverHistory = async (req, res) => {
  try {
    const me = await findMe(req);
    if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

    const rides = await Ride.find({ poster: me._id })
      .populate("poster", "name profilePhoto department year idVerificationStatus")
      .sort({ createdAt: -1 })
      .lean();

    const rideIds = rides.map((r) => r._id);
    const counts = await Booking.aggregate([
      { $match: { ride: { $in: rideIds }, status: "accepted" } },
      { $group: { _id: "$ride", count: { $sum: "$seats" } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

    const result = rides.map((ride) => ({
      _id: ride._id,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      departureTime: ride.departureTime,
      charge: ride.charge,
      seats: ride.seats,
      status: ride.status,
      createdAt: ride.createdAt,
      driver: formatPublicStudent(ride.poster),
      acceptedBookings: countMap.get(String(ride._id)) || 0,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("getDriverHistory error:", err);
    res.status(500).json({ success: false, message: "Could not load driver history." });
  }
};

exports.getPassengerHistory = async (req, res) => {
  try {
    const me = await findMe(req);
    if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

    const bookings = await Booking.find({
      rider: me._id,
      status: { $in: ["accepted", "declined", "cancelled"] },
    })
      .populate({
        path: "ride",
        populate: { path: "poster", select: "name profilePhoto department year idVerificationStatus" },
      })
      .populate("rider", "name profilePhoto department year idVerificationStatus")
      .sort({ createdAt: -1 })
      .lean();

    const result = bookings
      .filter((b) => b.ride)
      .map((b) => ({
        _id: b._id,
        pickup: b.ride.pickup,
        dropoff: b.ride.dropoff,
        departureTime: b.ride.departureTime,
        charge: b.ride.charge,
        seats: b.seats,
        status: b.status,
        createdAt: b.createdAt,
        driver: formatPublicStudent(b.ride.poster),
        passenger: formatPublicStudent(b.rider),
        rideId: b.ride._id,
      }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("getPassengerHistory error:", err);
    res.status(500).json({ success: false, message: "Could not load passenger history." });
  }
};
