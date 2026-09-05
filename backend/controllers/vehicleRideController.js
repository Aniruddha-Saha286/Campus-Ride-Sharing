const VehicleRide = require("../models/VehicleRide");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const RideStatus = require("../models/RideStatus");
const AutoCostSplit = require("../models/AutoCostSplit");
const asyncHandler = require("../utils/asyncHandler");
const { findMe, formatPublicStudent, getDriverRating } = require("../utils/studentHelper");
const { isInsideDhakaCoverage } = require("../utils/dhakaCoverage");
const {
  VEHICLE_CATEGORIES,
  VEHICLE_TYPES,
  VEHICLE_SPECS,
  generateDummyRegistration,
} = VehicleRide;
const { validateRegistrationPlate } = require("../utils/vehicleRegistration");

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const validateVehicleSeats = (vehicleType, seats) => {
  const spec = VEHICLE_SPECS[vehicleType];
  if (!spec) {
    return { valid: false, message: `Unknown vehicle type: ${vehicleType}` };
  }

  const numSeats = Number(seats);
  if (!Number.isInteger(numSeats)) {
    return { valid: false, message: "Seats must be a whole number" };
  }

  if (vehicleType === "Motorbike") {
    if (numSeats !== 1) {
      return {
        valid: false,
        message: "Motorbike is a two-wheeler and can only allocate exactly 1 passenger seat",
      };
    }
    return { valid: true, maxSeats: 1, allocatedSeats: 1 };
  }

  if (numSeats < 1 || numSeats > spec.maxSeats) {
    return {
      valid: false,
      message: `${vehicleType} can allocate between 1 and ${spec.maxSeats} seats`,
    };
  }

  return { valid: true, maxSeats: spec.maxSeats, allocatedSeats: numSeats };
};

const findActiveBookingForRider = async (riderId) => {
  try {
    const activePostedRide = await Ride.findOne({
      poster: riderId,
      status: { $in: ["open", "pending_cancellation"] },
    });
    if (activePostedRide) {
      const statusDoc = await RideStatus.findOne({ ride: activePostedRide._id }).select("tripStatus");
      const tripStatus = statusDoc?.tripStatus || "upcoming";
      if (tripStatus !== "completed") {
        return {
          booking: { status: "accepted" },
          ride: activePostedRide,
          tripStatus,
          isDriver: true,
        };
      }
    }

    const bookings = await Booking.find({
      rider: riderId,
      status: { $in: ["accepted", "pending"] },
    }).populate("ride");

    if (!bookings || bookings.length === 0) return null;

    bookings.sort((a, b) => (a.status === "accepted" ? -1 : 1));

    const rideIds = bookings.map((b) => b.ride?._id).filter(Boolean);
    const statuses = await RideStatus.find({ ride: { $in: rideIds } }).select("ride tripStatus");
    const tripStatusMap = new Map(statuses.map((s) => [String(s.ride), s.tripStatus]));

    for (const b of bookings) {
      if (!b.ride) continue;
      if (b.ride.status === "cancelled" || b.ride.status === "completed") continue;
      const tripStatus = tripStatusMap.get(String(b.ride._id)) || "upcoming";
      if (tripStatus === "completed") continue;

      return {
        booking: b,
        ride: b.ride,
        tripStatus,
        isDriver: false,
      };
    }
  } catch (err) {
    console.warn("findActiveBookingForRider non-fatal error:", err.message);
  }
  return null;
};

