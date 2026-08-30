const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "test-secret";
process.env.PORT = "5907";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5907;
const BASE = `http://localhost:${PORT}/api`;
const USER_EMAIL = "test.driver@g.bracu.ac.bd";
const USER_ID = "driver123";

const RIDER_EMAIL = "test.rider@g.bracu.ac.bd";
const RIDER_ID = "rider123";

const VALID_PROFILE = {
  studentId: "20101234",
  name: "Anisha Rahman",
  department: "CSE",
  year: "3rd Year",
  homeArea: "Mirpur 10, Dhaka",
  phone: "+8801711000000",
  dateOfBirth: "2003-05-14",
  studentNid: "20030514123456789",
  passport: "AB1234567",
  emergencyContact: { name: "Rafiul Hasan", relation: "Parent", phone: "01799000000" },
  parentInfo: {
    fatherName: "Abdul Rahman",
    fatherPhone: "01711111111",
    motherName: "Salma Rahman",
    motherPhone: "01722222222",
  },
  localGuardian: {
    name: "Kamal Hossain",
    relation: "Uncle",
    dateOfBirth: "1995-04-12",
    phone: "01733333333",
    address: "House 12, Road 7, Uttara, Dhaka",
    nid: "19950412123456789",
  },
};

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${extra ? ` -> ${extra}` : ""}`);
  }
};

const token = jwt.sign({ id: USER_ID, universityEmail: USER_EMAIL }, process.env.JWT_SECRET);
const auth = { Authorization: `Bearer ${token}` };

const riderToken = jwt.sign({ id: RIDER_ID, universityEmail: RIDER_EMAIL }, process.env.JWT_SECRET);
const riderAuth = { Authorization: `Bearer ${riderToken}` };

const request = async (method, p, { headers = {}, body } = {}) => {
  const opts = { method, headers: { ...auth, ...headers } };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
    if (opts.headers["Content-Type"] === undefined)
      opts.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${p}`, opts);
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    /* non-JSON */
  }
  return { status: res.status, body: json, headers: res.headers };
};

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();

  const express = require("express");
  const cors = require("cors");
  const connectDB = require("../../config/db");
  const studentRoutes = require("../../routes/studentRoutes");
  const authRoutes = require("../../routes/authRoutes");
  const rideRoutes = require("../../routes/rideRoutes");
  const rideStatusRoutes = require("../../routes/rideStatusRoutes");
  const rideHistoryRoutes = require("../../routes/rideHistoryRoutes");
  const Student = require("../../models/Student");

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/students", studentRoutes);
  app.use("/api/rides", rideRoutes);
  app.use("/api/ride-statuses", rideStatusRoutes);
  app.use("/api/ride-history", rideHistoryRoutes);

  await connectDB();
  await new Promise((resolve) => app.listen(PORT, resolve));

  console.log("\n--- Ride History & Status Tracker Tests ---");

  // Setup driver & passenger profiles
  const driver = await Student.create({
    ...VALID_PROFILE,
    universityEmail: USER_EMAIL,
    idVerificationStatus: "approved",
  });

  const passenger = await Student.create({
    ...VALID_PROFILE,
    studentId: "20109999",
    name: "Tanvir Ahmed",
    universityEmail: RIDER_EMAIL,
    idVerificationStatus: "approved",
  });

  // Auth protection tests
  let r = await fetch(`${BASE}/ride-history/driver`);
  check("no token on driver history -> 401", r.status === 401);
  r = await fetch(`${BASE}/ride-history/passenger`);
  check("no token on passenger history -> 401", r.status === 401);

  // Create and book ride
  r = await request("POST", "/rides", {
    body: {
      pickup: "BRAC University",
      dropoff: "Dhanmondi 27",
      departureTime: "16:30",
      seats: 2,
      charge: 120,
    },
  });
  const rideId = r.body?.data?._id;
  check("create ride for history -> 201", r.status === 201, JSON.stringify(r.body));

  r = await request("POST", `/rides/${rideId}/requests`, { headers: riderAuth });
  const reqId = r.body?.data?._id;
  check("rider requests seat -> 201", r.status === 201);

  r = await request("PUT", `/rides/${rideId}/requests/${reqId}`, { body: { decision: "accepted" } });
  check("poster accepts rider -> 200", r.status === 200);

  // Check Ride Status Tracker endpoint
  r = await request("GET", "/ride-statuses/mine");
  check("get active ride statuses -> 200", r.status === 200, JSON.stringify(r.body));
  const myStatus = (r.body?.data || []).find((s) => String(s.ride?._id) === String(rideId));
  check("status record exists with upcoming", Boolean(myStatus) && myStatus.tripStatus === "upcoming");

  // Advance ride status: upcoming -> ongoing
  r = await request("PUT", `/ride-statuses/${rideId}`, { body: { tripStatus: "ongoing" } });
  check("advance status to ongoing -> 200", r.status === 200, JSON.stringify(r.body));
  check("tripStatus updated to ongoing", r.body?.data?.tripStatus === "ongoing");

  // Advance ride status: ongoing -> completed
  r = await request("PUT", `/ride-statuses/${rideId}`, { body: { tripStatus: "completed" } });
  check("advance status to completed -> 200", r.status === 200, JSON.stringify(r.body));
  check("tripStatus updated to completed", r.body?.data?.tripStatus === "completed");

  // Driver History
  r = await request("GET", "/ride-history/driver");
  check("driver history -> 200", r.status === 200, JSON.stringify(r.body));
  const historyRide = (r.body?.data || []).find((x) => String(x._id) === String(rideId));
  check("posted ride appears in driver history", Boolean(historyRide));
  check("driver history counts accepted passengers", historyRide?.acceptedBookings === 1);
  check("driver history includes verified driver info", historyRide?.driver?.name === "Anisha Rahman" && historyRide?.driver?.idVerified === true);

  // Passenger History
  r = await request("GET", "/ride-history/passenger", { headers: riderAuth });
  check("passenger history -> 200", r.status === 200, JSON.stringify(r.body));
  const historyBooking = (r.body?.data || []).find((b) => String(b.rideId) === String(rideId));
  check("accepted seat appears in passenger history", historyBooking?.status === "accepted");
  check("passenger history shows driver and passenger", historyBooking?.driver?.name === "Anisha Rahman" && String(historyBooking?.passenger?._id) === String(passenger._id));

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
  await mongo.stop();
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
