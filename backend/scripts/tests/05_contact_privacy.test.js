const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5905";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5905;
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


  console.log("\n--- Contact Privacy ---");
  let r = await request("POST", "/students/profile", { body: createFormData() });
  const posterId = r.body?.data?._id;

  const riderToken = jwt.sign({ id: "rider", universityEmail: "rider@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${riderToken}` },
    body: createFormData({ ...VALID_PROFILE, studentId: "20108888", name: "Rider Student", studentNid: "20030514987654321", phone: "+8801722000000" }),
  });
  const riderId = r.body?.data?._id;
  const riderAuth = { Authorization: `Bearer ${riderToken}` };

  const strangerToken = jwt.sign({ id: "stranger", universityEmail: "stranger@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${strangerToken}` },
    body: createFormData({ ...VALID_PROFILE, studentId: "20107777", name: "Stranger Student", studentNid: "20030514999999999", phone: "+8801733000000" }),
  });
  const strangerAuth = { Authorization: `Bearer ${strangerToken}` };

  r = await request("POST", "/admin/login", { body: { email: "admin@campusride.local", password: "Admin@12345" } });
  const adminAuth = { Authorization: `Bearer ${r.body.token}` };
  await request("PUT", `/admin/verifications/${posterId}`, { headers: adminAuth, body: { decision: "approved" } });
  await request("PUT", `/admin/verifications/${riderId}`, { headers: adminAuth, body: { decision: "approved" } });

  r = await request("POST", "/rides", { body: { pickup: "Mirpur 10", dropoff: "BracU", departureTime: "09:00", seats: 3 } });
  const rideId = r.body?.data?._id;

  r = await request("POST", `/rides/${rideId}/requests`, { headers: riderAuth });
  const reqId = r.body?.data?._id;

  // Contact info blocked without accepted booking -> 403
  r = await request("GET", `/requests/${reqId}/contact`, { headers: riderAuth });
  check("Contact info blocked without accepted booking -> 403", r.status === 403);
  
  // Accept booking
  r = await request("PUT", `/rides/${rideId}/requests/${reqId}`, { body: { decision: "accepted" } });

  // Contact unlocks after acceptance -> 200 (phone revealed)
  r = await request("GET", `/requests/${reqId}/contact`, { headers: riderAuth });
  check("Contact unlocks after acceptance -> 200", r.status === 200);
  check("phone revealed", typeof r.body?.data?.phone === "string");
  
  // Ride contact endpoints
  r = await request("GET", `/rides/${rideId}/contacts`, { headers: riderAuth });
  check("Ride contact unlocks -> 200", r.status === 200);
  
  // Stranger cannot see contact -> 403
  r = await request("GET", `/requests/${reqId}/contact`, { headers: strangerAuth });
  check("Stranger cannot see request contact -> 403", r.status === 403);
  r = await request("GET", `/rides/${rideId}/contacts`, { headers: strangerAuth });
  check("Stranger cannot see ride contacts -> 403", r.status === 403);


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
