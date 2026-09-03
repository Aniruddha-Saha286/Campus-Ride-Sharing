import { client, adminClient } from "./api";

/**
 * Submit a new safety concern report for a ride
 */
export const submitSafetyReport = (payload) =>
  client.post("/safety-reports", payload);

/**
 * Get safety reports submitted by the logged-in student
 */
export const getMySafetyReports = () =>
  client.get("/safety-reports/my");

/**
 * Get all safety reports for Admin with filter and sort options
 * @param {Object} params { status: 'needs_resolution' | 'resolved' | 'all', sort: 'newest' | 'oldest' }
 */
export const getAdminSafetyReports = (params = {}) =>
  adminClient.get("/safety-reports/admin", { params });

/**
 * Update the status of a safety report (Pending, Reviewed, Resolved)
 */
export const updateAdminSafetyReportStatus = (reportId, status) =>
  adminClient.put(`/safety-reports/admin/${reportId}/status`, { status });
