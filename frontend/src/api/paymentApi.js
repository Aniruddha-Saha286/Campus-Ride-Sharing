import { client } from "./api";

export const markPaymentSettled = (rideId, requestId) =>
  client.put(`/rides/${rideId}/requests/${requestId}/settle-payment`);
