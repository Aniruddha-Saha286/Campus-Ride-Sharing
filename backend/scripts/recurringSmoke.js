const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "recurring-smoke-secret";
process.env.PORT = "5998";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5998;
const BASE = `http://localhost:${PORT}/api`;
const USER_EMAIL = "recurring.student@g.bracu.ac.bd";
const USER_ID = "recurringmain";
const RIDER_EMAIL = "rider.recurring@g.bracu.ac.bd";
const RIDER_ID = "recurringrider";
const UNVERIFIED_EMAIL = "unverified.recurring@g.bracu.ac.bd";
const UNVERIFIED_ID = "recurringunverified";

const VALID_PROFILE = {
  studentId: "20101234",
  name: "Recurring Student",
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

const request = async (method, p, { headers = {}, body } = {}) => {
  const opts = { method, headers: { ...auth, ...headers } };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
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
  return { status: res.status, body: json };
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

const backdateTemplate = async (id) => {
  const RecurringRide = require("../models/RecurringRide");
  await RecurringRide.updateOne({ _id: id }, { $set: { generatedForDate: new Date(Date.now() - 86400000) } });
};

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("campus-ride-sharing");
  require("../server.js");

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

  console.log("\n--- Auth & verification gate ---");
  let r = await fetch(`${BASE}/recurring/mine`);
  check("no token on recurring -> 401", r.status === 401);

  r = await request("POST", "/students/profile", { body: createFormData() });
  check("main profile created -> 201", r.status === 201, JSON.stringify(r.body));
  const studentId = r.body?.data?._id;

  const riderToken = jwt.sign({ id: RIDER_ID, universityEmail: RIDER_EMAIL }, process.env.JWT_SECRET);
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${riderToken}` },
    body: createFormData({ ...VALID_PROFILE, studentId: "20109999", name: "Rider Recurring" }),
  });
  check("rider profile created -> 201", r.status === 201, JSON.stringify(r.body));
  const riderStudentId = r.body?.data?._id;
  const riderAuth = { Authorization: `Bearer ${riderToken}` };

  const unverifiedToken = jwt.sign(
    { id: UNVERIFIED_ID, universityEmail: UNVERIFIED_EMAIL },
    process.env.JWT_SECRET
  );
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${unverifiedToken}` },
    body: createFormData({ ...VALID_PROFILE, studentId: "20101111", name: "Unverified User" }),
  });
  check("unverified profile created -> 201", r.status === 201);

  r = await request("GET", "/recurring/mine", {
    headers: { Authorization: `Bearer ${unverifiedToken}` },
  });
  check("unverified user blocked from recurring -> 403", r.status === 403);

  console.log("\n--- Admin approve ---");
  r = await request("POST", "/admin/login", { body: { email: "admin@campusride.local", password: "Admin@12345" } });
  const adminAuth = { Authorization: `Bearer ${r.body?.token}` };
  r = await request("PUT", `/admin/verifications/${studentId}`, {
    headers: adminAuth,
    body: { decision: "approved" },
  });
  check("approve main user -> 200", r.status === 200);
  r = await request("PUT", `/admin/verifications/${riderStudentId}`, {
    headers: adminAuth,
    body: { decision: "approved" },
  });
  check("approve rider -> 200", r.status === 200);

  console.log("\n--- Create ride & mark recurring ---");
  r = await request("POST", "/rides", {
    body: { pickup: "Mirpur 10", dropoff: "BracU", departureTime: "09:00", seats: 3 },
  });
  check("create ride -> 201", r.status === 201, JSON.stringify(r.body));
  const rideId = r.body?.data?._id;

  r = await request("POST", `/recurring/from/${rideId}`);
  check("mark ride recurring -> 201", r.status === 201, JSON.stringify(r.body));
  check("template saved as active", r.body?.data?.status === "active");
  check("template copies ride route", r.body?.data?.pickup === "Mirpur 10" && r.body?.data?.dropoff === "BracU");
  check("today marked as generated (no dup for today)", typeof r.body?.data?.generatedForDate === "string");
  check("next generation date set", typeof r.body?.data?.nextGenerationDate === "string");
  const templateId = r.body?.data?._id;

  r = await request("POST", `/recurring/from/${rideId}`);
  check("marking same ride again -> 409", r.status === 409);

  r = await request("POST", `/recurring/from/${rideId}`, { headers: riderAuth });
  check("rider cannot mark someone else's ride -> 403", r.status === 403);

  r = await request("POST", `/recurring/from/not-an-objectid`);
  check("invalid ride id -> 400", r.status === 400);

  r = await request("POST", "/rides", {
    body: { pickup: "Uttara", dropoff: "BracU", departureTime: "10:00", seats: 2 },
  });
  const cancelledRideId = r.body?.data?._id;
  r = await request("DELETE", `/rides/${cancelledRideId}`);
  check("ride cancelled for negative test", r.status === 200);
  r = await request("POST", `/recurring/from/${cancelledRideId}`);
  check("cancelled ride cannot be marked -> 400", r.status === 400);

  console.log("\n--- List & permissions ---");
  r = await request("GET", "/recurring/mine");
  check("list mine -> 200", r.status === 200, JSON.stringify(r.body));
  check("list contains template", r.body?.data?.some((t) => t._id === templateId));

  r = await request("PUT", `/recurring/${templateId}`, { headers: riderAuth, body: { pickup: "X" } });
  check("rider cannot edit template -> 403", r.status === 403);
  r = await request("PUT", `/recurring/${templateId}/status`, {
    headers: riderAuth,
    body: { status: "disabled" },
  });
  check("rider cannot change status -> 403", r.status === 403);
  r = await request("DELETE", `/recurring/${templateId}`, { headers: riderAuth });
  check("rider cannot delete template -> 403", r.status === 403);

  console.log("\n--- Auto generation ---");
  await backdateTemplate(templateId);
  r = await request("POST", "/recurring/generate");
  check("generate now -> 200", r.status === 200, JSON.stringify(r.body));
  check("generated at least one instance", Number(r.body?.data?.generated) >= 1);

  r = await request("GET", "/rides/mine");
  check(
    "auto-generated ride appears in my rides",
    (r.body?.data?.posted || []).some((x) => x.pickup === "Mirpur 10" && x.dropoff === "BracU" && x.departureTime === "09:00")
  );

  r = await request("POST", "/recurring/generate");
  check("no duplicate for same day", Number(r.body?.data?.generated) === 0);

  console.log("\n--- Update & disable ---");
  r = await request("POST", "/rides", {
    body: { pickup: "Gulshan", dropoff: "BracU", departureTime: "08:30", seats: 2 },
  });
  const secondRideId = r.body?.data?._id;
  r = await request("POST", `/recurring/from/${secondRideId}`);
  check("second ride marked recurring -> 201", r.status === 201, JSON.stringify(r.body));
  const secondTemplateId = r.body?.data?._id;

  r = await request("PUT", `/recurring/${secondTemplateId}`, { body: { pickup: "Banani" } });
  check("update template -> 200", r.status === 200, JSON.stringify(r.body));
  check("update persisted", r.body?.data?.pickup === "Banani");

  r = await request("PUT", `/recurring/${secondTemplateId}/status`, { body: { status: "bogus" } });
  check("invalid status -> 400", r.status === 400);
  r = await request("PUT", `/recurring/${secondTemplateId}/status`, { body: { status: "disabled" } });
  check("disable template -> 200", r.status === 200);
  check("template disabled", r.body?.data?.status === "disabled");
  check("no next generation date while disabled", r.body?.data?.nextGenerationDate === null);

  await backdateTemplate(secondTemplateId);
  r = await request("POST", "/recurring/generate");
  check("disabled template does not generate", Number(r.body?.data?.generated) === 0);

  r = await request("PUT", `/recurring/${secondTemplateId}/status`, { body: { status: "active" } });
  check("re-enable template -> 200", r.status === 200);
  check("next generation date back after re-enable", typeof r.body?.data?.nextGenerationDate === "string");

  await backdateTemplate(secondTemplateId);
  r = await request("POST", "/recurring/generate");
  check("re-enabled template generates again", Number(r.body?.data?.generated) >= 1);

  r = await request("GET", "/rides/mine");
  check(
    "re-generated ride appears in my rides",
    (r.body?.data?.posted || []).some((x) => x.pickup === "Banani" && x.departureTime === "08:30")
  );

  r = await request("DELETE", `/recurring/${secondTemplateId}`);
  check("delete template -> 200", r.status === 200);
  r = await request("GET", "/recurring/mine");
  check("deleted template gone from list", !r.body?.data?.some((t) => t._id === secondTemplateId));

  r = await request("DELETE", `/recurring/000000000000000000000000`);
  check("delete unknown template -> 404", r.status === 404);

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
  await mongo.stop();
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error("Recurring smoke test crashed:", err);
  process.exit(1);
});
