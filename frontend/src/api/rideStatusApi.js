import { client } from "./api";

export const getMyRideStatuses = () => client.get("/ride-statuses/mine");
export const getRideStatus = (rideId) => client.get(`/ride-statuses/${rideId}`);
export const updateRideStatus = (rideId, tripStatus) =>
  client.put(`/ride-statuses/${rideId}`, { tripStatus });
