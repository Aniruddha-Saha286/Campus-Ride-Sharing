import { client } from "./api";

export const createRecurringFromRide = (rideId) =>
  client.post(`/recurring/from/${rideId}`);
export const listRecurringRides = () => client.get("/recurring/mine");
export const setRecurringStatus = (id, status) =>
  client.put(`/recurring/${id}/status`, { status });
export const deleteRecurringRide = (id) => client.delete(`/recurring/${id}`);
export const generateRecurringRides = () => client.post("/recurring/generate");
