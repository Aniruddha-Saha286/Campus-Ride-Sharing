import { client } from "./api";

export const listOccurrenceSkips = (id) => client.get(`/recurring/${id}/skips`);
export const skipOccurrence = (id, date) => client.post(`/recurring/${id}/skips`, { date });
export const restoreOccurrence = (id, date) => client.delete(`/recurring/${id}/skips/${date}`);
