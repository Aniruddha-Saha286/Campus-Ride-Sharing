import { client } from "./api";

export const searchPaymentStudents = (search) =>
  client.get("/payments/students", { params: { search } });

export const createPaymentRequest = (payload) =>
  client.post("/payments", payload);

export const getMyPaymentRequests = (role) =>
  client.get("/payments", { params: role ? { role } : {} });

export const getPaymentRequest = (id) => client.get(`/payments/${id}`);

export const recordBkashPayment = (id, amount) =>
  client.post(`/payments/${id}/payments`, { method: "BKASH", amount });

export const recordManualPayment = (id, amount, reference) =>
  client.post(`/payments/${id}/payments`, { method: "MANUAL", amount, reference });

export const verifyManualPayment = (id, paymentId, decision) =>
  client.put(`/payments/${id}/payments/${paymentId}`, { decision });
