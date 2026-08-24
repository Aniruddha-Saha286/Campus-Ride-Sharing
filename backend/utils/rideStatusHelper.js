const formatTimeline = (timeline) =>
  timeline.map((t) => ({
    status: t.status,
    timestamp: t.timestamp,
    updatedBy: t.updatedBy
      ? { _id: t.updatedBy._id, name: t.updatedBy.name, profilePhoto: t.updatedBy.profilePhoto }
      : null,
  }));

const formatRide = (ride, formatPublicStudent) =>
  ride
    ? {
        _id: ride._id,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        pickupLat: ride.pickupLat ?? null,
        pickupLng: ride.pickupLng ?? null,
        dropoffLat: ride.dropoffLat ?? null,
        dropoffLng: ride.dropoffLng ?? null,
        departureTime: ride.departureTime,
        seats: ride.seats,
        charge: ride.charge || 0,
        status: ride.status,
        poster: formatPublicStudent(ride.poster),
      }
    : null;

const POSTER_SELECT = "name department year profilePhoto idVerificationStatus";

module.exports = { formatTimeline, formatRide, POSTER_SELECT };
