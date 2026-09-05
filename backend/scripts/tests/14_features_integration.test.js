const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5917";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5917;
const BASE = `http://localhost:${PORT}/api`;

const DRIVER_EMAIL = "driver.full@g.bracu.ac.bd";
const DRIVER_ID = "driverFull123";

const RIDER1_EMAIL = "rider1.full@g.bracu.ac.bd";
const RIDER1_ID = "riderFull1";

const RIDER2_EMAIL = "rider2.full@g.bracu.ac.bd";
const RIDER2_ID = "riderFull2";

const RIDER3_EMAIL = "rider3.full@g.bracu.ac.bd";
const RIDER3_ID = "riderFull3";

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
  process.env.MONGO_URI = mongo.getUri("campus-ride-sharing-features-integration");
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

  console.log("\n--- Setting up Driver and 3 Riders ---");
  const Student = require("../../models/Student");
  const students = await Student.create([
    {
      universityEmail: DRIVER_EMAIL,
      studentId: "18101099",
      name: "Tanjim Driver",
      department: "CSE",
      year: "4th Year",
      homeArea: "Merul Badda",
      phone: "+8801711111199",
      dateOfBirth: new Date("2000-01-01"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801711111198" },
      parentInfo: { fatherName: "F", fatherPhone: "+8801711111197", motherName: "M", motherPhone: "+8801711111196" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
    {
      universityEmail: RIDER1_EMAIL,
      studentId: "19101091",
      name: "Nabila Rider",
      department: "EEE",
      year: "3rd Year",
      homeArea: "Rampura",
      phone: "+8801722222291",
      dateOfBirth: new Date("2001-02-02"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801722222292" },
      parentInfo: { fatherName: "F2", fatherPhone: "+8801722222293", motherName: "M2", motherPhone: "+8801722222294" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
    {
      universityEmail: RIDER2_EMAIL,
      studentId: "20101092",
      name: "Sabbir Rider",
      department: "MNS",
      year: "2nd Year",
      homeArea: "Banasree",
      phone: "+8801733333392",
      dateOfBirth: new Date("2002-03-03"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801733333393" },
      parentInfo: { fatherName: "F3", fatherPhone: "+8801733333394", motherName: "M3", motherPhone: "+8801733333395" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
    {
      universityEmail: RIDER3_EMAIL,
      studentId: "21101093",
      name: "Fariha Rider",
      department: "BBA",
      year: "1st Year",
      homeArea: "Dhanmondi",
      phone: "+8801744444493",
      dateOfBirth: new Date("2003-04-04"),
      emergencyContact: { name: "Parent", relation: "Parent", phone: "+8801744444494" },
      parentInfo: { fatherName: "F4", fatherPhone: "+8801744444495", motherName: "M4", motherPhone: "+8801744444496" },
      idVerificationStatus: "approved",
      profileCompleted: true,
    },
  ]);

  const [driverDoc, r1Doc, r2Doc, r3Doc] = students;

  console.log("\n--- Feature 1: Auto Cost Split on Standard Ride Creation & Bookings ---");
  // 1. Create a ride with charge = 600
  let r = await request("POST", "/rides", {
    body: {
      pickup: "BRAC University",
      dropoff: "Dhanmondi 32",
      departureTime: "17:00",
      seats: 3,
      charge: 600,
    },
  });
  check("driver creates ride with charge αº│600 -> 201", r.status === 201);
  const rideId = r.body?.data?._id;

  // 2. Initial state: 0 riders confirmed
  r = await request("GET", `/auto-cost-split/ride/${rideId}`);
  check("auto split initial totalTripCost = 600", r.body?.data?.totalTripCost === 600);
  check("auto split initial confirmedRidersCount = 0", r.body?.data?.confirmedRidersCount === 0);

  // 3. Rider 1 books and gets accepted
  r = await request("POST", `/rides/${rideId}/requests`, { headers: rider1Auth, body: { seats: 1 } });
  check("rider 1 requests seat -> 201", r.status === 201);
  const req1Id = r.body?.data?._id;
  r = await request("PUT", `/rides/${rideId}/requests/${req1Id}`, { body: { decision: "accepted" } });
  check("driver accepts rider 1 -> 200", r.status === 200);

  // 4. Auto split with 1 rider = 600 / 1 = 600
  r = await request("GET", `/auto-cost-split/ride/${rideId}`, { headers: rider1Auth });
  check("auto split with 1 rider: costPerRider = 600", r.body?.data?.costPerRider === 600);

  // 5. Rider 2 books and gets accepted
  r = await request("POST", `/rides/${rideId}/requests`, { headers: rider2Auth, body: { seats: 1 } });
  const req2Id = r.body?.data?._id;
  r = await request("PUT", `/rides/${rideId}/requests/${req2Id}`, { body: { decision: "accepted" } });
  check("driver accepts rider 2 -> 200", r.status === 200);

  // 6. Auto split with 2 riders = 600 / 2 = 300 each (50% savings)
  r = await request("GET", `/auto-cost-split/ride/${rideId}`, { headers: rider2Auth });
  check("auto split with 2 riders: costPerRider = 300", r.body?.data?.costPerRider === 300);
  check("auto split with 2 riders: savingsPerRider = 300 (50%)", r.body?.data?.savingsPerRider === 300 && r.body?.data?.savingsPercent === 50);

  // 7. Rider 3 books and gets accepted
  r = await request("POST", `/rides/${rideId}/requests`, { headers: rider3Auth, body: { seats: 1 } });
  const req3Id = r.body?.data?._id;
  r = await request("PUT", `/rides/${rideId}/requests/${req3Id}`, { body: { decision: "accepted" } });
  check("driver accepts rider 3 -> 200", r.status === 200);

  // 8. Auto split with 3 riders = 600 / 3 = 200 each (67% savings)
  r = await request("GET", `/auto-cost-split/ride/${rideId}`);
  check("auto split with 3 riders: confirmedRidersCount = 3", r.body?.data?.confirmedRidersCount === 3);
  check("auto split with 3 riders: costPerRider = 200 each", r.body?.data?.costPerRider === 200);

  console.log("\n--- Feature 2: Adjustable Cost Split Interoperability ---");
  // 9. Inspect adjustable split before any overrides
  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`);
  check("adjustable split before overrides: splitMode = EQUAL", r.body?.data?.splitMode === "EQUAL");
  check("adjustable split before overrides: isOverridden = false", r.body?.data?.isOverridden === false);
  check("all 3 riders have default equal split of 200", r.body?.data?.riders?.every((x) => x.splitShare === 200 && x.isCustom === false));

  // 10. Rider 1 attempts to set custom shares -> 403 Forbidden
  r = await request("PUT", `/adjustable-cost-split/ride/${rideId}/custom-shares`, {
    headers: rider1Auth,
    body: {
      shares: [{ riderId: String(r1Doc._id), amount: 50 }],
    },
  });
  check("non-driver cannot set custom shares -> 403", r.status === 403);

  // 11. Driver overrides default equal split with custom shares:
  // Rider 1 dropped off early: 150
  // Rider 2 dropped off mid-way: 200
  // Rider 3 dropped off at end: 250
  r = await request("PUT", `/adjustable-cost-split/ride/${rideId}/custom-shares`, {
    body: {
      shares: [
        { riderId: String(r1Doc._id), amount: 150, note: "Dropped off at Rampura" },
        { riderId: String(r2Doc._id), amount: 200, note: "Dropped off at Banasree" },
        { riderId: String(r3Doc._id), amount: 250, note: "Dropped off at Dhanmondi" },
      ],
      reason: "Variable dropoff distances",
    },
  });
  check("driver overrides custom shares -> 200", r.status === 200);

  // 12. Check adjustable split shows CUSTOM mode and preserves individual values
  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`);
  check("splitMode is now CUSTOM", r.body?.data?.splitMode === "CUSTOM");
  check("isOverridden is true", r.body?.data?.isOverridden === true);

  const riders = r.body?.data?.riders || [];
  const r1 = riders.find((x) => String(x.rider?._id || x.rider?.studentId) === String(r1Doc._id) || x.rider?.name === "Nabila Rider");
  const r2 = riders.find((x) => String(x.rider?._id || x.rider?.studentId) === String(r2Doc._id) || x.rider?.name === "Sabbir Rider");
  const r3 = riders.find((x) => String(x.rider?._id || x.rider?.studentId) === String(r3Doc._id) || x.rider?.name === "Fariha Rider");

  check("rider 1 has custom splitShare = 150", r1?.splitShare === 150 && r1?.isCustom === true);
  check("rider 2 has custom splitShare = 200", r2?.splitShare === 200 && r2?.isCustom === true);
  check("rider 3 has custom splitShare = 250", r3?.splitShare === 250 && r3?.isCustom === true);

  // 13. Check individual rider perspective
  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`, { headers: rider1Auth });
  check("rider 1 sees own customized share = 150", r.body?.data?.myShare === 150 && r.body?.data?.myShareIsCustom === true);

  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`, { headers: rider3Auth });
  check("rider 3 sees own customized share = 250", r.body?.data?.myShare === 250 && r.body?.data?.myShareIsCustom === true);

  console.log("\n--- Resetting to Default Equal Split & Updating Total Cost ---");
  // 14. Non-driver attempt to reset equal split -> 403
  r = await request("POST", `/adjustable-cost-split/ride/${rideId}/reset-equal`, { headers: rider2Auth });
  check("non-driver cannot reset split -> 403", r.status === 403);

  // 15. Driver resets to equal split
  r = await request("POST", `/adjustable-cost-split/ride/${rideId}/reset-equal`);
  check("driver resets to equal split -> 200", r.status === 200);

  // 16. Verify splitMode is restored to EQUAL and equal division is recalculated
  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`);
  check("splitMode reverted to EQUAL", r.body?.data?.splitMode === "EQUAL");
  check("isOverridden is false", r.body?.data?.isOverridden === false);
  check("all riders returned to equal share 200", r.body?.data?.riders?.every((x) => x.splitShare === 200 && x.isCustom === false));

  // 17. Driver updates total trip cost to αº│450 via auto-cost-split
  r = await request("PUT", `/auto-cost-split/ride/${rideId}/total-cost`, { body: { totalTripCost: 450 } });
  check("driver updates total cost to 450 -> 200", r.status === 200);

  // 18. Check both features reflect the updated 450 / 3 = 150 each
  r = await request("GET", `/auto-cost-split/ride/${rideId}`);
  check("auto split re-divided: costPerRider = 150", r.body?.data?.costPerRider === 150);

  r = await request("GET", `/adjustable-cost-split/ride/${rideId}`);
  check("adjustable split reflects updated total 450 with 150 each", r.body?.data?.costPerRider === 150 && r.body?.data?.totalTripCost === 450);

  console.log("\n=======================================================");
  if (failures === 0) {
    console.log("  BOTH FEATURES OPERATING PROPERLY & SEAMLESSLY TOGETHER!");
    console.log("  100% SUCCESS ΓÇö ZERO CONFLICTS OR INTERFERENCE.");
    console.log("=======================================================\n");
    process.exit(0);
  } else {
    console.log(`  ${failures} TEST(S) FAILED`);
    console.log("=======================================================\n");
    process.exit(1);
  }
};

main();
