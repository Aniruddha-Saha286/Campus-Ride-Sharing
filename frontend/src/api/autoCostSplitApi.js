import { client } from "./api";

/**
 * Fetch automatic cost split breakdown for a specific ride.
 * Divided equally among all confirmed riders by default.
 */
export const getRideSplit = (rideId) =>
  client.get(`/auto-cost-split/ride/${rideId}`);

/**
 * Driver updates the total trip cost, which immediately re-splits equally among confirmed riders.
 */
export const updateTotalTripCost = (rideId, totalTripCost) =>
  client.put(`/auto-cost-split/ride/${rideId}/total-cost`, { totalTripCost });

/**
 * Get all cost split rides where the logged-in student is driver or confirmed rider.
 */
export const getMyCostSplits = () =>
  client.get("/auto-cost-split/mine");

/**
 * Preview how any total trip cost is divided equally as riders join (1..N).
 */
export const previewCostSplit = (totalCost, maxSeats = 4) =>
  client.post("/auto-cost-split/preview", { totalCost, maxSeats });

/**
 * Confirmed rider acknowledges / confirms their equal share.
 */
export const confirmRiderShare = (rideId) =>
  client.post(`/auto-cost-split/ride/${rideId}/confirm`);
