import { client as api } from "./api";

/**
 * Submit a 1-5 star rating and optional review for a driver.
 */
export const submitRating = (rideId, rating, comment = "") =>
  api.post("/ratings", { rideId, rating, comment });

/**
 * Check if the current passenger has any completed rides they haven't rated yet.
 */
export const getPendingRating = () => api.get("/ratings/pending");

/**
 * Get average rating and review count for a driver.
 */
export const getDriverRating = (driverId) => api.get(`/ratings/driver/${driverId}`);
