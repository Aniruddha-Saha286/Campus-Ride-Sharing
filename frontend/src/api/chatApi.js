import { client } from "./api";

export const getRideMessages = (rideId, otherUserId) => {
  const params = otherUserId ? { otherUserId } : {};
  return client.get(`/chat/${rideId}`, { params });
};

export const sendRideMessage = (rideId, text, recipientId) => {
  const payload = { text };
  if (recipientId) payload.recipientId = recipientId;
  return client.post(`/chat/${rideId}`, payload);
};

export const editRideMessage = (rideId, messageId, text) => {
  return client.put(`/chat/${rideId}/messages/${messageId}`, { text });
};

export const deleteRideMessage = (rideId, messageId) => {
  return client.delete(`/chat/${rideId}/messages/${messageId}`);
};
