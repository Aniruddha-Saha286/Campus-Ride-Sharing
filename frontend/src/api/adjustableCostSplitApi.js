import { client } from "./api";

/**
 * Fetch adjustable cost split details for a ride (shows if split is EQUAL or CUSTOM).
 */
export const getAdjustableSplit = (rideId) =>
  client.get(`/adjustable-cost-split/ride/${rideId}`);

/**
 * Driver overrides default equal split and sets custom cost shares for riders.
 * @param {string} rideId
 * @param {Array<{ riderId: string, amount: number, note?: string }>} shares
 * @param {string} [reason]
 */
export const setCustomShares = (rideId, shares, reason = "") =>
  client.put(`/adjustable-cost-split/ride/${rideId}/custom-shares`, { shares, reason });

/**
 * Driver overrides a single rider's cost share.
 */
export const setSingleRiderShare = (rideId, riderId, amount, note = "") =>
  client.put(`/adjustable-cost-split/ride/${rideId}/riders/${riderId}`, { amount, note });

/**
 * Driver resets any custom overrides back to the default equal split.
 */
export const resetToEqualSplit = (rideId) =>
  client.post(`/adjustable-cost-split/ride/${rideId}/reset-equal`);
