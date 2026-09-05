const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5918";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5918;
const BASE = `http://localhost:${PORT}/api`;

const DRIVER_EMAIL = "driver.sync@g.bracu.ac.bd";
const DRIVER_ID = "driverSync1";

const RIDER1_EMAIL = "rider1.sync@g.bracu.ac.bd";
const RIDER1_ID = "riderSync1";

const RIDER2_EMAIL = "rider2.sync@g.bracu.ac.bd";
const RIDER2_ID = "riderSync2";

const RIDER3_EMAIL = "rider3.sync@g.bracu.ac.bd";
const RIDER3_ID = "riderSync3";

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

const rider1Token = jwt.sign({ id: RIDER1_ID, universityEmail: RIDER1_EMAIL }, process.env.JWT_SECRET);
const rider1Auth = { Authorization: `Bearer ${rider1Token}` };

const rider2Token = jwt.sign({ id: RIDER2_ID, universityEmail: RIDER2_EMAIL }, process.env.JWT_SECRET);
const rider2Auth = { Authorization: `Bearer ${rider2Token}` };

const rider3Token = jwt.sign({ id: RIDER3_ID, universityEmail: RIDER3_EMAIL }, process.env.JWT_SECRET);
const rider3Auth = { Authorization: `Bearer ${rider3Token}` };

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
    /* non-JSON */
  }
  return { status: res.status, body: json, headers: res.headers };
};

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("campus-ride-sharing-dynamic-sync-test");
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

  console.log("\n--- Setup Driver and Riders ---");
  const Student = require("../../models/Student");
  const RidePayment = require("../../models/RidePayment");

  const students = await Student.create([
    {
      universityEmail: DRIVER_EMAIL,
      studentId: "18101071",
      name: "Driver Karim",
      department: "CSE",
      year: "4th Year",
      homeArea: "Merul Badda",
      phone: "+8801711111171",
      dateOfBirth: new Date("2000-01-01"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801711111172" },
      parentInfo: { fatherName: "F", fatherPhone: "+8801711111173", motherName: "M", motherPhone: "+8801711111174" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
    {
      universityEmail: RIDER1_EMAIL,
      studentId: "19101072",
      name: "Rider Anika",
      department: "EEE",
      year: "3rd Year",
      homeArea: "Dhanmondi",
      phone: "+8801722222272",
      dateOfBirth: new Date("2001-02-02"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801722222273" },
      parentInfo: { fatherName: "F2", fatherPhone: "+8801722222274", motherName: "M2", motherPhone: "+8801722222275" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
    {
      universityEmail: RIDER2_EMAIL,
      studentId: "20101073",
      name: "Rider Tanvir",
      department: "BBA",
      year: "2nd Year",
      homeArea: "Uttara",
      phone: "+8801733333373",
      dateOfBirth: new Date("2002-03-03"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801733333374" },
      parentInfo: { fatherName: "F3", fatherPhone: "+8801733333375", motherName: "M3", motherPhone: "+8801733333376" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
    {
      universityEmail: RIDER3_EMAIL,
      studentId: "21101074",
      name: "Rider Fariha",
      department: "ARC",
      year: "1st Year",
      homeArea: "Gulshan",
      phone: "+8801744444474",
      dateOfBirth: new Date("2003-04-04"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801744444475" },
      parentInfo: { fatherName: "F4", fatherPhone: "+8801744444476", motherName: "M4", motherPhone: "+8801744444477" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
  ]);

  const [driverDoc, r1Doc, r2Doc, r3Doc] = students;

  // 1. Driver posts ride with total trip fare αº│100 and 4 seats
  let r = await request("POST", "/rides", {
    body: {
      pickup: "BRAC University",
      dropoff: "Dhanmondi 27",
      departureTime: "18:30",
      seats: 4,
      charge: 100, // Total trip cost
    },
  });
  check("driver posts ride with total fare αº│100 -> 201", r.status === 201);
  const rideId = r.body?.data?._id;

  console.log("\n--- Rider 1 Confirmed: Payable share should be αº│100 ---");
  r = await request("POST", `/rides/${rideId}/requests`, { headers: rider1Auth, body: { seats: 1 } });
  check("rider 1 requests seat -> 201", r.status === 201);
  const req1Id = r.body?.data?._id;

  r = await request("PUT", `/rides/${rideId}/requests/${req1Id}`, { body: { decision: "accepted" } });
  check("driver accepts rider 1 -> 200", r.status === 200);

  // Trigger split calculation and payment sync
  r = await request("GET", `/auto-cost-split/ride/${rideId}`);
  check("auto split with 1 rider = αº│100", r.body?.data?.costPerRider === 100);

  // Check Rider 1's payment record in database
  let p1 = await RidePayment.findOne({ ride: rideId, payer: r1Doc._id });
  check("rider 1 payment amount is αº│100", p1 && p1.originalAmount === 100 && p1.remainingAmount === 100);

  console.log("\n--- Rider 2 Confirmed: Both payable shares should become αº│50 ---");
  r = await request("POST", `/rides/${rideId}/requests`, { headers: rider2Auth, body: { seats: 1 } });
  const req2Id = r.body?.data?._id;

  r = await request("PUT", `/rides/${rideId}/requests/${req2Id}`, { body: { decision: "accepted" } });
  check("driver accepts rider 2 -> 200", r.status === 200);

  // Fetch split
  r = await request("GET", `/auto-cost-split/ride/${rideId}`);
  check("auto split with 2 riders = αº│50 each", r.body?.data?.costPerRider === 50);

  p1 = await RidePayment.findOne({ ride: rideId, payer: r1Doc._id });
  let p2 = await RidePayment.findOne({ ride: rideId, payer: r2Doc._id });
  check("rider 1 payment updated dynamically to αº│50", p1 && p1.originalAmount === 50);
  check("rider 2 payment updated dynamically to αº│50", p2 && p2.originalAmount === 50);

  console.log("\n--- Rider 3 Confirmed: All payable shares should become αº│33.33 ---");
  r = await request("POST", `/rides/${rideId}/requests`, { headers: rider3Auth, body: { seats: 1 } });
  const req3Id = r.body?.data?._id;

  r = await request("PUT", `/rides/${rideId}/requests/${req3Id}`, { body: { decision: "accepted" } });
  check("driver accepts rider 3 -> 200", r.status === 200);

  r = await request("GET", `/auto-cost-split/ride/${rideId}`);
  check("auto split with 3 riders = αº│33.33 each", r.body?.data?.costPerRider === 33.33);

  p1 = await RidePayment.findOne({ ride: rideId, payer: r1Doc._id });
  p2 = await RidePayment.findOne({ ride: rideId, payer: r2Doc._id });
  let p3 = await RidePayment.findOne({ ride: rideId, payer: r3Doc._id });
  check("rider 1 payment updated to αº│33.33", p1 && p1.originalAmount === 33.33);
  check("rider 2 payment updated to αº│33.33", p2 && p2.originalAmount === 33.33);
  check("rider 3 payment updated to αº│33.33", p3 && p3.originalAmount === 33.33);

  console.log("\n--- Driver Customizes Cost Shares (Adjustable Split Override) ---");
  // Rider 1 pays 20, Rider 2 pays 30, Rider 3 pays 50
  r = await request("PUT", `/adjustable-cost-split/ride/${rideId}/custom-shares`, {
    body: {
      shares: [
        { riderId: String(r1Doc._id), amount: 20 },
        { riderId: String(r2Doc._id), amount: 30 },
        { riderId: String(r3Doc._id), amount: 50 },
      ],
      reason: "Different travel distances",
    },
  });
  check("driver sets custom shares -> 200", r.status === 200);

  p1 = await RidePayment.findOne({ ride: rideId, payer: r1Doc._id });
  p2 = await RidePayment.findOne({ ride: rideId, payer: r2Doc._id });
  p3 = await RidePayment.findOne({ ride: rideId, payer: r3Doc._id });
  check("rider 1 payment updated to custom share αº│20", p1 && p1.originalAmount === 20);
  check("rider 2 payment updated to custom share αº│30", p2 && p2.originalAmount === 30);
  check("rider 3 payment updated to custom share αº│50", p3 && p3.originalAmount === 50);

  console.log("\n--- Driver Resets to Default Equal Split ---");
  r = await request("POST", `/adjustable-cost-split/ride/${rideId}/reset-equal`);
  check("driver resets split -> 200", r.status === 200);

  p1 = await RidePayment.findOne({ ride: rideId, payer: r1Doc._id });
  p2 = await RidePayment.findOne({ ride: rideId, payer: r2Doc._id });
  p3 = await RidePayment.findOne({ ride: rideId, payer: r3Doc._id });
  check("rider 1 payment reverted to equal share αº│33.33", p1 && p1.originalAmount === 33.33);
  check("rider 2 payment reverted to equal share αº│33.33", p2 && p2.originalAmount === 33.33);
  check("rider 3 payment reverted to equal share αº│33.33", p3 && p3.originalAmount === 33.33);

  console.log("\n=======================================================");
  if (failures === 0) {
    console.log("  ALL DYNAMIC FARE & PAYMENT SYNC TESTS PASSED! (100% SUCCESS)");
    console.log("=======================================================\n");
    process.exit(0);
  } else {
    console.log(`  ${failures} TEST(S) FAILED`);
    console.log("=======================================================\n");
    process.exit(1);
  }
};

main();
