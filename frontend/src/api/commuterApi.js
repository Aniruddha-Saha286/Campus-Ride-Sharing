import { client } from "./api";

export const getMyCommuterPreference = () => client.get("/matches/commuters");
export const saveCommuterPreference = (payload) => client.post("/matches/commuters", payload);
export const getCommuterSuggestions = () => client.get("/matches/suggestions");
export const getContactInfo = (otherStudentId) =>
  client.get(`/matches/contact-info/${otherStudentId}`);
