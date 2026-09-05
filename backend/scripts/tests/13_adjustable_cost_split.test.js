const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5916";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5916;
const BASE = `http://localhost:${PORT}/api`;
const DRIVER_EMAIL = "driver.adj@g.bracu.ac.bd";
const DRIVER_ID = "driverAdj123";

const RIDER1_EMAIL = "rider1.adj@g.bracu.ac.bd";
const RIDER1_ID = "riderAdj123";

const RIDER2_EMAIL = "rider2.adj@g.bracu.ac.bd";
const RIDER2_ID = "riderAdj456";

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
  process.env.MONGO_URI = mongo.getUri("campus-ride-sharing-adj-split-test");
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

  console.log("\n--- Setup Users & Initial Ride ---");
  const Student = require("../../models/Student");
  const createdStudents = await Student.create([
    {
      universityEmail: DRIVER_EMAIL,
      studentId: "18101011",
      name: "Driver Rahim",
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
      studentId: "19101012",
      name: "Rider Anika",
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
      studentId: "20101013",
      name: "Rider Tanvir",
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

  const rider1Doc = createdStudents[1];
  const rider2Doc = createdStudents[2];

  // Driver posts a ride with total cost αº│300
  let r = await request("POST", "/rides", {
    body: {
      pickup: "BRAC University, Merul Badda",
      dropoff: "Gulshan 1",
      departureTime: "18:00",
      seats: 3,
      charge: 300,
    },
  });
  check("create ride -> 201", r.status === 201);
  const rideId = r.body?.data?._id;

  // Rider 1 requests seat
  r = await request("POST", `/rides/${rideId}/requests`, { headers: rider1Auth, body: { seats: 1 } });
  check("rider 1 requests seat -> 201", r.status === 201);
  const req1Id = r.body?.data?._id;

  // Driver accepts rider 1
  r = await request("PUT", `/rides/${rideId}/requests/${req1Id}`, { body: { decision: "accepted" } });
  check("driver accepts rider 1 -> 200", r.status === 200);

  // Rider 2 requests seat
  r = await request("POST", `/rides/${rideId}/requests`, { headers: rider2Auth, body: { seats: 1 } });
  check("rider 2 requests seat -> 201", r.status === 201);
  const req2Id = r.body?.data?._id;

  // Driver accepts rider 2
  r = await request("PUT", `/rides/${rideId}/requests/${req2Id}`, { body: { decision: "accepted" } });
  check("driver accepts rider 2 -> 200", r.status === 200);

  console.log("\n--- Initial Default Equal Split Verification ---");
  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`);
  check("get adjustable split -> 200", r.status === 200);
  check("default splitMode = EQUAL", r.body?.data?.splitMode === "EQUAL");
  check("isOverridden = false initially", r.body?.data?.isOverridden === false);
  check("costPerRider = 150 each for 2 riders", r.body?.data?.costPerRider === 150);
  check("both riders have isCustom = false", r.body?.data?.riders?.every((rd) => rd.isCustom === false));

  console.log("\n--- Authorization & Validation Tests ---");
  // Non-driver (Rider 1) attempts to override custom shares -> 403
  r = await request("PUT", `/adjustable-cost-split/ride/${rideId}/custom-shares`, {
    headers: rider1Auth,
    body: {
      shares: [
        { riderId: String(rider1Doc._id), amount: 50 },
        { riderId: String(rider2Doc._id), amount: 250 },
      ],
    },
  });
  check("non-driver cannot override custom shares -> 403", r.status === 403);

  // Invalid parameters
  r = await request("PUT", `/adjustable-cost-split/ride/${rideId}/custom-shares`, {
    body: { shares: "invalid-not-array" },
  });
  check("non-array shares payload rejected -> 400", r.status === 400);

  r = await request("PUT", `/adjustable-cost-split/ride/${rideId}/custom-shares`, {
    body: {
      shares: [{ riderId: String(rider1Doc._id), amount: -50 }],
    },
  });
  check("negative share amount rejected -> 400", r.status === 400);

  console.log("\n--- Driver Manually Overrides Cost Shares ---");
  // Driver overrides: Rider 1 pays 100, Rider 2 pays 200 (custom share)
  r = await request("PUT", `/adjustable-cost-split/ride/${rideId}/custom-shares`, {
    body: {
      shares: [
        { riderId: String(rider1Doc._id), amount: 100, note: "Dropped off earlier at Rampura" },
        { riderId: String(rider2Doc._id), amount: 200, note: "Full distance to Gulshan 1" },
      ],
      reason: "Different drop-off distances",
    },
  });
  check("driver overrides custom shares -> 200", r.status === 200);
  check("splitMode updated to CUSTOM", r.body?.data?.splitMode === "CUSTOM");

  // Fetch updated adjustable split
  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`);
  check("splitMode is CUSTOM", r.body?.data?.splitMode === "CUSTOM");
  check("isOverridden is true", r.body?.data?.isOverridden === true);

  const ridersList = r.body?.data?.riders || [];
  const r1Entry = ridersList.find((x) => String(x.rider?._id || x.rider?.studentId) === String(rider1Doc._id) || x.rider?.name === "Rider Anika");
  const r2Entry = ridersList.find((x) => String(x.rider?._id || x.rider?.studentId) === String(rider2Doc._id) || x.rider?.name === "Rider Tanvir");

  check("rider 1 custom share is 100", r1Entry?.splitShare === 100);
  check("rider 1 has isCustom = true", r1Entry?.isCustom === true);
  check("rider 1 customNote preserved", r1Entry?.customNote === "Dropped off earlier at Rampura");

  check("rider 2 custom share is 200", r2Entry?.splitShare === 200);
  check("rider 2 has isCustom = true", r2Entry?.isCustom === true);
  check("rider 2 customNote preserved", r2Entry?.customNote === "Full distance to Gulshan 1");

  console.log("\n--- Rider Views Custom Share ---");
  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`, { headers: rider1Auth });
  check("rider 1 views custom share -> 200", r.status === 200);
  check("rider 1 sees myShare = 100", r.body?.data?.myShare === 100);
  check("rider 1 sees myShareIsCustom = true", r.body?.data?.myShareIsCustom === true);
  check("rider 1 sees isDriver = false", r.body?.data?.isDriver === false);

  console.log("\n--- Driver Updates Single Rider Share ---");
  // Driver overrides single rider (e.g. adjusts Rider 1 to 120)
  r = await request("PUT", `/adjustable-cost-split/ride/${rideId}/riders/${rider1Doc._id}`, {
    body: { amount: 120, note: "Slight distance adjustment" },
  });
  check("driver updates single rider share -> 200", r.status === 200);

  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`, { headers: rider1Auth });
  check("rider 1 updated share is 120", r.body?.data?.myShare === 120);

  console.log("\n--- Driver Resets to Default Equal Split ---");
  // Non-driver attempts reset -> 403
  r = await request("POST", `/adjustable-cost-split/ride/${rideId}/reset-equal`, {
    headers: rider2Auth,
  });
  check("non-driver cannot reset split -> 403", r.status === 403);

  // Driver resets
  r = await request("POST", `/adjustable-cost-split/ride/${rideId}/reset-equal`);
  check("driver resets to equal split -> 200", r.status === 200);
  check("splitMode reverted to EQUAL", r.body?.data?.splitMode === "EQUAL");
  check("costPerRider is 150 each again", r.body?.data?.costPerRider === 150);

  // Verify fetch after reset
  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`);
  check("isOverridden is false after reset", r.body?.data?.isOverridden === false);
  check("all riders have equal splitShare of 150", r.body?.data?.riders?.every((rd) => rd.splitShare === 150));

  console.log("\n=========================================");
  if (failures === 0) {
    console.log("  ALL ADJUSTABLE COST SPLIT TESTS PASSED! (100% SUCCESS)");
    console.log("=========================================\n");
    process.exit(0);
  } else {
    console.log(`  ${failures} TEST(S) FAILED`);
    console.log("=========================================\n");
    process.exit(1);
  }
};

main();
