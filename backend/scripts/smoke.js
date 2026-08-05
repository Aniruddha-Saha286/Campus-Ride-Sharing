const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

process.env.MONGO_URI = null; // set below once the memory server is up
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5999";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5999;
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
    // Let fetch set the multipart boundary itself.
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
    /* non-JSON (e.g. static file) */
  }
  return { status: res.status, body: json, headers: res.headers };
};

const pngBuffer = () => {
  // Minimal valid 1x1 PNG (also serves as a fake "student ID" upload).
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
};

const createFormData = (profile = VALID_PROFILE, { withCard = true } = {}) => {
  const fd = new FormData();
  fd.append("profile", JSON.stringify(profile));
  if (withCard) fd.append("studentIdCard", new Blob([pngBuffer()], { type: "image/png" }), "idcard.png");
  return fd;
};

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("campus-ride-sharing");
  require("../server.js");

  // Wait for the server to accept connections.
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

  console.log("\n--- Auth ---");
  let r = await fetch(`${BASE}/students/profile/me`);
  check("no token -> 401", r.status === 401);
  r = await fetch(`${BASE}/students/profile/me`, {
    headers: { Authorization: `Bearer ${token}${"garbage"}` },
  });
  check("bad/expired token -> 401", r.status === 401);

  r = await request("POST", "/auth/google", { body: { credential: "garbage-token" } });
  check("invalid google credential -> 401", r.status === 401);
  r = await request("POST", "/auth/google", { body: {} });
  check("missing google credential -> 401", r.status === 401);

  console.log("\n--- Create ---");
  r = await request("POST", "/students/profile", { body: createFormData() });
  check("create profile -> 201", r.status === 201, JSON.stringify(r.body));
  check("profileCompleted computed on create", r.body?.data?.profileCompleted === true);
  check("id card recorded on create", typeof r.body?.data?.studentIdCard === "string" && r.body.data.studentIdCard.startsWith("uploads/id-cards/"));
  check("verification pending on create", r.body?.data?.idVerificationStatus === "pending");
  check("idVerified false on create", r.body?.data?.idVerified === false);
  check("emergencyContact persisted", r.body?.data?.emergencyContact?.relation === "Parent");
  check("dateOfBirth persisted", new Date(r.body?.data?.dateOfBirth).toISOString().slice(0, 10) === "2003-05-14");
  check("studentNid persisted", r.body?.data?.studentNid === "20030514123456789");
  check("passport persisted (uppercased)", r.body?.data?.passport === "AB1234567");
  check("parentInfo persisted", r.body?.data?.parentInfo?.fatherName === "Abdul Rahman");
  check("localGuardian persisted", r.body?.data?.localGuardian?.nid === "19950412123456789");
  check("localGuardian dateOfBirth persisted", new Date(r.body?.data?.localGuardian?.dateOfBirth).toISOString().slice(0, 10) === "1995-04-12");
  const studentId = r.body?.data?._id;

  const noCardToken = jwt.sign(
    { id: "nocard", universityEmail: "nocard@g.bracu.ac.bd" },
    process.env.JWT_SECRET
  );
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${noCardToken}` },
    body: createFormData(VALID_PROFILE, { withCard: false }),
  });
  check("create without id card -> 400", r.status === 400, JSON.stringify(r.body));
  check("card required message", r.body?.message === "University ID card is required");

  const noGuardianToken = jwt.sign(
    { id: "noguardian", universityEmail: "noguardian@g.bracu.ac.bd" },
    process.env.JWT_SECRET
  );
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${noGuardianToken}` },
    body: createFormData({ ...VALID_PROFILE, localGuardian: undefined }),
  });
  check("create without local guardian -> 201", r.status === 201, JSON.stringify(r.body));
  check("profileCompleted true without guardian", r.body?.data?.profileCompleted === true);
  check("guardian not persisted", r.body?.data?.localGuardian === undefined);

  r = await request("POST", "/students/profile", { body: createFormData() });
  check("duplicate create -> 409", r.status === 409);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, phone: "not-a-phone" }),
  });
  check("invalid phone -> 400", r.status === 400);
  check("validation error shape", Array.isArray(r.body?.errors) && r.body.errors.length > 0);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, phone: "1234567890" }),
  });
  check("10-digit fake phone -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, phone: "01123456789" }),
  });
  check("invalid operator prefix (011...) -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, phone: "017123456789" }),
  });
  check("too many digits (12) -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, emergencyContact: { name: "", relation: "", phone: "" } }),
  });
  check("empty emergency contact -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, studentId: "1234" }),
  });
  check("short student id -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, studentId: "20101234ABC" }),
  });
  check("alphanumeric student id -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, dateOfBirth: "2030-01-01" }),
  });
  check("future date of birth -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, dateOfBirth: "not-a-date" }),
  });
  check("invalid date of birth -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, studentNid: "20009999123456789" }),
  });
  check("student NID year mismatch with date of birth -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, studentNid: "12345" }),
  });
  check("short student NID -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, passport: "NOTAPASSPORT" }),
  });
  check("invalid passport -> 400", r.status === 400);

  const passportToken = jwt.sign(
    { id: "passportuser", universityEmail: "passport@g.bracu.ac.bd" },
    process.env.JWT_SECRET
  );
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${passportToken}` },
    body: createFormData({ ...VALID_PROFILE, passport: "ab1234567" }),
  });
  check("lowercase passport accepted -> 201", r.status === 201);
  check("passport stored uppercase", r.body?.data?.passport === "AB1234567");

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, parentInfo: { ...VALID_PROFILE.parentInfo, fatherPhone: "" } }),
  });
  check("missing father phone -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, localGuardian: { ...VALID_PROFILE.localGuardian, nid: "12345" } }),
  });
  check("short local guardian NID -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, localGuardian: { ...VALID_PROFILE.localGuardian, nid: "1234567890ABC" } }),
  });
  check("alphanumeric local guardian NID -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, localGuardian: { ...VALID_PROFILE.localGuardian, nid: "20000412123456789" } }),
  });
  check("NID year mismatch with date of birth -> 400", r.status === 400);

  r = await request("POST", "/students/profile", {
    body: createFormData({ ...VALID_PROFILE, localGuardian: { ...VALID_PROFILE.localGuardian, dateOfBirth: "2030-01-01" } }),
  });
  check("future local guardian date of birth -> 400", r.status === 400);

  console.log("\n--- Read own profile ---");
  r = await request("GET", "/students/profile/me");
  check("get own profile -> 200", r.status === 200);
  check("own profile includes phone", r.body?.data?.phone === VALID_PROFILE.phone);

  console.log("\n--- Update ---");
  r = await request("PUT", "/students/profile", {
    body: { ...VALID_PROFILE, year: "4th Year", name: "Anisha R." },
  });
  check("update profile -> 200", r.status === 200);
  check("update persisted", r.body?.data?.year === "4th Year");
  check("profileCompleted recomputed on update", r.body?.data?.profileCompleted === true);

  r = await request("PUT", "/students/profile", {
    body: { ...VALID_PROFILE, name: "Anisha R.", localGuardian: { name: "Partial Only" } },
  });
  check("partial local guardian on update -> 200", r.status === 200);
  check("partial guardian persisted as given", r.body?.data?.localGuardian?.name === "Partial Only");

  console.log("\n--- Public view (privacy) ---");
  r = await request("GET", `/students/${studentId}`);
  check("public view -> 200", r.status === 200);
  check("phone hidden publicly", r.body?.data?.phone === undefined);
  check("homeArea hidden publicly", r.body?.data?.homeArea === undefined);
  check("name visible publicly", r.body?.data?.name === "Anisha R.");

  r = await request("GET", "/students/not-an-objectid");
  check("invalid id -> 400", r.status === 400);
  r = await request("GET", "/students/000000000000000000000000");
  check("unknown id -> 404", r.status === 404);

  console.log("\n--- Photo upload ---");
  let fd = new FormData();
  fd.append("profilePhoto", new Blob([pngBuffer()], { type: "image/png" }), "card.png");
  r = await request("POST", "/students/profile/photo", { body: fd });
  check("upload png -> 200", r.status === 200, JSON.stringify(r.body));
  const photoPath = r.body?.data?.profilePhoto;
  check("photo path recorded", typeof photoPath === "string" && photoPath.startsWith("uploads/profile-photos/"));
  const absPhoto = path.join(__dirname, "..", photoPath);
  check("photo file exists on disk", fs.existsSync(absPhoto));

  let served = await fetch(`http://localhost:${PORT}/${photoPath}`);
  check("photo served statically", served.status === 200 && served.headers.get("content-type") === "image/png");

  fd = new FormData();
  fd.append("profilePhoto", new Blob([Buffer.from("hello")], { type: "text/plain" }), "evil.txt");
  r = await request("POST", "/students/profile/photo", { body: fd });
  check("text file rejected -> 400", r.status === 400);

  fd = new FormData();
  fd.append("profilePhoto", new Blob([Buffer.alloc(6 * 1024 * 1024)], { type: "image/png" }), "big.png");
  r = await request("POST", "/students/profile/photo", { body: fd });
  check("oversized file -> 400", r.status === 400);

  console.log("\n--- Photo delete ---");
  r = await request("DELETE", "/students/profile/photo");
  check("delete photo -> 200", r.status === 200);
  check("photo removed from record", r.body?.data?.profilePhoto === null);
  check("photo file removed from disk", !fs.existsSync(absPhoto));

  console.log("\n--- ID card upload ---");
  fd = new FormData();
  fd.append("studentIdCard", new Blob([pngBuffer()], { type: "image/png" }), "idcard.png");
  r = await request("POST", "/students/profile/idcard", { body: fd });
  check("upload id card -> 200", r.status === 200, JSON.stringify(r.body));
  check("verification status pending", r.body?.data?.idVerificationStatus === "pending");
  check("idVerified false while pending", r.body?.data?.idVerified === false);
  const idCardPath = r.body?.data?.studentIdCard;
  check("id card path recorded", typeof idCardPath === "string" && idCardPath.startsWith("uploads/id-cards/"));
  check("id card file exists on disk", fs.existsSync(path.join(__dirname, "..", idCardPath)));

  r = await request("GET", "/students/profile/me");
  check("own profile reflects pending status", r.body?.data?.idVerificationStatus === "pending");

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

  r = await request("PUT", `/admin/verifications/${studentId}`, {
    headers: adminAuth,
    body: { decision: "bogus" },
  });
  check("invalid decision -> 400", r.status === 400);

  r = await request("PUT", `/admin/verifications/${studentId}`, {
    headers: adminAuth,
    body: { decision: "approved" },
  });
  check("admin approve -> 200", r.status === 200, JSON.stringify(r.body));
  check("status approved", r.body?.data?.idVerificationStatus === "approved");
  check("idVerified badge true", r.body?.data?.idVerified === true);

  r = await request("GET", "/students/profile/me");
  check("student sees approved badge", r.body?.data?.idVerified === true);

  r = await request("GET", "/admin/verifications?status=approved", { headers: adminAuth });
  check("approved list contains student", r.body?.data?.some((s) => s.universityEmail === USER_EMAIL));

  // Re-upload resets to pending, then reject with a note.
  fd = new FormData();
  fd.append("studentIdCard", new Blob([pngBuffer()], { type: "image/png" }), "idcard2.png");
  r = await request("POST", "/students/profile/idcard", { body: fd });
  check("re-upload resets to pending", r.body?.data?.idVerificationStatus === "pending");

  r = await request("PUT", `/admin/verifications/${studentId}`, {
    headers: adminAuth,
    body: { decision: "rejected", note: "Card unreadable" },
  });
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
  check(
    "users list exposes full details",
    r.body?.data?.some((s) => s.universityEmail === USER_EMAIL && s.phone === VALID_PROFILE.phone)
  );
  check(
    "users list includes verification state",
    r.body?.data?.some((s) => s.universityEmail === USER_EMAIL && s.idVerificationStatus === "rejected")
  );

  r = await request("GET", "/admin/users?search=Anisha", { headers: adminAuth });
  check("search by name finds student", r.body?.data?.some((s) => s.universityEmail === USER_EMAIL));

  r = await request("GET", "/admin/users?search=zzznomatch", { headers: adminAuth });
  check("search with no match -> empty list", Array.isArray(r.body?.data) && r.body.data.length === 0);

  r = await request("PUT", `/admin/users/${studentId}/ban`, {
    headers: adminAuth,
    body: { reason: "Fake account creation" },
  });
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

  r = await request("GET", "/students/profile/me");
  check("student access restored after unban -> 200", r.status === 200);

  r = await request("PUT", "/admin/users/000000000000000000000000/ban", {
    headers: adminAuth,
    body: { reason: "x" },
  });
  check("ban unknown student -> 404", r.status === 404);

  console.log("\n--- Non-existent profile behaviour ---");
  const otherToken = jwt.sign({ id: "other", universityEmail: "nobody@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await fetch(`${BASE}/students/profile/me`, { headers: { Authorization: `Bearer ${otherToken}` } });
  check("me for new user -> 404", r.status === 404);
  r = await request("PUT", "/students/profile", {
    headers: { Authorization: `Bearer ${otherToken}` },
    body: VALID_PROFILE,
  });
  check("update for missing profile -> 404", r.status === 404);
  r = await request("DELETE", "/students/profile/photo", {
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  check("delete photo for missing profile -> 404", r.status === 404);

  console.log("\n--- Account deletion ---");
  let fd2 = new FormData();
  fd2.append("profilePhoto", new Blob([pngBuffer()], { type: "image/png" }), "card.png");
  r = await request("POST", "/students/profile/photo", { body: fd2 });
  check("photo uploaded before delete", r.status === 200, JSON.stringify(r.body));
  const delPhoto = r.body?.data?.profilePhoto;

  r = await request("DELETE", "/students/profile");
  check("delete account -> 200", r.status === 200, JSON.stringify(r.body));
  check("account photo file removed", !fs.existsSync(path.join(__dirname, "..", delPhoto)));
  r = await request("GET", "/students/profile/me");
  check("me after delete -> 404", r.status === 404);
  r = await request("POST", "/students/profile", { body: createFormData() });
  check("recreate after delete -> 201", r.status === 201);
  check("recreated profile starts fresh (no photo)", r.body?.data?.profilePhoto === null);
  check("recreated profile is pending again", r.body?.data?.idVerificationStatus === "pending");

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
  await mongo.stop();
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
