import { client } from "./api";

export const listVehicleRides = (params = {}) =>
  client.get("/vehicles/rides", { params });

export const createVehicleRide = (data) =>
  client.post("/vehicles/rides", data);
