const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5902";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5902;
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


  // Setup: Create a student and upload ID card
  let r = await request("POST", "/students/profile", { body: createFormData() });
  const studentId = r.body?.data?._id;
  
  let fd = new FormData();
  fd.append("studentIdCard", new Blob([pngBuffer()], { type: "image/png" }), "idcard.png");
  await request("POST", "/students/profile/idcard", { body: fd });
  
console.log("\n--- Admin auth ---");
  r = await request("POST", "/admin/login", { body: { email: "admin@campusride.local", password: "wrong" } });
  check("admin wrong password -> 401", r.status === 401);
  r = await request("POST", "/admin/login", { body: { email: "admin@campusride.local", password: "Admin@12345" } });
  check("admin login -> 200", r.status === 200, JSON.stringify(r.body));
  const adminToken = r.body?.token;
  const adminAuth = { Authorization: `Bearer ${adminToken}` };

  r = await request("GET", "/admin/verifications", { headers: auth });
  check("student token on admin route -> 403", r.status === 403);
  r = await request("GET", "/admin/verifications", { headers: adminAuth });
  check("admin list pending -> 200", r.status === 200, JSON.stringify(r.body));
  check("pending list contains student", r.body?.data?.some((s) => s.universityEmail === USER_EMAIL));
  r = await request("GET", `/admin/verifications/${studentId}`, { headers: adminAuth });
  check("admin view one -> 200", r.status === 200);
  check("admin sees full profile", r.body?.data?.phone === VALID_PROFILE.phone);
  r = await request("PUT", `/admin/verifications/${studentId}`, { headers: adminAuth, body: { decision: "bogus" } });
  check("invalid decision -> 400", r.status === 400);
  r = await request("PUT", `/admin/verifications/${studentId}`, { headers: adminAuth, body: { decision: "approved" } });
  check("admin approve -> 200", r.status === 200, JSON.stringify(r.body));
  check("status approved", r.body?.data?.idVerificationStatus === "approved");
  check("idVerified badge true", r.body?.data?.idVerified === true);
  r = await request("GET", "/students/profile/me");
  check("student sees approved badge", r.body?.data?.idVerified === true);
  r = await request("GET", "/admin/verifications?status=approved", { headers: adminAuth });
  check("approved list contains student", r.body?.data?.some((s) => s.universityEmail === USER_EMAIL));

  fd = new FormData();
  fd.append("studentIdCard", new Blob([pngBuffer()], { type: "image/png" }), "idcard2.png");
  r = await request("POST", "/students/profile/idcard", { body: fd });
  check("re-upload resets to pending", r.body?.data?.idVerificationStatus === "pending");
  r = await request("PUT", `/admin/verifications/${studentId}`, { headers: adminAuth, body: { decision: "rejected", note: "Card unreadable" } });
  check("admin reject -> 200", r.status === 200, JSON.stringify(r.body));
  check("status rejected", r.body?.data?.idVerificationStatus === "rejected");
  check("rejection note stored", r.body?.data?.idVerificationNote === "Card unreadable");
  check("badge false after reject", r.body?.data?.idVerified === false);
  r = await request("GET", "/students/profile/me");
  check("student sees rejection note", r.body?.data?.idVerificationNote === "Card unreadable");

  r = await request("GET", "/admin/users", { headers: auth });
  check("student token on users route -> 403", r.status === 403);
  r = await request("GET", "/admin/users", { headers: adminAuth });
  check("admin list users -> 200", r.status === 200, JSON.stringify(r.body));
  check("users list contains student", r.body?.data?.some((s) => s.universityEmail === USER_EMAIL));
  check("users list exposes full details", r.body?.data?.some((s) => s.universityEmail === USER_EMAIL && s.phone === VALID_PROFILE.phone));
  check("users list includes verification state", r.body?.data?.some((s) => s.universityEmail === USER_EMAIL && s.idVerificationStatus === "rejected"));
  r = await request("GET", "/admin/users?search=Anisha", { headers: adminAuth });
  check("search by name finds student", r.body?.data?.some((s) => s.universityEmail === USER_EMAIL));
  r = await request("GET", "/admin/users?search=zzznomatch", { headers: adminAuth });
  check("search with no match -> empty list", Array.isArray(r.body?.data) && r.body.data.length === 0);

  r = await request("GET", "/admin/stats", { headers: auth });
  check("student token on stats route -> 403", r.status === 403);
  r = await request("GET", "/admin/users", { headers: adminAuth });
  const usersListLength = r.body?.data?.length;
  r = await request("GET", "/admin/stats", { headers: adminAuth });
  check("admin stats -> 200", r.status === 200, JSON.stringify(r.body));
  check("stats count matches users list length", r.body?.data?.registeredStudents === usersListLength);

  r = await request("PUT", `/admin/users/${studentId}/ban`, { headers: adminAuth, body: { reason: "Fake account creation" } });
  check("admin ban student -> 200", r.status === 200, JSON.stringify(r.body));
  check("ban flag set", r.body?.data?.isBanned === true);
  check("ban reason stored", r.body?.data?.banReason === "Fake account creation");
  r = await request("GET", "/students/profile/me");
  check("banned student blocked from API -> 403", r.status === 403);
  r = await request("GET", "/admin/users", { headers: adminAuth });
  check("banned student flagged in users list", r.body?.data?.some((s) => s._id === studentId && s.isBanned === true));
  r = await request("PUT", `/admin/users/${studentId}/unban`, { headers: adminAuth });
  check("admin unban student -> 200", r.status === 200);
  check("ban flag cleared", r.body?.data?.isBanned === false);
  check("ban reason cleared", r.body?.data?.banReason === null);
  r = await request("PUT", "/admin/users/000000000000000000000000/ban", { headers: adminAuth, body: { reason: "x" } });
  check("ban unknown student -> 404", r.status === 404);

  // Admin Live Ride Tracker & User Ride History Checks
  r = await request("GET", "/admin/rides/tracker", { headers: adminAuth });
  check("admin get live ride tracker -> 200", r.status === 200);
  check("tracker returns an array", Array.isArray(r.body?.data));

  r = await request("GET", `/admin/users/${studentId}/rides`, { headers: adminAuth });
  check("admin get user ride history -> 200", r.status === 200);
  check("user ride history has asDriver and asPassenger", Array.isArray(r.body?.data?.asDriver) && Array.isArray(r.body?.data?.asPassenger));

  // Blocked for non-admin
  r = await request("GET", "/admin/rides/tracker", { headers: auth });
  check("student blocked from admin ride tracker -> 403", r.status === 403);
  r = await request("GET", `/admin/users/${studentId}/rides`, { headers: auth });
  check("student blocked from admin user ride history -> 403", r.status === 403);

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
