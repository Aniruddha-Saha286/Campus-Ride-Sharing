import { client } from "./api";

export const getDriverHistory = () => client.get("/ride-history/driver");
export const getPassengerHistory = () => client.get("/ride-history/passenger");
