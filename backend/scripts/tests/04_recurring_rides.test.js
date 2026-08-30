const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5904";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5904;
const BASE = `http://localhost:${PORT}/api`;
const USER_EMAIL = "test.student@g.bracu.ac.bd";
const USER_ID = "test123";

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
  return { status: res.status, body: json, headers: res.headers };
};

const pngBuffer = () =>
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

const createFormData = (profile = VALID_PROFILE, { withCard = true } = {}) => {
  const fd = new FormData();
  fd.append("profile", JSON.stringify(profile));
  if (withCard) fd.append("studentIdCard", new Blob([pngBuffer()], { type: "image/png" }), "idcard.png");
  return fd;
};

const dateKey = (date) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

const todayKey = () => dateKey(new Date());
const futureKey = (days) => dateKey(Date.now() + days * 86400000);




const backdateTemplate = async (id) => {
  const RecurringRide = require("../../models/RecurringRide");
  await RecurringRide.updateOne({ _id: id }, { $set: { generatedForDate: new Date(Date.now() - 86400000) } });
};

const generatedRides = async (templateId) => {
  const Ride = require("../../models/Ride");
  return Ride.find({ recurringRef: templateId });
};

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("campus-ride-sharing");
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


  // Setup: Create rider profile and approve main + rider
  let r = await request("POST", "/students/profile", { body: createFormData() });
  const recreatedStudentId = r.body?.data?._id;

  const riderToken = jwt.sign({ id: "rider", universityEmail: "rider@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${riderToken}` },
    body: createFormData({ ...VALID_PROFILE, studentId: "20108888", name: "Rider Student", studentNid: "20030514987654321", phone: "+8801722000000" }),
  });
  const riderStudentId = r.body?.data?._id;
  const riderAuth = { Authorization: `Bearer ${riderToken}` };
  
  r = await request("POST", "/admin/login", { body: { email: "admin@campusride.local", password: "Admin@12345" } });
  const adminToken = r.body?.token;
  const adminAuth = { Authorization: `Bearer ${adminToken}` };
  
  await request("PUT", `/admin/verifications/${recreatedStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  await request("PUT", `/admin/verifications/${riderStudentId}`, { headers: adminAuth, body: { decision: "approved" } });

  console.log("\n--- Recurring offers: CRUD ---");
  r = await request("POST", "/rides", { body: { pickup: "Mirpur 10", dropoff: "BracU", departureTime: "09:00", seats: 3 } });
  const recurRideId = r.body?.data?._id;
  
  r = await request("POST", `/recurring/from/${recurRideId}`);
  check("mark ride recurring -> 201", r.status === 201);
  const templateIdCRUD = r.body?.data?._id;

  r = await request("POST", `/recurring/from/${recurRideId}`);
  check("duplicate recurring -> 409", r.status === 409);

  r = await request("GET", "/recurring/mine");
  check("list mine contains template", r.status === 200 && r.body?.data?.some(t => t._id === templateIdCRUD));

  r = await request("PUT", `/recurring/${templateIdCRUD}/status`, { body: { status: "disabled" } });
  check("pause recurring -> 200", r.status === 200 && r.body?.data?.status === "disabled");

  r = await request("PUT", `/recurring/${templateIdCRUD}/status`, { body: { status: "active" } });
  check("resume recurring -> 200", r.status === 200 && r.body?.data?.status === "active");
  
  r = await request("DELETE", `/recurring/${templateIdCRUD}`);
  check("delete recurring -> 200", r.status === 200);
console.log("\n--- Recurring offers: skip & restore ---");
  r = await fetch(`${BASE}/recurring/000000000000000000000000/skips`);
  check("no token on skips -> 401", r.status === 401);

  r = await request("POST", "/rides", { body: { pickup: "Mirpur 10", dropoff: "BracU", departureTime: "09:00", seats: 3 } });
  const recurRideId2 = r.body?.data?._id;
  r = await request("POST", `/recurring/from/${recurRideId2}`);
  check("mark ride recurring -> 201", r.status === 201, JSON.stringify(r.body));
  const templateId = r.body?.data?._id;

  r = await request("POST", "/rides", { body: { pickup: "Gulshan", dropoff: "BracU", departureTime: "08:30", seats: 2 } });
  const secondRideId = r.body?.data?._id;
  r = await request("POST", `/recurring/from/${secondRideId}`);
  check("second ride marked recurring -> 201", r.status === 201, JSON.stringify(r.body));
  const secondTemplateId = r.body?.data?._id;

  r = await request("GET", `/recurring/${templateId}/skips`, { headers: riderAuth });
  check("rider cannot list skips -> 403", r.status === 403);
  r = await request("POST", `/recurring/${templateId}/skips`, { headers: riderAuth, body: { date: futureKey(1) } });
  check("rider cannot skip occurrence -> 403", r.status === 403);
  r = await request("DELETE", `/recurring/${templateId}/skips/${futureKey(1)}`, { headers: riderAuth });
  check("rider cannot restore occurrence -> 403", r.status === 403);

  r = await request("GET", "/recurring/not-an-objectid/skips");
  check("invalid template id -> 400", r.status === 400);
  r = await request("GET", "/recurring/000000000000000000000000/skips");
  check("unknown template -> 404", r.status === 404);

  r = await request("POST", `/recurring/${templateId}/skips`, { body: {} });
  check("missing date -> 400", r.status === 400);
  r = await request("POST", `/recurring/${templateId}/skips`, { body: { date: "14-08-2026" } });
  check("bad date format -> 400", r.status === 400);
  r = await request("POST", `/recurring/${templateId}/skips`, { body: { date: "2026-13-99" } });
  check("invalid calendar day -> 400", r.status === 400);
  r = await request("POST", `/recurring/${templateId}/skips`, { body: { date: futureKey(-1) } });
  check("past date -> 400", r.status === 400);

  const tomorrow = futureKey(1);
  r = await request("POST", `/recurring/${templateId}/skips`, { body: { date: tomorrow } });
  check("skip future occurrence -> 201", r.status === 201, JSON.stringify(r.body));
  check("skip stores the date", r.body?.data?.date === tomorrow);
  r = await request("POST", `/recurring/${templateId}/skips`, { body: { date: tomorrow } });
  check("duplicate skip -> 409", r.status === 409);

  r = await request("GET", `/recurring/${templateId}/skips`);
  check("list skips -> 200", r.status === 200, JSON.stringify(r.body));
  check("list contains skipped date", (r.body?.data || []).some((s) => s.date === tomorrow));
  check("list only covers this template", (r.body?.data || []).every((s) => s.recurring === templateId));

  const today = todayKey();
  r = await request("POST", `/recurring/${templateId}/skips`, { body: { date: today } });
  check("skip today's occurrence -> 201", r.status === 201, JSON.stringify(r.body));
  await backdateTemplate(templateId);
  r = await request("POST", "/recurring/generate", { headers: auth });
  check("generate runs -> 200", r.status === 200, JSON.stringify(r.body));
  const ridesBefore = await generatedRides(templateId);
  check("no occurrence generated for the cancelled date", ridesBefore.length === 0);

  r = await request("DELETE", `/recurring/${templateId}/skips/${tomorrow}`);
  check("restore tomorrow occurrence -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("DELETE", `/recurring/${templateId}/skips/${today}`);
  check("restore today occurrence -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("GET", `/recurring/${templateId}/skips`);
  check("skips list empty after restore", (r.body?.data || []).length === 0);
  r = await request("DELETE", `/recurring/${templateId}/skips/${tomorrow}`);
  check("restoring again -> 404", r.status === 404);

  await backdateTemplate(templateId);
  r = await request("POST", "/recurring/generate", { headers: auth });
  check("restored template generates again", Number(r.body?.data?.generated) >= 1);
  const ridesAfter = await generatedRides(templateId);
  check("occurrence created with template link", ridesAfter.length >= 1);
  check("generated occurrence is open", ridesAfter.every((ride) => ride.status === "open"));

  await backdateTemplate(secondTemplateId);
  r = await request("POST", "/recurring/generate", { headers: auth });
  check("second template generates a ride -> 200", r.status === 200, JSON.stringify(r.body));
  const published = await generatedRides(secondTemplateId);
  check("second template has a published ride", published.some((ride) => ride.status === "open"));
  r = await request("POST", `/recurring/${secondTemplateId}/skips`, { body: { date: today } });
  check("skip today's published occurrence -> 201", r.status === 201, JSON.stringify(r.body));
  const afterCancel = await generatedRides(secondTemplateId);
  check("published occurrence cancelled without touching the series", afterCancel.every((ride) => ride.status === "cancelled"));
  r = await request("GET", "/recurring/mine");
  check("template still exists and stays active", (r.body?.data || []).some((t) => t._id === secondTemplateId && t.status === "active"));

  const mongoose = require("mongoose");
  await mongoose.disconnect();
  await mongo.stop();

  if (failures === 0) {
    console.log("\nALL TESTS PASSED");
    process.exit(0);
  } else {
    console.log(`\n${failures} TEST(S) FAILED`);
    process.exit(1);
  }
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
