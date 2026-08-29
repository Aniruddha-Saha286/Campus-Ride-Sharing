import { client } from "./api";

export const createRide = (payload) => client.post("/rides", payload);
export const listRides = () => client.get("/rides");
export const getMyRides = () => client.get("/rides/mine");
export const requestSeat = (rideId, seats = 1) => client.post(`/rides/${rideId}/requests`, { seats });
export const respondToRequest = (rideId, requestId, decision) =>
  client.put(`/rides/${rideId}/requests/${requestId}`, { decision });
export const cancelRequest = (rideId, requestId, reason) =>
  client.delete(`/rides/${rideId}/requests/${requestId}`, { data: { reason } });
export const cancelRide = (rideId, cancelReason = "", refundMethod = null, refundTransactionId = null) =>
  client.delete(`/rides/${rideId}`, { data: { cancelReason, refundMethod, refundTransactionId } });
export const updateRide = (rideId, payload) => client.put(`/rides/${rideId}`, payload);
export const updateBookingSeats = (rideId, requestId, seats) =>
  client.put(`/rides/${rideId}/requests/${requestId}/seats`, { seats });
export const getRequestContact = (requestId) =>
  client.get(`/requests/${requestId}/contact`);

