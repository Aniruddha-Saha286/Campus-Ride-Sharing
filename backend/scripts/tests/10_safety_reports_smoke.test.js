const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "safety-smoke-secret";
process.env.PORT = "5910";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5910;
const BASE = `http://localhost:${PORT}/api`;
const DRIVER_EMAIL = "driver.safety@g.bracu.ac.bd";
const DRIVER_ID = "driver-safe-1";

const PASSENGER_EMAIL = "passenger.safe@g.bracu.ac.bd";
const PASSENGER_ID = "passenger-safe-1";

const STRANGER_EMAIL = "stranger@g.bracu.ac.bd";
const STRANGER_ID = "stranger-safe-1";

const VALID_PROFILE = {
  studentId: "20101234",
  name: "Safe Driver",
  department: "CSE",
  year: "3rd Year",
  homeArea: "Mirpur 10, Dhaka",
  phone: "+8801711000000",
  dateOfBirth: "2003-05-14",
  studentNid: "20030514123456789",
  passport: "AB1234567",
  emergencyContact: { name: "Guardian", relation: "Parent", phone: "01799000000" },
  parentInfo: {
    fatherName: "Father",
    fatherPhone: "01711111111",
    motherName: "Mother",
    motherPhone: "01722222222",
  },
  localGuardian: {
    name: "Uncle",
    relation: "Uncle",
    dateOfBirth: "1995-04-12",
    phone: "01733333333",
    address: "House 12, Road 7, Dhaka",
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

const driverToken = jwt.sign({ id: DRIVER_ID, universityEmail: DRIVER_EMAIL }, process.env.JWT_SECRET);
const driverAuth = { Authorization: `Bearer ${driverToken}` };

const passToken = jwt.sign({ id: PASSENGER_ID, universityEmail: PASSENGER_EMAIL }, process.env.JWT_SECRET);
const passAuth = { Authorization: `Bearer ${passToken}` };

const strangerToken = jwt.sign({ id: STRANGER_ID, universityEmail: STRANGER_EMAIL }, process.env.JWT_SECRET);
const strangerAuth = { Authorization: `Bearer ${strangerToken}` };

let adminAuth = {};

const request = async (method, p, { headers = {}, body } = {}) => {
  const opts = { method, headers: { ...headers } };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.body = JSON.stringify(body);
    if (opts.headers["Content-Type"] === undefined) {
      opts.headers["Content-Type"] = "application/json";
    }
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

const pngBuffer = () =>
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

const createFormData = (profile = VALID_PROFILE) => {
  const fd = new FormData();
  fd.append("profile", JSON.stringify(profile));
  fd.append("studentIdCard", new Blob([pngBuffer()], { type: "image/png" }), "idcard.png");
  return fd;
};

const main = async () => {
  console.log("\n=========================================");
  console.log("  Smoke Test: Safety Concern Reporting");
  console.log("=========================================\n");

  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("campus-ride-safety-test");
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
  check("Server boots and is reachable", up);

  // 1. Setup Student Profiles
  let r = await request("POST", "/students/profile", { headers: driverAuth, body: createFormData() });
  check("Driver profile created", r.status === 201);
  const driverStudentId = r.body?.data?._id;

  r = await request("POST", "/students/profile", {
    headers: passAuth,
    body: createFormData({ ...VALID_PROFILE, studentId: "20101999", name: "Safe Passenger", phone: "+8801722000000" }),
  });
  check("Passenger profile created", r.status === 201);
  const passStudentId = r.body?.data?._id;

  r = await request("POST", "/students/profile", {
    headers: strangerAuth,
    body: createFormData({ ...VALID_PROFILE, studentId: "20101888", name: "Stranger Student", phone: "+8801733000000" }),
  });
  check("Stranger profile created", r.status === 201);
  const strangerStudentId = r.body?.data?._id;

  // 2. Admin Logs In and Approves Profiles
  r = await request("POST", "/admin/login", {
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  });
  check("Admin login successful", r.status === 200);
  const adminToken = r.body?.token;
  adminAuth = { Authorization: `Bearer ${adminToken}` };

  r = await request("PUT", `/admin/verifications/${driverStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  check("Admin approves driver verification", r.status === 200);

  r = await request("PUT", `/admin/verifications/${passStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  check("Admin approves passenger verification", r.status === 200);

  r = await request("PUT", `/admin/verifications/${strangerStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  check("Admin approves stranger verification", r.status === 200);

  // 3. Driver Posts Ride
  r = await request("POST", "/rides", {
    headers: driverAuth,
    body: {
      pickup: "Mohakhali, Dhaka",
      dropoff: "Merul Badda, Dhaka",
      departureTime: "09:30",
      seats: 3,
      charge: 50,
      genderPreference: "any",
    },
  });
  check("Driver posts ride (201 Created)", r.status === 201, JSON.stringify(r.body));
  const rideId = r.body?.data?._id;

  // 4. Security: Passenger tries to report BEFORE request acceptance
  r = await request("POST", "/safety-reports", {
    headers: passAuth,
    body: {
      tripId: rideId,
      category: "Unsafe driving",
      description: "Driver was speeding before ride started",
    },
  });
  check("Unaccepted passenger reporting rejected with 403 Forbidden", r.status === 403);

  // 5. Passenger requests seat
  r = await request("POST", `/rides/${rideId}/requests`, {
    headers: passAuth,
    body: { seats: 1 },
  });
  check("Passenger requests seat", r.status === 201);
  const requestId = r.body?.data?._id;

  // 6. Driver accepts passenger request
  r = await request("PUT", `/rides/${rideId}/requests/${requestId}`, {
    headers: driverAuth,
    body: { decision: "accepted" },
  });
  check("Driver accepts passenger seat request", r.status === 200);

  // 7. Security: Stranger tries to report trip
  r = await request("POST", "/safety-reports", {
    headers: strangerAuth,
    body: {
      tripId: rideId,
      category: "Unsafe driving",
      description: "Stranger trying to report a trip they never joined",
    },
  });
  check("Unassociated student reporting rejected with 403 Forbidden", r.status === 403);

  // 8. Validation: Missing category
  r = await request("POST", "/safety-reports", {
    headers: passAuth,
    body: {
      tripId: rideId,
      description: "Description without a category",
    },
  });
  check("Missing category rejected with 400 Bad Request", r.status === 400);

  // 9. Validation: Description too short (< 5 chars)
  r = await request("POST", "/safety-reports", {
    headers: passAuth,
    body: {
      tripId: rideId,
      category: "Unsafe driving",
      description: "bad",
    },
  });
  check("Short description (<5 chars) rejected with 400 Bad Request", r.status === 400);

  // 10. Passenger successfully submits a safety report
  r = await request("POST", "/safety-reports", {
    headers: passAuth,
    body: {
      tripId: rideId,
      category: "Unsafe driving",
      description: "Driver was texting while driving fast over speed bumps.",
    },
  });
  check("Passenger submits safety report (201 Created)", r.status === 201);
  check("Report initialized with status 'Pending'", r.body?.data?.status === "Pending");
  const reportId = r.body?.data?._id;

  // 11. Driver successfully submits a safety report for passenger issue
  r = await request("POST", "/safety-reports", {
    headers: driverAuth,
    body: {
      tripId: rideId,
      category: "Property damage",
      description: "Passenger tore the back seat cover during commute.",
    },
  });
  check("Driver submits safety report with driver category (201 Created)", r.status === 201);

  // 12. Student gets their submitted safety reports
  r = await request("GET", "/safety-reports/my", { headers: passAuth });
  check("Student retrieves their reports (/api/safety-reports/my)", r.status === 200);
  check("Reports list contains submitted report", r.body?.data?.some((rep) => rep._id === reportId));
  check("Report has populated trip route details", r.body?.data?.[0]?.trip?.pickup === "Mohakhali, Dhaka");

  // 13. Security: Student tries to access Admin safety endpoint
  r = await request("GET", "/safety-reports/admin", { headers: passAuth });
  check("Student blocked from admin reports endpoint with 403 Forbidden", r.status === 403);

  // 14. Admin fetches safety reports with filter
  r = await request("GET", "/safety-reports/admin?status=needs_resolution&sort=newest", { headers: adminAuth });
  check("Admin fetches reports under 'needs_resolution'", r.status === 200);
  check("Needs resolution contains the pending report", r.body?.data?.some((rep) => rep._id === reportId));

  // 15. Admin updates status to "Reviewed"
  r = await request("PUT", `/safety-reports/admin/${reportId}/status`, {
    headers: adminAuth,
    body: { status: "Reviewed" },
  });
  check("Admin marks report as 'Reviewed' (200 OK)", r.status === 200 && r.body?.data?.status === "Reviewed");

  // 16. Admin resolves the report
  r = await request("PUT", `/safety-reports/admin/${reportId}/status`, {
    headers: adminAuth,
    body: { status: "Resolved" },
  });
  check("Admin resolves report (200 OK)", r.status === 200 && r.body?.data?.status === "Resolved");

  // 17. Verify status on student side reflects "Resolved"
  r = await request("GET", "/safety-reports/my", { headers: passAuth });
  const updatedReport = r.body?.data?.find((rep) => rep._id === reportId);
  check("Student side reflects status 'Resolved'", updatedReport?.status === "Resolved");

  // 18. Admin filter 'resolved' shows the resolved report
  r = await request("GET", "/safety-reports/admin?status=resolved", { headers: adminAuth });
  check("Admin 'resolved' tab shows the resolved report", r.body?.data?.some((rep) => rep._id === reportId));

  console.log("\n-----------------------------------------");
  if (failures === 0) {
    console.log("🎉 ALL SAFETY REPORT SMOKE TESTS PASSED!\n");
    process.exit(0);
  } else {
    console.log(`❌ ${failures} TEST CHECK(S) FAILED.\n`);
    process.exit(1);
  }
};

main().catch((err) => {
  console.error("Fatal error in smoke test:", err);
  process.exit(1);
});
