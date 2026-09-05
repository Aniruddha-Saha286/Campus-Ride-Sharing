const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "test-secret-20";
process.env.PORT = "5920";
process.env.CLIENT_URL = "*";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5920;
const BASE = `http://localhost:${PORT}/api`;

const DRIVER_EMAIL = "driver20@g.bracu.ac.bd";
const DRIVER_ID = "driver20";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${extra ? ` -> ${extra}` : ""}`);
  }
};

const makeToken = (id, universityEmail) =>
  jwt.sign({ id, universityEmail }, process.env.JWT_SECRET);


const request = async (method, p, { token, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${p}`, opts);
  let json = null;
  try {
    json = await res.json();
  } catch (e) {}
  return { status: res.status, body: json, headers: res.headers };
};

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("campus-ride-sharing-vehicle-reg");
  require("../../server.js");

  let up = false;
  for (let i = 0; i < 40; i += 1) {
    try {
      await fetch(`http://localhost:${PORT}/`);
      up = true;
      break;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  check("server boots and answers on /", up);

  const Student = require("../../models/Student");
  const Ride = require("../../models/Ride");
  const VehicleRide = require("../../models/VehicleRide");
  const {
    formatRegistrationPlate,
    parseRegistrationPlate,
    validateRegistrationPlate,
    isValidRegistrationForModel,
    generateCanonicalDummyRegistration,
  } = require("../../utils/vehicleRegistration");

  const driverStudent = await Student.create({
    universityEmail: DRIVER_EMAIL,
    studentId: "20102001",
    name: "Driver BD Reg",
    department: "CSE",
    year: "4th Year",
    homeArea: "Mirpur",
    phone: "+8801711112001",
    dateOfBirth: new Date("2000-01-01"),
    emergencyContact: { name: "P", relation: "Parent", phone: "+8801711112002" },
    parentInfo: { fatherName: "F", fatherPhone: "+8801711112003", motherName: "M", motherPhone: "+8801711112004" },
    idVerificationStatus: "approved",
    profileCompleted: true,
  });

  const driverToken = makeToken(driverStudent._id, DRIVER_EMAIL);

  console.log("\n--- Scenario 1: Unit Validation of Canonical Formats ---");

  const plate1 = formatRegistrationPlate({
    area: "Dhaka",
    isMetro: true,
    category: "Ga",
    digits: "123456",
  });
  check("format Dhaka Metro-Ga 12-3456", plate1 === "Dhaka Metro-Ga 12-3456");

  const plate2 = formatRegistrationPlate({
    area: "Dhaka",
    isMetro: true,
    category: "Kha",
    digits: "157821",
  });
  check("format Dhaka Metro-Kha 15-7821", plate2 === "Dhaka Metro-Kha 15-7821");

  const plate3 = formatRegistrationPlate({
    area: "Gazipur",
    isMetro: false,
    category: "Ga",
    digits: "112456",
  });
  check("format Gazipur-Ga 11-2456", plate3 === "Gazipur-Ga 11-2456");

  const plate4 = formatRegistrationPlate({
    area: "Narayanganj",
    isMetro: false,
    category: "Ka",
    digits: "139087",
  });
  check("format Narayanganj-Ka 13-9087", plate4 === "Narayanganj-Ka 13-9087");

  const parseRes = parseRegistrationPlate("Dhaka Metro-Ga 12-3456");
  check("parse valid canonical plate", parseRes && parseRes.area === "Dhaka" && parseRes.isMetro === true && parseRes.category === "Ga" && parseRes.digits === "123456");

  const nonMetroParse = parseRegistrationPlate("Gazipur-Ga 11-2456");
  check("parse valid non-metro plate", nonMetroParse && nonMetroParse.area === "Gazipur" && nonMetroParse.isMetro === false && nonMetroParse.category === "Ga" && nonMetroParse.digits === "112456");

  console.log("\n--- Scenario 2: API Validation & Rejection of Bad Plates ---");

  let r = await request("POST", "/vehicles/rides", {
    token: driverToken,
    body: {
      pickup: "Banani",
      dropoff: "BRAC University",
      departureTime: "08:30",
      seats: 3,
      charge: 50,
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      registrationNumber: "123456",
    },
  });
  check("bare 6 digits 123456 rejected -> 400", r.status === 400);

  r = await request("POST", "/vehicles/rides", {
    token: driverToken,
    body: {
      pickup: "Banani",
      dropoff: "BRAC University",
      departureTime: "08:30",
      seats: 3,
      charge: 50,
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      registrationNumber: "34-5034",
    },
  });
  check("bare dash 34-5034 rejected -> 400", r.status === 400);

  r = await request("POST", "/vehicles/rides", {
    token: driverToken,
    body: {
      pickup: "Banani",
      dropoff: "BRAC University",
      departureTime: "08:30",
      seats: 3,
      charge: 50,
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      registrationNumber: "RANDOM-ABC-123456",
    },
  });
  check("arbitrary text RANDOM-ABC-123456 rejected -> 400", r.status === 400);

  r = await request("POST", "/vehicles/rides", {
    token: driverToken,
    body: {
      pickup: "Banani",
      dropoff: "BRAC University",
      departureTime: "08:30",
      seats: 3,
      charge: 50,
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      registrationNumber: "Dhaka Metro-XYZ 12-3456",
    },
  });
  check("invalid category XYZ rejected -> 400", r.status === 400);

  r = await request("POST", "/vehicles/rides", {
    token: driverToken,
    body: {
      pickup: "Banani",
      dropoff: "BRAC University",
      departureTime: "08:30",
      seats: 3,
      charge: 50,
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      registrationNumber: "UnknownArea-Ga 12-3456",
    },
  });
  check("unknown registration area rejected -> 400", r.status === 400);

  r = await request("POST", "/vehicles/rides", {
    token: driverToken,
    body: {
      pickup: "Banani",
      dropoff: "BRAC University",
      departureTime: "08:30",
      seats: 3,
      charge: 50,
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      registrationNumber: "Dhaka Metro-Ga 12-345",
    },
  });
  check("incomplete 5 digits rejected -> 400", r.status === 400);

  console.log("\n--- Scenario 3: Valid Canonical Plate Creation ---");

  r = await request("POST", "/vehicles/rides", {
    token: driverToken,
    body: {
      pickup: "Banani",
      dropoff: "BRAC University",
      departureTime: "08:30",
      seats: 3,
      charge: 50,
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      registrationNumber: "dhaka metro-ga 12-3456",
    },
  });
  check("valid ride with canonical plate created -> 201", r.status === 201, JSON.stringify(r.body));
  check("plate normalized to canonical casing", r.body?.data?.vehicle?.registrationNumber === "Dhaka Metro-Ga 12-3456");
  const rideId = r.body?.data?._id;

  console.log("\n--- Scenario 4: Edit Ride Registration Validation ---");

  let editRes = await request("PUT", `/rides/${rideId}`, {
    token: driverToken,
    body: {
      registrationNumber: "123456",
    },
  });
  check("edit ride with bare 6 digits rejected -> 400", editRes.status === 400);

  editRes = await request("PUT", `/rides/${rideId}`, {
    token: driverToken,
    body: {
      registrationNumber: "Gazipur-Ga 11-2456",
    },
  });
  check("edit ride with canonical non-metro plate accepted -> 200", editRes.status === 200);

  const updatedVR = await VehicleRide.findOne({ ride: rideId });
  check("updated registration persisted in database", updatedVR?.registrationNumber === "Gazipur-Ga 11-2456");

  await request("DELETE", `/rides/${rideId}`, { token: driverToken });

  console.log("\n--- Scenario 5: Non-service Area Vehicle Registration ---");

  r = await request("POST", "/vehicles/rides", {
    token: driverToken,
    body: {
      pickup: "Uttara Sector 7",
      dropoff: "BRAC University",
      departureTime: "09:00",
      seats: 2,
      charge: 60,
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      registrationNumber: "Chattogram Metro-Ga 14-5566",
    },
  });
  check("vehicle registered in Chattogram accepted for ride within service area -> 201", r.status === 201);
  check("registration number saved correctly", r.body?.data?.vehicle?.registrationNumber === "Chattogram Metro-Ga 14-5566");
  const ride2Id = r.body?.data?._id;

  await request("DELETE", `/rides/${ride2Id}`, { token: driverToken });

  console.log("\n--- Scenario 6: Backward Compatibility for Legacy Database Records ---");

  check("legacy 34-5034 passes model validation", isValidRegistrationForModel("34-5034"));
  check("legacy 123456 passes model validation", isValidRegistrationForModel("123456"));
  check("canonical plate passes model validation", isValidRegistrationForModel("Dhaka Metro-Ga 12-3456"));
  check("arbitrary text fails model validation", !isValidRegistrationForModel("RANDOM-TEXT"));

  const legacyRide = await Ride.create({
    poster: driverStudent._id,
    pickup: "Banani",
    dropoff: "Mohakhali",
    departureTime: "12:00",
    seats: 2,
    charge: 0,
    status: "completed",
  });

  const legacyVR = await VehicleRide.create({
    ride: legacyRide._id,
    poster: legacyRide.poster,
    vehicleCategory: "Four-wheeler",
    vehicleType: "Car",
    registrationNumber: "34-5034",
    maxSeats: 4,
    allocatedSeats: 2,
  });
  check("legacy VehicleRide created without error", Boolean(legacyVR?._id));

  legacyVR.allocatedSeats = 3;
  await legacyVR.save();
  check("legacy VehicleRide saved without model validation error", legacyVR.allocatedSeats === 3);

  const foundVR = await VehicleRide.findById(legacyVR._id);
  check("legacy registration value untouched", foundVR?.registrationNumber === "34-5034");

  console.log("\n--- Scenario 7: Auto-generated Dummy Registration ---");

  const dummyPlate = generateCanonicalDummyRegistration();
  check("dummy plate matches canonical format", validateRegistrationPlate(dummyPlate).valid);

  const dummyRes = await request("GET", "/vehicles/dummy-registration", {
    token: driverToken,
  });
  check("GET /vehicles/dummy-registration returns 200", dummyRes.status === 200);
  check("returned dummy registration is valid canonical plate", validateRegistrationPlate(dummyRes.body?.data?.registrationNumber).valid);

  await mongo.stop();

  if (failures > 0) {
    console.error(`\n${failures} TEST(S) FAILED`);
    process.exit(1);
  } else {
    console.log("\nALL TESTS PASSED\n");
    process.exit(0);
  }
};

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
