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

const RIDER1_EMAIL = "rider1.student@g.bracu.ac.bd";
const RIDER1_ID = "rider123";

const RIDER2_EMAIL = "rider2.student@g.bracu.ac.bd";
const RIDER2_ID = "rider456";

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
  process.env.MONGO_URI = mongo.getUri("campus-ride-sharing-split-test");
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

  console.log("\n--- Preview Cost Split ---");
  let r = await request("POST", "/auto-cost-split/preview", { body: { totalCost: 300, maxSeats: 4 } });
  check("preview cost split -> 200", r.status === 200);
  check("preview splitMode = EQUAL", r.body?.data?.splitMode === "EQUAL");
  check("preview 1 rider: 300", r.body?.data?.tiers?.[0]?.costPerRider === 300);
  check("preview 2 riders: 150 (50% saved)", r.body?.data?.tiers?.[1]?.costPerRider === 150 && r.body?.data?.tiers?.[1]?.savingsPercent === 50);
  check("preview 3 riders: 100 (67% saved)", r.body?.data?.tiers?.[2]?.costPerRider === 100);
  check("preview 4 riders: 75 (75% saved)", r.body?.data?.tiers?.[3]?.costPerRider === 75);

  console.log("\n--- Setup Users & Rides ---");
  const Student = require("../../models/Student");
  await Student.create([
    {
      universityEmail: DRIVER_EMAIL,
      studentId: "18101001",
      name: "Driver Karim",
      department: "CSE",
      year: "4th Year",
      homeArea: "Merul Badda",
      phone: "+8801711111111",
      dateOfBirth: new Date("2000-01-01"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801711111112" },
      parentInfo: { fatherName: "F", fatherPhone: "+8801711111113", motherName: "M", motherPhone: "+8801711111114" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
    {
      universityEmail: RIDER1_EMAIL,
      studentId: "19101002",
      name: "Rider Farhan",
      department: "EEE",
      year: "3rd Year",
      homeArea: "Dhanmondi",
      phone: "+8801722222222",
      dateOfBirth: new Date("2001-02-02"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801722222223" },
      parentInfo: { fatherName: "F2", fatherPhone: "+8801722222224", motherName: "M2", motherPhone: "+8801722222225" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
    {
      universityEmail: RIDER2_EMAIL,
      studentId: "20101003",
      name: "Rider Sadia",
      department: "BBA",
      year: "2nd Year",
      homeArea: "Uttara",
      phone: "+8801733333333",
      dateOfBirth: new Date("2002-03-03"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801733333334" },
      parentInfo: { fatherName: "F3", fatherPhone: "+8801733333335", motherName: "M3", motherPhone: "+8801733333336" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
  ]);

  // Driver posts a ride with total cost αº│300
  r = await request("POST", "/rides", {
    body: {
      pickup: "BRAC University, Merul Badda",
      dropoff: "Dhanmondi 27",
      departureTime: "17:30",
      seats: 3,
      charge: 300,
    },
  });
  check("create ride -> 201", r.status === 201);
  const rideId = r.body?.data?._id;

  console.log("\n--- Initial Cost Split (0 confirmed riders) ---");
  r = await request("GET", `/auto-cost-split/ride/${rideId}`);
  check("get ride split -> 200", r.status === 200);
  check("total trip cost = 300", r.body?.data?.totalTripCost === 300);
  check("splitMode = EQUAL (default)", r.body?.data?.splitMode === "EQUAL");
  check("0 confirmed riders initially", r.body?.data?.confirmedRidersCount === 0);
  check("isDriver = true for poster", r.body?.data?.isDriver === true);

  console.log("\n--- First Rider Confirmed (1 rider) ---");
  // Rider 1 requests seat
  r = await request("POST", `/rides/${rideId}/requests`, { headers: rider1Auth, body: { seats: 1 } });
  check("rider 1 requests seat -> 201", r.status === 201);
  const req1Id = r.body?.data?._id;

  // Driver accepts rider 1
  r = await request("PUT", `/rides/${rideId}/requests/${req1Id}`, { body: { decision: "accepted" } });
  check("driver accepts rider 1 -> 200", r.status === 200);

  // Check auto cost split with 1 confirmed rider
  r = await request("GET", `/auto-cost-split/ride/${rideId}`, { headers: rider1Auth });
  check("auto cost split after 1 rider accepted", r.status === 200);
  check("confirmed riders count = 1", r.body?.data?.confirmedRidersCount === 1);
  check("cost per rider = 300 with 1 confirmed rider", r.body?.data?.costPerRider === 300);
  check("rider 1 sees own share = 300", r.body?.data?.myShare === 300);
  check("rider 1 isConfirmedRider = true", r.body?.data?.isConfirmedRider === true);

  console.log("\n--- Second Rider Confirmed (2 riders: Auto-divided equally!) ---");
  // Rider 2 requests seat
  r = await request("POST", `/rides/${rideId}/requests`, { headers: rider2Auth, body: { seats: 1 } });
  const req2Id = r.body?.data?._id;

  // Driver accepts rider 2
  r = await request("PUT", `/rides/${rideId}/requests/${req2Id}`, { body: { decision: "accepted" } });
  check("driver accepts rider 2 -> 200", r.status === 200);

  // Check auto cost split: 300 divided equally between 2 confirmed riders = 150 each!
  r = await request("GET", `/auto-cost-split/ride/${rideId}`);
  check("confirmed riders count = 2", r.body?.data?.confirmedRidersCount === 2);
  check("total trip cost 300 automatically divided equally: 150 each", r.body?.data?.costPerRider === 150);
  check("each rider saves 150 (50% savings)", r.body?.data?.savingsPerRider === 150 && r.body?.data?.savingsPercent === 50);

  // Verify rider list entries
  const riderShares = r.body?.data?.confirmedRiders || [];
  check("both riders have equal splitShare of 150", riderShares.length === 2 && riderShares.every((x) => x.splitShare === 150));

  console.log("\n--- Driver Updates Total Trip Cost ---");
  // Driver updates total trip cost to αº│400 (e.g. higher toll/fuel)
  r = await request("PUT", `/auto-cost-split/ride/${rideId}/total-cost`, { body: { totalTripCost: 400 } });
  check("driver updates total cost -> 200", r.status === 200);
  check("cost per rider re-divided equally: 200 each (400 / 2)", r.body?.data?.costPerRider === 200);

  // Non-driver attempt to update total cost is blocked
  r = await request("PUT", `/auto-cost-split/ride/${rideId}/total-cost`, { headers: rider1Auth, body: { totalTripCost: 100 } });
  check("non-driver cannot update total trip cost -> 403", r.status === 403);

  console.log("\n--- Rider Confirms Share ---");
  r = await request("POST", `/auto-cost-split/ride/${rideId}/confirm`, { headers: rider1Auth });
  check("rider 1 confirms equal share -> 200", r.status === 200);
  check("rider status = CONFIRMED", r.body?.data?.status === "CONFIRMED");

  console.log("\n--- Get My Cost Splits ---");
  r = await request("GET", "/auto-cost-split/mine", { headers: rider1Auth });
  check("rider 1 gets cost split list -> 200", r.status === 200);
  check("ride appears in rider 1 list", (r.body?.data || []).length > 0 && r.body?.data?.[0]?.costPerRider === 200);

  console.log("\n=========================================");
  if (failures === 0) {
    console.log("  ALL AUTO COST SPLIT TESTS PASSED! (100% SUCCESS)");
    console.log("=========================================\n");
    process.exit(0);
  } else {
    console.log(`  ${failures} TEST(S) FAILED`);
    console.log("=========================================\n");
    process.exit(1);
  }
};

main();
