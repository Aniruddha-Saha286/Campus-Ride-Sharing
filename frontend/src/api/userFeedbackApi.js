import { client, adminClient } from "./api";

export const submitUserFeedback = (payload) =>
  client.post("/feedback", payload);

export const getMyFeedbacks = () =>
  client.get("/feedback/my");

export const getAdminFeedbacks = (params = {}) =>
  adminClient.get("/feedback/admin", { params });

export const updateAdminFeedback = (id, payload) =>
  adminClient.put(`/feedback/admin/${id}`, payload);

export const deleteAdminFeedback = (id) =>
  adminClient.delete(`/feedback/admin/${id}`);

