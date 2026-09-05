const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5915";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5915;
const BASE = `http://localhost:${PORT}/api`;
const DRIVER_EMAIL = "driver.student@g.bracu.ac.bd";
const DRIVER_ID = "driver123";

const PASSENGER_EMAIL = "passenger.student@g.bracu.ac.bd";
const PASSENGER_ID = "passenger456";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${extra ? ` -> ${extra}` : ""}`);
  }
};

const driverToken = jwt.sign({ id: DRIVER_ID, universityEmail: DRIVER_EMAIL }, process.env.JWT_SECRET);
const driverAuth = { Authorization: `Bearer ${driverToken}` };

const passengerToken = jwt.sign({ id: PASSENGER_ID, universityEmail: PASSENGER_EMAIL }, process.env.JWT_SECRET);
const passengerAuth = { Authorization: `Bearer ${passengerToken}` };

const request = async (method, p, { headers = {}, body } = {}) => {
  const opts = { method, headers: { ...driverAuth, ...headers } };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    if (!opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${p}`, opts);
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
  }
  return { status: res.status, body: json, headers: res.headers };
};

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("campus-ride-sharing-vehicle-test");
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

  const driver = await Student.create({
    universityEmail: DRIVER_EMAIL,
    studentId: "20101234",
    name: "Rahim Driver",
    department: "CSE",
    year: "3rd Year",
    homeArea: "Mirpur 10, Dhaka",
    phone: "+8801711000001",
    dateOfBirth: "2002-05-14",
    emergencyContact: { name: "Abba", relation: "Father", phone: "01711111111" },
    parentInfo: {
      fatherName: "Abdur Rahim",
      fatherPhone: "01711111111",
      motherName: "Fatema Begum",
      motherPhone: "01722222222",
    },
    idVerificationStatus: "approved",
    studentIdCard: "https://example.com/id.png",
  });

  const passenger = await Student.create({
    universityEmail: PASSENGER_EMAIL,
    studentId: "20105678",
    name: "Karim Passenger",
    department: "BBA",
    year: "2nd Year",
    homeArea: "Dhanmondi, Dhaka",
    phone: "+8801711000002",
    dateOfBirth: "2003-08-20",
    emergencyContact: { name: "Bhai", relation: "Brother", phone: "01733333333" },
    parentInfo: {
      fatherName: "Kazi Nazrul",
      fatherPhone: "01733333333",
      motherName: "Rizia Parveen",
      motherPhone: "01744444444",
    },
    idVerificationStatus: "approved",
    studentIdCard: "https://example.com/id2.png",
  });

  console.log("\n--- Vehicle Type Selection & Specs API ---");
  let r = await request("GET", "/vehicles/specs");
  check("fetch vehicle specs -> 200", r.status === 200);
  check("specs include Two-wheeler and Four-wheeler", r.body?.data?.categories?.includes("Two-wheeler") && r.body?.data?.categories?.includes("Four-wheeler"));
  check("specs include Motorbike, Car, Jeep, Microbus", r.body?.data?.types?.includes("Motorbike") && r.body?.data?.types?.includes("Car") && r.body?.data?.types?.includes("Jeep") && r.body?.data?.types?.includes("Microbus"));

  r = await request("GET", "/vehicles/dummy-registration");
  check("generate dummy registration -> 200", r.status === 200);
  check("dummy reg format XX-XXXX (e.g. 34-5034)", /^\d{2}-\d{4}$/.test(r.body?.data?.registrationNumber));

  console.log("\n--- Driver: Two-wheeler Motorbike Validation ---");
  r = await request("POST", "/vehicles/rides", {
    body: {
      pickup: "Mirpur 10",
      dropoff: "BRAC University",
      departureTime: "08:30",
      vehicleCategory: "Two-wheeler",
      vehicleType: "Motorbike",
      registrationNumber: "34-5034",
      seats: 2,
      charge: 50,
    },
  });
  check("motorbike with 2 seats rejected -> 400", r.status === 400);
  check("error specifies motorbike can only allocate 1 seat", String(r.body?.message).includes("1 passenger seat"));

  r = await request("POST", "/vehicles/rides", {
    body: {
      pickup: "Mirpur 10",
      dropoff: "BRAC University",
      departureTime: "08:30",
      vehicleCategory: "Two-wheeler",
      vehicleType: "Motorbike",
      registrationNumber: "123456",
      seats: 1,
      charge: 50,
    },
  });
  check("motorbike with invalid reg format (123456) rejected -> 400", r.status === 400);

  r = await request("POST", "/vehicles/rides", {
    body: {
      pickup: "Mirpur 10",
      dropoff: "BRAC University",
      departureTime: "08:30",
      vehicleCategory: "Two-wheeler",
      vehicleType: "Motorbike",
      registrationNumber: "34-5034",
      seats: 1,
      charge: 50,
      notes: "Helmet provided",
    },
  });
  check("valid motorbike ride posted -> 201", r.status === 201, JSON.stringify(r.body));
  check("motorbike category recorded", r.body?.data?.vehicle?.category === "Two-wheeler");
  check("motorbike vehicleType recorded", r.body?.data?.vehicle?.vehicleType === "Motorbike");
  check("motorbike registration number 34-5034 recorded", r.body?.data?.vehicle?.registrationNumber === "34-5034");
  check("motorbike seat allocated = 1", r.body?.data?.seats === 1);

  console.log("\n--- Driver: Four-wheeler Car, Jeep, Microbus Validation ---");
  r = await request("POST", "/vehicles/rides", {
    body: {
      pickup: "Uttara Sector 7",
      dropoff: "BRAC University",
      departureTime: "09:00",
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      registrationNumber: "55-1234",
      seats: 5,
      charge: 100,
    },
  });
  check("car with 5 seats rejected -> 400", r.status === 400);

  r = await request("POST", "/vehicles/rides", {
    body: {
      pickup: "Uttara Sector 7",
      dropoff: "BRAC University",
      departureTime: "09:00",
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      registrationNumber: "55-1234",
      seats: 3,
      charge: 100,
      notes: "AC on",
    },
  });
  check("valid car ride posted -> 201", r.status === 201);
  check("car vehicleType recorded", r.body?.data?.vehicle?.vehicleType === "Car");

  r = await request("POST", "/vehicles/rides", {
    body: {
      pickup: "Dhanmondi 27",
      dropoff: "BRAC University",
      departureTime: "09:30",
      vehicleCategory: "Four-wheeler",
      vehicleType: "Jeep",
      registrationNumber: "78-9012",
      seats: 6,
      charge: 120,
    },
  });
  check("valid jeep ride posted -> 201", r.status === 201);
  check("jeep vehicleType recorded", r.body?.data?.vehicle?.vehicleType === "Jeep");

  r = await request("POST", "/vehicles/rides", {
    body: {
      pickup: "Gulshan 1",
      dropoff: "BRAC University",
      departureTime: "10:00",
      vehicleCategory: "Four-wheeler",
      vehicleType: "Microbus",
      registrationNumber: "99-4455",
      seats: 8,
      charge: 80,
    },
  });
  check("valid microbus ride posted -> 201", r.status === 201);
  check("microbus vehicleType recorded", r.body?.data?.vehicle?.vehicleType === "Microbus");

  r = await request("POST", "/vehicles/rides", {
    body: {
      pickup: "Mohakhali",
      dropoff: "BRAC University",
      departureTime: "11:00",
      vehicleCategory: "Four-wheeler",
      vehicleType: "Car",
      seats: 2,
      charge: 60,
    },
  });
  check("dummy registration auto-generated when omitted -> 201", r.status === 201);
  check("auto dummy reg format XX-XXXX", /^\d{2}-\d{4}$/.test(r.body?.data?.vehicle?.registrationNumber));

  console.log("\n--- Passenger: View & Filter Ride Offers by Vehicle Type ---");
  r = await request("GET", "/vehicles/rides", { headers: passengerAuth });
  check("passenger fetches vehicle rides -> 200", r.status === 200);
  check("passenger receives ride offers list", Array.isArray(r.body?.data) && r.body?.data?.length >= 4);
  check("counts computed accurately", r.body?.counts?.twoWheeler >= 1 && r.body?.counts?.fourWheeler >= 3);

  r = await request("GET", "/vehicles/rides?category=Two-wheeler", { headers: passengerAuth });
  check("filter by Two-wheeler returns only two-wheelers", r.body?.data?.every((ride) => ride.vehicle?.category === "Two-wheeler"));
  check("two-wheeler result contains Motorbike", r.body?.data?.some((ride) => ride.vehicle?.vehicleType === "Motorbike"));

  r = await request("GET", "/vehicles/rides?category=Four-wheeler", { headers: passengerAuth });
  check("filter by Four-wheeler returns only four-wheelers", r.body?.data?.every((ride) => ride.vehicle?.category === "Four-wheeler"));

  r = await request("GET", "/vehicles/rides?vehicleType=Motorbike", { headers: passengerAuth });
  check("filter by vehicleType=Motorbike returns only Motorbikes", r.body?.data?.every((ride) => ride.vehicle?.vehicleType === "Motorbike"));

  r = await request("GET", "/vehicles/rides?vehicleType=Microbus", { headers: passengerAuth });
  check("filter by vehicleType=Microbus returns only Microbuses", r.body?.data?.every((ride) => ride.vehicle?.vehicleType === "Microbus"));

  console.log(`\n=========================================`);
  console.log(`  ${failures === 0 ? "ALL VEHICLE SELECTION TESTS PASSED!" : `${failures} TEST(S) FAILED`}`);
  console.log(`=========================================`);

  await mongo.stop();
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error("Test failed to run:", err);
  process.exit(1);
});