const createVehicleRide = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });
  if (me.isBanned) return res.status(403).json({ success: false, message: "Your account is banned" });

  const activeBookingInfo = await findActiveBookingForRider(me._id);
  if (activeBookingInfo) {
    if (activeBookingInfo.isDriver) {
      return res.status(400).json({
        success: false,
        message: `You already have an active posted ride from ${activeBookingInfo.ride.pickup} to ${activeBookingInfo.ride.dropoff}. You cannot post more than 1 ride until your current ride is cancelled or ended.`,
      });
    }
    if (activeBookingInfo.booking?.status === "accepted") {
      return res.status(400).json({
        success: false,
        message: `You already have an active booked ride from ${activeBookingInfo.ride.pickup} to ${activeBookingInfo.ride.dropoff}. You cannot post a ride until your current ride is completed.`,
      });
    }
    if (activeBookingInfo.booking?.status === "pending") {
      return res.status(400).json({
        success: false,
        message: `You already have a pending seat request for a ride from ${activeBookingInfo.ride.pickup} to ${activeBookingInfo.ride.dropoff}. Please cancel that request before posting a ride.`,
      });
    }
  }

  const {
    pickup,
    dropoff,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    departureTime,
    seats,
    charge,
    notes,
    vehicleCategory,
    vehicleType,
    registrationNumber,
  } = req.body || {};

  if (!pickup || !String(pickup).trim()) {
    return res.status(400).json({ success: false, message: "Pickup location is required" });
  }
  if (!dropoff || !String(dropoff).trim()) {
    return res.status(400).json({ success: false, message: "Drop-off location is required" });
  }

  if (pickupLat != null || pickupLng != null) {
    if (!isInsideDhakaCoverage(pickupLat, pickupLng)) {
      return res.status(400).json({ success: false, message: "Pickup and destination must be within the Campus Ride service area (Dhaka, Gazipur and Narayanganj)." });
    }
  }
  if (dropoffLat != null || dropoffLng != null) {
    if (!isInsideDhakaCoverage(dropoffLat, dropoffLng)) {
      return res.status(400).json({ success: false, message: "Pickup and destination must be within the Campus Ride service area (Dhaka, Gazipur and Narayanganj)." });
    }
  }

  if (!departureTime || !TIME_REGEX.test(String(departureTime).trim())) {
    return res.status(400).json({
      success: false,
      message: "Departure time must be in HH:MM (24-hour) format",
    });
  }

  const validCategory = String(vehicleCategory || "").trim();
  const validType = String(vehicleType || "").trim();

  if (!VEHICLE_CATEGORIES.includes(validCategory)) {
    return res.status(400).json({
      success: false,
      message: `Invalid vehicle category. Allowed: ${VEHICLE_CATEGORIES.join(", ")}`,
    });
  }

  if (!VEHICLE_TYPES.includes(validType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid vehicle type. Allowed: ${VEHICLE_TYPES.join(", ")}`,
    });
  }

  const spec = VEHICLE_SPECS[validType];
  if (spec.category !== validCategory) {
    return res.status(400).json({
      success: false,
      message: `${validType} belongs to category '${spec.category}', not '${validCategory}'`,
    });
  }

  const seatCheck = validateVehicleSeats(validType, seats);
  if (!seatCheck.valid) {
    return res.status(400).json({ success: false, message: seatCheck.message });
  }

  let regNo = String(registrationNumber || "").trim();
  if (!regNo) {
    regNo = generateDummyRegistration();
  }

  const regCheck = validateRegistrationPlate(regNo);
  if (!regCheck.valid) {
    return res.status(400).json({
      success: false,
      message: regCheck.message || "Enter a valid Bangladesh vehicle registration number (e.g. Dhaka Metro-Ga 12-3456 or Gazipur-Ga 11-2456).",
    });
  }
  regNo = regCheck.canonical;

  const numericCharge = charge !== undefined && charge !== null && charge !== "" ? Math.max(0, Number(charge)) : 0;
  const ride = await Ride.create({
    poster: me._id,
    pickup: String(pickup).trim(),
    dropoff: String(dropoff).trim(),
    pickupLat: pickupLat != null ? Number(pickupLat) : null,
    pickupLng: pickupLng != null ? Number(pickupLng) : null,
    dropoffLat: dropoffLat != null ? Number(dropoffLat) : null,
    dropoffLng: dropoffLng != null ? Number(dropoffLng) : null,
    departureTime: String(departureTime).trim(),
    seats: seatCheck.allocatedSeats,
    charge: numericCharge,
    notes: notes ? String(notes).trim() : "",
  });

  const vehicleRide = await VehicleRide.create({
    ride: ride._id,
    poster: me._id,
    vehicleCategory: validCategory,
    vehicleType: validType,
    registrationNumber: regNo,
    maxSeats: seatCheck.maxSeats,
    allocatedSeats: seatCheck.allocatedSeats,
    notes: notes ? String(notes).trim() : "",
  });

  try {
    await RideStatus.findOneAndUpdate(
      { ride: ride._id },
      {
        $setOnInsert: {
          ride: ride._id,
          tripStatus: "upcoming",
          timeline: [{ status: "upcoming", timestamp: new Date(), updatedBy: me._id }],
        },
      },
      { upsert: true }
    );

    if (numericCharge > 0) {
      await AutoCostSplit.recalculateSplit(ride._id);
    }
  } catch (initErr) {
    console.warn("Non-fatal error initializing split/status:", initErr.message);
  }

  const driverRating = await getDriverRating(me._id);

  res.status(201).json({
    success: true,
    message: `${validType} ride offer published successfully! Registration No: ${regNo}`,
    data: {
      _id: ride._id,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      departureTime: ride.departureTime,
      seats: seatCheck.allocatedSeats,
      seatsLeft: seatCheck.allocatedSeats,
      charge: ride.charge,
      notes: ride.notes,
      status: ride.status,
      createdAt: ride.createdAt,
      poster: formatPublicStudent(me, driverRating),
      vehicle: {
        _id: vehicleRide._id,
        category: vehicleRide.vehicleCategory,
        vehicleType: vehicleRide.vehicleType,
        registrationNumber: vehicleRide.registrationNumber,
        maxSeats: vehicleRide.maxSeats,
        allocatedSeats: vehicleRide.allocatedSeats,
      },
    },
  });
});

const listVehicleRides = asyncHandler(async (req, res) => {
  const me = await findMe(req);
  if (!me) return res.status(404).json({ success: false, message: "Profile not found" });

  const { category, vehicleType, search } = req.query || {};

  const activeBookingInfo = await findActiveBookingForRider(me._id);

  const rides = await Ride.find({ status: "open" })
    .populate("poster", "name department year profilePhoto phone idVerificationStatus")
    .sort({ departureTime: 1, createdAt: -1 })
    .lean();

  if (rides.length === 0) {
    return res.json({
      success: true,
      data: [],
      counts: {
        all: 0,
        twoWheeler: 0,
        fourWheeler: 0,
        motorbike: 0,
        car: 0,
        jeep: 0,
        microbus: 0,
      },
      activeBooking: activeBookingInfo
        ? {
            rideId: activeBookingInfo.ride._id,
            pickup: activeBookingInfo.ride.pickup,
            dropoff: activeBookingInfo.ride.dropoff,
            departureTime: activeBookingInfo.ride.departureTime,
            status: activeBookingInfo.booking.status,
            tripStatus: activeBookingInfo.tripStatus,
            isDriver: Boolean(activeBookingInfo.isDriver),
          }
        : null,
    });
  }

  const rideIds = rides.map((r) => r._id);

  const vehicleRecords = await VehicleRide.find({ ride: { $in: rideIds } }).lean();
  const vehicleMap = new Map(vehicleRecords.map((v) => [String(v.ride), v]));

  const acceptedBookings = await Booking.find({
    ride: { $in: rideIds },
    status: "accepted",
  }).select("ride seats");
  const bookedSeatsMap = new Map();
  acceptedBookings.forEach((b) => {
    const key = String(b.ride);
    bookedSeatsMap.set(key, (bookedSeatsMap.get(key) || 0) + (b.seats || 1));
  });

  const statuses = await RideStatus.find({ ride: { $in: rideIds } }).select("ride tripStatus").lean();
  const tripStatusMap = new Map(statuses.map((s) => [String(s.ride), s.tripStatus]));

  const posterIds = Array.from(new Set(rides.map((r) => r.poster?._id).filter(Boolean)));
  const ratingMap = new Map();
  await Promise.all(
    posterIds.map(async (pid) => {
      const summary = await getDriverRating(pid);
      ratingMap.set(String(pid), summary);
    })
  );

  const myBookings = await Booking.find({ ride: { $in: rideIds }, rider: me._id }).lean();
  const myBookingMap = new Map(myBookings.map((b) => [String(b.ride), b]));

  const enrichedRides = rides
    .filter((r) => r.poster)
    .map((r) => {
      const isMyRide = Boolean(me && me._id && String(r.poster._id) === String(me._id));
      const booked = bookedSeatsMap.get(String(r._id)) || 0;
      let vInfo = vehicleMap.get(String(r._id));

      if (!vInfo) {
        const dummySeats = r.seats || 4;
        let inferredType = "Car";
        if (dummySeats === 1) inferredType = "Motorbike";
        else if (dummySeats > 4) inferredType = "Jeep";

        const inferredCategory = inferredType === "Motorbike" ? "Two-wheeler" : "Four-wheeler";
        vInfo = {
          vehicleCategory: inferredCategory,
          vehicleType: inferredType,
          registrationNumber: `34-${String(r._id).slice(-4).padStart(4, "0")}`,
          maxSeats: VEHICLE_SPECS[inferredType]?.maxSeats || 4,
          allocatedSeats: dummySeats,
        };
      }

      const totalSeats = vInfo.allocatedSeats || r.seats || 1;
      const seatsLeft = Math.max(0, totalSeats - booked);
      const tripStatus = tripStatusMap.get(String(r._id)) || "upcoming";
      const posterRating = ratingMap.get(String(r.poster._id)) || null;
      const myBooking = myBookingMap.get(String(r._id)) || null;

      return {
        _id: r._id,
        isMyRide,
        pickup: r.pickup,
        dropoff: r.dropoff,
        pickupLat: r.pickupLat,
        pickupLng: r.pickupLng,
        dropoffLat: r.dropoffLat,
        dropoffLng: r.dropoffLng,
        departureTime: r.departureTime,
        seats: totalSeats,
        seatsLeft,
        charge: r.charge || 0,
        notes: r.notes || "",
        status: r.status,
        tripStatus,
        createdAt: r.createdAt,
        poster: formatPublicStudent(r.poster, posterRating),
        myBooking: myBooking
          ? {
              _id: myBooking._id,
              status: myBooking.status,
              seats: myBooking.seats || 1,
              paymentStatus: myBooking.paymentStatus,
            }
          : null,
        vehicle: {
          category: vInfo.vehicleCategory,
          vehicleType: vInfo.vehicleType,
          registrationNumber: vInfo.registrationNumber,
          maxSeats: vInfo.maxSeats,
          allocatedSeats: totalSeats,
          description: VEHICLE_SPECS[vInfo.vehicleType]?.description || "",
        },
      };
    })
    .filter((r) => ((r.tripStatus === "upcoming" || !r.tripStatus) && r.seatsLeft > 0) || r.myBooking != null || r.isMyRide);

  const counts = {
    all: enrichedRides.length,
    twoWheeler: enrichedRides.filter((r) => r.vehicle.category === "Two-wheeler").length,
    fourWheeler: enrichedRides.filter((r) => r.vehicle.category === "Four-wheeler").length,
    motorbike: enrichedRides.filter((r) => r.vehicle.vehicleType === "Motorbike").length,
    car: enrichedRides.filter((r) => r.vehicle.vehicleType === "Car").length,
    jeep: enrichedRides.filter((r) => r.vehicle.vehicleType === "Jeep").length,
    microbus: enrichedRides.filter((r) => r.vehicle.vehicleType === "Microbus").length,
  };

  let filtered = enrichedRides;

  if (category && category !== "all") {
    filtered = filtered.filter((r) => r.vehicle.category.toLowerCase() === String(category).toLowerCase());
  }

  if (vehicleType && vehicleType !== "all") {
    filtered = filtered.filter((r) => r.vehicle.vehicleType.toLowerCase() === String(vehicleType).toLowerCase());
  }

  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        (r.pickup || "").toLowerCase().includes(q) ||
        (r.dropoff || "").toLowerCase().includes(q) ||
        (r.poster?.name || "").toLowerCase().includes(q) ||
        (r.vehicle?.vehicleType || "").toLowerCase().includes(q) ||
        (r.vehicle?.registrationNumber || "").toLowerCase().includes(q)
    );
  }

  res.json({
    success: true,
    data: filtered,
    counts,
    activeBooking: activeBookingInfo
      ? {
          rideId: activeBookingInfo.ride._id,
          pickup: activeBookingInfo.ride.pickup,
          dropoff: activeBookingInfo.ride.dropoff,
          departureTime: activeBookingInfo.ride.departureTime,
          status: activeBookingInfo.booking.status,
          tripStatus: activeBookingInfo.tripStatus,
          isDriver: Boolean(activeBookingInfo.isDriver),
        }
      : null,
  });
});

const getVehicleSpecs = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      categories: VEHICLE_CATEGORIES,
      types: VEHICLE_TYPES,
      specs: VEHICLE_SPECS,
    },
  });
});

const getDummyRegistration = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      registrationNumber: generateDummyRegistration(),
    },
  });
});

module.exports = {
  createVehicleRide,
  listVehicleRides,
  getVehicleSpecs,
  getDummyRegistration,
};
