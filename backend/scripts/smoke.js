const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
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
  const RecurringRide = require("../models/RecurringRide");
  await RecurringRide.updateOne({ _id: id }, { $set: { generatedForDate: new Date(Date.now() - 86400000) } });
};

const generatedRides = async (templateId) => {
  const Ride = require("../models/Ride");
  return Ride.find({ recurringRef: templateId });
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
  check("id card recorded on create", typeof r.body?.data?.studentIdCard === "string" && r.body.data.studentIdCard.startsWith("https://"));
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

  const noCardToken = jwt.sign({ id: "nocard", universityEmail: "nocard@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${noCardToken}` },
    body: createFormData(VALID_PROFILE, { withCard: false }),
  });
  check("create without id card -> 400", r.status === 400, JSON.stringify(r.body));
  check("card required message", r.body?.message === "University ID card is required");

  const noGuardianToken = jwt.sign({ id: "noguardian", universityEmail: "noguardian@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${noGuardianToken}` },
    body: createFormData({ ...VALID_PROFILE, localGuardian: undefined }),
  });
  check("create without local guardian -> 201", r.status === 201, JSON.stringify(r.body));
  check("profileCompleted true without guardian", r.body?.data?.profileCompleted === true);
  check("guardian not persisted", r.body?.data?.localGuardian === undefined);

  r = await request("POST", "/students/profile", { body: createFormData() });
  check("duplicate create -> 409", r.status === 409);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, phone: "not-a-phone" }) });
  check("invalid phone -> 400", r.status === 400);
  check("validation error shape", Array.isArray(r.body?.errors) && r.body.errors.length > 0);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, phone: "1234567890" }) });
  check("10-digit fake phone -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, phone: "01123456789" }) });
  check("invalid operator prefix (011...) -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, phone: "017123456789" }) });
  check("too many digits (12) -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, emergencyContact: { name: "", relation: "", phone: "" } }) });
  check("empty emergency contact -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, studentId: "1234" }) });
  check("short student id -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, studentId: "20101234ABC" }) });
  check("alphanumeric student id -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, dateOfBirth: "2030-01-01" }) });
  check("future date of birth -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, dateOfBirth: "not-a-date" }) });
  check("invalid date of birth -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, studentNid: "20009999123456789" }) });
  check("student NID year mismatch with date of birth -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, studentNid: "12345" }) });
  check("short student NID -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, passport: "NOTAPASSPORT" }) });
  check("invalid passport -> 400", r.status === 400);

  const passportToken = jwt.sign({ id: "passportuser", universityEmail: "passport@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${passportToken}` },
    body: createFormData({ ...VALID_PROFILE, passport: "ab1234567" }),
  });
  check("lowercase passport accepted -> 201", r.status === 201);
  check("passport stored uppercase", r.body?.data?.passport === "AB1234567");

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, parentInfo: { ...VALID_PROFILE.parentInfo, fatherPhone: "" } }) });
  check("missing father phone -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, localGuardian: { ...VALID_PROFILE.localGuardian, nid: "12345" } }) });
  check("short local guardian NID -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, localGuardian: { ...VALID_PROFILE.localGuardian, nid: "1234567890ABC" } }) });
  check("alphanumeric local guardian NID -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, localGuardian: { ...VALID_PROFILE.localGuardian, nid: "20000412123456789" } }) });
  check("NID year mismatch with date of birth -> 400", r.status === 400);

  r = await request("POST", "/students/profile", { body: createFormData({ ...VALID_PROFILE, localGuardian: { ...VALID_PROFILE.localGuardian, dateOfBirth: "2030-01-01" } }) });
  check("future local guardian date of birth -> 400", r.status === 400);

  console.log("\n--- Read own profile ---");
  r = await request("GET", "/students/profile/me");
  check("get own profile -> 200", r.status === 200);
  check("own profile includes phone", r.body?.data?.phone === VALID_PROFILE.phone);

  console.log("\n--- Update ---");
  r = await request("PUT", "/students/profile", { body: { ...VALID_PROFILE, year: "4th Year", name: "Anisha R." } });
  check("update profile -> 200", r.status === 200);
  check("update persisted", r.body?.data?.year === "4th Year");
  check("profileCompleted recomputed on update", r.body?.data?.profileCompleted === true);

  r = await request("PUT", "/students/profile", { body: { ...VALID_PROFILE, name: "Anisha R.", localGuardian: { name: "Partial Only" } } });
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
  check("photo path recorded", typeof photoPath === "string" && photoPath.startsWith("https://"));
  const served = await fetch(photoPath);
  check("photo reachable via Cloudinary URL", served.status === 200);
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

  console.log("\n--- ID card upload ---");
  fd = new FormData();
  fd.append("studentIdCard", new Blob([pngBuffer()], { type: "image/png" }), "idcard.png");
  r = await request("POST", "/students/profile/idcard", { body: fd });
  check("upload id card -> 200", r.status === 200, JSON.stringify(r.body));
  check("verification status pending", r.body?.data?.idVerificationStatus === "pending");
  check("idVerified false while pending", r.body?.data?.idVerified === false);
  const idCardPath = r.body?.data?.studentIdCard;
  check("id card path recorded", typeof idCardPath === "string" && idCardPath.startsWith("https://"));
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
  r = await request("GET", "/students/profile/me");
  check("student access restored after unban -> 200", r.status === 200);
  r = await request("PUT", "/admin/users/000000000000000000000000/ban", { headers: adminAuth, body: { reason: "x" } });
  check("ban unknown student -> 404", r.status === 404);

  console.log("\n--- Non-existent profile behaviour ---");
  const otherToken = jwt.sign({ id: "other", universityEmail: "nobody@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await fetch(`${BASE}/students/profile/me`, { headers: { Authorization: `Bearer ${otherToken}` } });
  check("me for new user -> 404", r.status === 404);
  r = await request("PUT", "/students/profile", { headers: { Authorization: `Bearer ${otherToken}` }, body: VALID_PROFILE });
  check("update for missing profile -> 404", r.status === 404);
  r = await request("DELETE", "/students/profile/photo", { headers: { Authorization: `Bearer ${otherToken}` } });
  check("delete photo for missing profile -> 404", r.status === 404);

  console.log("\n--- Account deletion ---");
  let fd2 = new FormData();
  fd2.append("profilePhoto", new Blob([pngBuffer()], { type: "image/png" }), "card.png");
  r = await request("POST", "/students/profile/photo", { body: fd2 });
  check("photo uploaded before delete", r.status === 200, JSON.stringify(r.body));
  const delPhoto = r.body?.data?.profilePhoto;
  r = await request("DELETE", "/students/profile");
  check("delete account -> 200", r.status === 200, JSON.stringify(r.body));
  check("account photo removed from cloud", typeof delPhoto === "string" && delPhoto.startsWith("https://"));
  r = await request("GET", "/students/profile/me");
  check("me after delete -> 404", r.status === 404);
  r = await request("POST", "/students/profile", { body: createFormData() });
  check("recreate after delete -> 201", r.status === 201);
  const recreatedStudentId = r.body?.data?._id;
  check("recreated profile starts fresh (no photo)", r.body?.data?.profilePhoto === null);
  check("recreated profile is pending again", r.body?.data?.idVerificationStatus === "pending");

  console.log("\n--- Rides: cancel request & cancel ride ---");
  const riderToken = jwt.sign({ id: "rider", universityEmail: "rider@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${riderToken}` },
    body: createFormData({ ...VALID_PROFILE, studentId: "20108888", name: "Rider Student", studentNid: "20030514987654321", phone: "+8801722000000" }),
  });
  check("rider profile created -> 201", r.status === 201, JSON.stringify(r.body));
  const riderStudentId = r.body?.data?._id;
  const riderAuth = { Authorization: `Bearer ${riderToken}` };

  r = await request("POST", "/rides", { body: { pickup: "Mirpur 10", dropoff: "BracU", departureTime: "09:00", seats: 3 } });
  check("unverified user blocked from rides -> 403", r.status === 403);
  check("verification required message", typeof r.body?.message === "string" && r.body.message.includes("verified"));

  r = await request("PUT", `/admin/verifications/${recreatedStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  check("re-approve main user -> 200", r.status === 200);
  r = await request("PUT", `/admin/verifications/${riderStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  check("approve rider -> 200", r.status === 200);

  r = await request("POST", "/rides", { body: { pickup: "Mirpur 10", dropoff: "BracU", departureTime: "09:00", seats: 3 } });
  check("create ride -> 201", r.status === 201, JSON.stringify(r.body));
  const rideId = r.body?.data?._id;

  r = await request("POST", `/rides/${rideId}/requests`, { headers: riderAuth });
  check("rider requests a seat -> 201", r.status === 201, JSON.stringify(r.body));
  const requestId = r.body?.data?._id;

  r = await request("DELETE", `/rides/${rideId}/requests/${requestId}`, { headers: auth });
  check("poster cannot cancel the rider's request -> 403", r.status === 403);

  r = await request("DELETE", `/rides/${rideId}/requests/${requestId}`, { headers: riderAuth, body: {} });
  check("pending cancel without reason -> 200", r.status === 200, JSON.stringify(r.body));
  check("no reason stored for pending cancel", r.body?.data?.cancelReason === null);
  check("request status cancelled", r.body?.data?.status === "cancelled");

  r = await request("DELETE", `/rides/${rideId}/requests/${requestId}`, { headers: riderAuth, body: { reason: "Again" } });
  check("cancelling the request again -> 400", r.status === 400);

  r = await request("DELETE", `/rides/${rideId}`, { headers: riderAuth });
  check("rider cannot cancel the ride -> 403", r.status === 403);

  r = await request("POST", `/rides/${rideId}/requests`, { headers: riderAuth });
  check("re-request after cancel -> 201", r.status === 201, JSON.stringify(r.body));

  r = await request("PUT", `/rides/${rideId}/requests/${requestId}`, { body: { decision: "accepted" } });
  check("poster accepts request -> 200", r.status === 200, JSON.stringify(r.body));

  r = await request("DELETE", `/rides/${rideId}/requests/${requestId}`, { headers: riderAuth, body: {} });
  check("accepted cancel without reason -> 400", r.status === 400);
  check("accepted reason required message", r.body?.message === "Cancellation reason is required");

  r = await request("DELETE", `/rides/${rideId}/requests/${requestId}`, { headers: riderAuth, body: { reason: "No longer needed" } });
  check("rider cancels an accepted request -> 200", r.status === 200, JSON.stringify(r.body));
  check("accepted request status cancelled", r.body?.data?.status === "cancelled");
  check("accepted cancel reason stored", r.body?.data?.cancelReason === "No longer needed");

  r = await request("GET", "/rides/mine");
  check("poster sees cancellation reason", r.body?.data?.posted?.[0]?.requests?.some((x) => x.status === "cancelled" && x.cancelReason === "No longer needed"));

  r = await request("DELETE", `/rides/${rideId}/requests/${requestId}`, { headers: riderAuth, body: { reason: "Again" } });
  check("cancelling accepted request again -> 400", r.status === 400);

  r = await request("DELETE", `/rides/${rideId}`, { headers: auth });
  check("poster cancels ride -> 200", r.status === 200, JSON.stringify(r.body));
  check("ride status cancelled", r.body?.data?.status === "cancelled");

  r = await request("DELETE", `/rides/${rideId}`, { headers: auth });
  check("cancelling the ride again -> 400", r.status === 400);

  r = await request("GET", "/rides/mine");
  check("cancelled posted ride hidden from mine", !r.body?.data?.posted?.some((x) => x._id === rideId));
  r = await request("GET", "/rides/mine", { headers: riderAuth });
  check("auto-cancelled request hidden from mine", !r.body?.data?.requested?.some((x) => x.ride?._id === rideId));
  r = await request("GET", "/rides");
  check("cancelled ride not listed in browse", !r.body?.data?.some((x) => x._id === rideId));

  console.log("\n--- Rides: settle payment (mock) ---");
  const strangerToken = jwt.sign({ id: "stranger", universityEmail: "stranger@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${strangerToken}` },
    body: createFormData({ ...VALID_PROFILE, studentId: "20107777", name: "Stranger Student", studentNid: "20030514999999999", phone: "+8801733000000" }),
  });
  check("stranger profile created -> 201", r.status === 201, JSON.stringify(r.body));
  const strangerStudentId = r.body?.data?._id;
  const strangerAuth = { Authorization: `Bearer ${strangerToken}` };
  r = await request("PUT", `/admin/verifications/${strangerStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  check("approve stranger -> 200", r.status === 200);

  r = await request("POST", "/rides", { body: { pickup: "Mirpur 10", dropoff: "BracU", departureTime: "09:00", seats: 3 } });
  check("create ride for settlement -> 201", r.status === 201, JSON.stringify(r.body));
  const settleRideId = r.body?.data?._id;

  r = await request("POST", `/rides/${settleRideId}/requests`, { headers: riderAuth });
  check("rider requests a seat -> 201", r.status === 201, JSON.stringify(r.body));
  const settleRequestId = r.body?.data?._id;
  check("payment default PENDING", r.body?.data?.paymentStatus === "PENDING");

  r = await request("PUT", `/rides/${settleRideId}/requests/${settleRequestId}/settle-payment`, { headers: strangerAuth });
  check("stranger cannot settle payment -> 403", r.status === 403);

  r = await request("PUT", `/rides/${settleRideId}/requests/${settleRequestId}/settle-payment`, { headers: riderAuth });
  check("settling a pending request -> 400", r.status === 400);

  r = await request("PUT", `/rides/${settleRideId}/requests/${settleRequestId}`, { body: { decision: "accepted" } });
  check("poster accepts request -> 200", r.status === 200, JSON.stringify(r.body));

  r = await request("PUT", `/rides/${settleRideId}/requests/${settleRequestId}/settle-payment`, { headers: strangerAuth });
  check("stranger blocked after acceptance -> 403", r.status === 403);

  r = await request("PUT", `/rides/${settleRideId}/requests/${settleRequestId}/settle-payment`, { headers: riderAuth });
  check("rider settles payment -> 200", r.status === 200, JSON.stringify(r.body));
  check("paymentStatus SETTLED", r.body?.data?.paymentStatus === "SETTLED");
  check("settledBy is RIDER", r.body?.data?.settledBy === "RIDER");
  check("settledByUserId is the rider", String(r.body?.data?.settledByUserId) === String(riderStudentId));
  check("settledAt recorded", r.body?.data?.settledAt != null);
  check("settledManually true", r.body?.data?.settledManually === true);

  r = await request("PUT", `/rides/${settleRideId}/requests/${settleRequestId}/settle-payment`, { headers: riderAuth });
  check("double settlement -> 400", r.status === 400);

  r = await request("POST", "/rides", { body: { pickup: "Gulshan", dropoff: "BracU", departureTime: "10:00", seats: 2 } });
  check("create second ride for settlement -> 201", r.status === 201, JSON.stringify(r.body));
  const settleRide2Id = r.body?.data?._id;

  r = await request("POST", `/rides/${settleRide2Id}/requests`, { headers: riderAuth });
  check("rider requests seat on second ride -> 201", r.status === 201, JSON.stringify(r.body));
  const settleRequest2Id = r.body?.data?._id;

  r = await request("PUT", `/rides/${settleRide2Id}/requests/${settleRequest2Id}`, { body: { decision: "accepted" } });
  check("poster accepts second request -> 200", r.status === 200, JSON.stringify(r.body));

  r = await request("PUT", `/rides/${settleRide2Id}/requests/${settleRequest2Id}/settle-payment`, { headers: auth });
  check("poster settles payment -> 200", r.status === 200, JSON.stringify(r.body));
  check("settledBy is RIDE_POSTER", r.body?.data?.settledBy === "RIDE_POSTER");
  check("settledByUserId is the poster", String(r.body?.data?.settledByUserId) === String(recreatedStudentId));
  check("settledManually true", r.body?.data?.settledManually === true);

  r = await request("GET", "/rides/mine");
  check("posted ride shows settled payment", r.body?.data?.posted?.some((x) => x._id === settleRideId && x.requests?.some((y) => y._id === settleRequestId && y.paymentStatus === "SETTLED" && y.settledBy === "RIDER" && y.settledManually === true)));
  r = await request("GET", "/rides/mine", { headers: riderAuth });
  check("requested ride shows settled payment", r.body?.data?.requested?.some((x) => x._id === settleRequest2Id && x.paymentStatus === "SETTLED" && x.settledBy === "RIDE_POSTER" && x.settledManually === true));

  r = await request("DELETE", `/rides/${settleRide2Id}/requests/${settleRequest2Id}`, { headers: riderAuth, body: { reason: "Plans changed" } });
  check("rider cancels a settled request -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("POST", `/rides/${settleRide2Id}/requests`, { headers: riderAuth });
  check("re-request after settle resets payment to PENDING", r.status === 201 && r.body?.data?.paymentStatus === "PENDING", JSON.stringify(r.body));
  check("re-request clears settlement info", r.body?.data?.settledBy === null && r.body?.data?.settledByUserId === null && r.body?.data?.settledAt === null && r.body?.data?.settledManually === false);

  console.log("\n--- Payment requests ---");
  const payUserToken = jwt.sign({ id: "payuser", universityEmail: "payuser@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  r = await request("POST", "/students/profile", {
    headers: { Authorization: `Bearer ${payUserToken}` },
    body: createFormData({ ...VALID_PROFILE, studentId: "20101235", name: "Pay User", studentNid: "20030514123456788", phone: "+8801744000000" }),
  });
  check("unverified payment user profile created -> 201", r.status === 201, JSON.stringify(r.body));
  const payUserId = r.body?.data?._id;
  const payUserAuth = { Authorization: `Bearer ${payUserToken}` };
  r = await request("GET", "/payments", { headers: payUserAuth });
  check("unverified user blocked from payments -> 403", r.status === 403);
  r = await fetch(`${BASE}/payments`);
  check("no token on payments -> 401", r.status === 401);

  r = await request("GET", "/payments/students?search=Rider");
  check("search students finds rider", r.body?.data?.some((s) => String(s._id) === String(riderStudentId)));
  r = await request("GET", "/payments/students?search=zzznomatch");
  check("search students no match -> empty", Array.isArray(r.body?.data) && r.body.data.length === 0);

  r = await request("POST", "/payments", { body: { payer: "not-an-id", amountDue: 10000 } });
  check("invalid payer id -> 400", r.status === 400);
  r = await request("POST", "/payments", { body: { payer: "000000000000000000000000", amountDue: 10000 } });
  check("unknown payer -> 404", r.status === 404);
  r = await request("POST", "/payments", { body: { payer: riderStudentId, amountDue: 0 } });
  check("zero amount -> 400", r.status === 400);
  r = await request("POST", "/payments", { body: { payer: riderStudentId, amountDue: -50 } });
  check("negative amount -> 400", r.status === 400);
  r = await request("POST", "/payments", { body: { payer: recreatedStudentId, amountDue: 500 } });
  check("cannot request payment from yourself -> 400", r.status === 400);

  r = await request("POST", "/payments", { body: { payer: riderStudentId, amountDue: 10000, description: "Ride fare share", dueDate: futureKey(7) } });
  check("create payment request -> 201", r.status === 201, JSON.stringify(r.body));
  const paymentRequestId = r.body?.data?._id;
  check("unique request code created", typeof r.body?.data?.requestCode === "string" && r.body.data.requestCode.startsWith("PR-"));
  check("new request status UNPAID", r.body?.data?.status === "UNPAID");
  check("new request summary", r.body?.data?.summary?.amountDue === 10000 && r.body?.data?.summary?.amountPaid === 0 && r.body?.data?.summary?.remaining === 10000 && r.body?.data?.summary?.status === "UNPAID");
  check("due date persisted", new Date(r.body?.data?.dueDate).toISOString().slice(0, 10) === futureKey(7));

  r = await request("GET", "/payments");
  check("list as requester -> 200", r.status === 200);
  check("requester list shows request with summary", r.body?.data?.some((x) => x._id === paymentRequestId && x.role === "requester" && x.counterpart?._id === riderStudentId && x.summary?.status === "UNPAID"));
  r = await request("GET", "/payments", { headers: riderAuth });
  check("list as payer -> 200", r.status === 200);
  check("payer list shows request with role payer", r.body?.data?.some((x) => x._id === paymentRequestId && x.role === "payer"));
  r = await request("GET", `/payments/${paymentRequestId}`, { headers: strangerAuth });
  check("stranger cannot view payment request -> 403", r.status === 403);

  r = await request("POST", `/payments/${paymentRequestId}/payments`, { headers: strangerAuth, body: { method: "MANUAL", amount: 100 } });
  check("stranger cannot record payment -> 403", r.status === 403);
  r = await request("POST", `/payments/${paymentRequestId}/payments`, { headers: riderAuth, body: { method: "CASH", amount: 100 } });
  check("invalid method -> 400", r.status === 400);
  r = await request("POST", `/payments/${paymentRequestId}/payments`, { headers: riderAuth, body: { method: "MANUAL", amount: "abc" } });
  check("invalid amount -> 400", r.status === 400);

  r = await request("POST", `/payments/${paymentRequestId}/payments`, { headers: riderAuth, body: { method: "MANUAL", amount: 6000, reference: "CASH-001" } });
  check("manual payment recorded -> 201", r.status === 201, JSON.stringify(r.body));
  const manualPaymentId = r.body?.data?.payment?._id;
  check("manual payment pending verification", r.body?.data?.payment?.status === "PENDING_VERIFICATION");
  check("pending manual payment not counted yet", r.body?.data?.summary?.amountPaid === 0 && r.body?.data?.summary?.remaining === 10000 && r.body?.data?.summary?.status === "UNPAID");

  r = await request("POST", `/payments/${paymentRequestId}/payments`, { headers: riderAuth, body: { method: "MANUAL", amount: 5000 } });
  check("overpayment while pending -> 400", r.status === 400);
  r = await request("PUT", `/payments/${paymentRequestId}/payments/000000000000000000000000`, { body: { decision: "verified" } });
  check("verify unknown payment -> 404", r.status === 404);
  r = await request("PUT", `/payments/${paymentRequestId}/payments/${manualPaymentId}`, { headers: strangerAuth, body: { decision: "verified" } });
  check("stranger cannot verify manual payment -> 403", r.status === 403);
  r = await request("PUT", `/payments/${paymentRequestId}/payments/${manualPaymentId}`, { headers: riderAuth, body: { decision: "verified" } });
  check("payer cannot verify manual payment -> 403", r.status === 403);
  r = await request("PUT", `/payments/${paymentRequestId}/payments/${manualPaymentId}`, { body: { decision: "bogus" } });
  check("invalid verify decision -> 400", r.status === 400);

  r = await request("PUT", `/payments/${paymentRequestId}/payments/${manualPaymentId}`, { body: { decision: "verified" } });
  check("requester verifies manual payment -> 200", r.status === 200, JSON.stringify(r.body));
  check("manual payment verified", r.body?.data?.payment?.status === "VERIFIED");
  check("summary partially paid", r.body?.data?.summary?.amountPaid === 6000 && r.body?.data?.summary?.remaining === 4000 && r.body?.data?.summary?.status === "PARTIALLY_PAID");
  r = await request("PUT", `/payments/${paymentRequestId}/payments/${manualPaymentId}`, { body: { decision: "rejected" } });
  check("verifying an already verified payment -> 400", r.status === 400);

  r = await request("POST", `/payments/${paymentRequestId}/payments`, { headers: riderAuth, body: { method: "MANUAL", amount: 4000, reference: "CASH-002" } });
  check("second manual payment recorded -> 201", r.status === 201, JSON.stringify(r.body));
  const secondManualPaymentId = r.body?.data?.payment?._id;
  r = await request("PUT", `/payments/${paymentRequestId}/payments/${secondManualPaymentId}`, { body: { decision: "rejected" } });
  check("requester rejects manual payment -> 200", r.status === 200);
  check("rejected payment not counted", r.body?.data?.summary?.amountPaid === 6000 && r.body?.data?.summary?.remaining === 4000 && r.body?.data?.summary?.status === "PARTIALLY_PAID");

  r = await request("POST", `/payments/${paymentRequestId}/payments`, { headers: riderAuth, body: { method: "BKASH", amount: 4000 } });
  check("bkash payment recorded -> 201", r.status === 201, JSON.stringify(r.body));
  const bkashPaymentId = r.body?.data?.payment?._id;
  check("bkash payment completed", r.body?.data?.payment?.method === "BKASH" && r.body?.data?.payment?.status === "COMPLETED");
  check("bkash reference generated", typeof r.body?.data?.payment?.reference === "string" && r.body.data.payment.reference.startsWith("BKASH-"));
  check("request fully paid", r.body?.data?.summary?.amountPaid === 10000 && r.body?.data?.summary?.remaining === 0 && r.body?.data?.summary?.status === "PAID");

  r = await request("PUT", `/payments/${paymentRequestId}/payments/${bkashPaymentId}`, { body: { decision: "rejected" } });
  check("cannot verify a bkash payment -> 400", r.status === 400);
  r = await request("POST", `/payments/${paymentRequestId}/payments`, { headers: riderAuth, body: { method: "MANUAL", amount: 100 } });
  check("payment after fully paid -> 400", r.status === 400);

  r = await request("GET", `/payments/${paymentRequestId}`);
  check("detail shows full payment history", r.body?.data?.payments?.length === 3, JSON.stringify(r.body));
  check("detail role requester", r.body?.data?.role === "requester");
  check("detail status PAID", r.body?.data?.status === "PAID");
  check("detail summary final", r.body?.data?.summary?.amountPaid === 10000 && r.body?.data?.summary?.remaining === 0 && r.body?.data?.summary?.status === "PAID");
  r = await request("GET", `/payments/${paymentRequestId}`, { headers: riderAuth });
  check("payer sees payment details -> 200", r.status === 200 && r.body?.data?.role === "payer");
  r = await request("GET", "/payments?role=requester");
  check("filter requester role", (r.body?.data || []).some((x) => x._id === paymentRequestId && x.role === "requester"));
  r = await request("GET", "/payments?role=payer", { headers: riderAuth });
  check("filter payer role", (r.body?.data || []).some((x) => x._id === paymentRequestId && x.role === "payer"));

  console.log("\n--- Recurring offers: skip & restore ---");
  r = await fetch(`${BASE}/recurring/000000000000000000000000/skips`);
  check("no token on skips -> 401", r.status === 401);

  r = await request("POST", "/rides", { body: { pickup: "Mirpur 10", dropoff: "BracU", departureTime: "09:00", seats: 3 } });
  const recurRideId = r.body?.data?._id;
  r = await request("POST", `/recurring/from/${recurRideId}`);
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
  r = await request("POST", "/recurring/generate", { headers: adminAuth });
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
  r = await request("POST", "/recurring/generate", { headers: adminAuth });
  check("restored template generates again", Number(r.body?.data?.generated) >= 1);
  const ridesAfter = await generatedRides(templateId);
  check("occurrence created with template link", ridesAfter.length >= 1);
  check("generated occurrence is open", ridesAfter.every((ride) => ride.status === "open"));

  await backdateTemplate(secondTemplateId);
  r = await request("POST", "/recurring/generate", { headers: adminAuth });
  check("second template generates a ride -> 200", r.status === 200, JSON.stringify(r.body));
  const published = await generatedRides(secondTemplateId);
  check("second template has a published ride", published.some((ride) => ride.status === "open"));
  r = await request("POST", `/recurring/${secondTemplateId}/skips`, { body: { date: today } });
  check("skip today's published occurrence -> 201", r.status === 201, JSON.stringify(r.body));
  const afterCancel = await generatedRides(secondTemplateId);
  check("published occurrence cancelled without touching the series", afterCancel.every((ride) => ride.status === "cancelled"));
  r = await request("GET", "/recurring/mine");
  check("template still exists and stays active", (r.body?.data || []).some((t) => t._id === secondTemplateId && t.status === "active"));

  console.log("\n--- Ride payments: charge, dues, transactions, late fee, netting ---");
  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Dhanmondi", departureTime: "09:30", seats: 3, charge: 300 } });
  check("create ride with charge -> 201", r.status === 201, JSON.stringify(r.body));
  check("charge persisted on ride", r.body?.data?.charge === 300);
  const chargeRideId = r.body?.data?._id;

  r = await request("POST", `/rides/${chargeRideId}/requests`, { headers: riderAuth });
  check("rider requests seat on charged ride -> 201", r.status === 201, JSON.stringify(r.body));
  const chargeRequestId = r.body?.data?._id;
  r = await request("PUT", `/rides/${chargeRideId}/requests/${chargeRequestId}`, { body: { decision: "accepted" } });
  check("poster accepts rider -> 200", r.status === 200);

  r = await request("GET", `/ride-payments/ride/${chargeRideId}`);
  check("ride payment management -> 200", r.status === 200, JSON.stringify(r.body));
  check("charge per rider = full charge (not divided)", r.body?.data?.chargePerRider === 300);
  check("expected 300 (1 seat x 300)", r.body?.data?.expected === 300);
  check("received 0 initially", r.body?.data?.received === 0);
  const chargePaymentId = r.body?.data?.payments?.[0]?._id;
  check("payment auto-created for accepted rider", typeof chargePaymentId === "string");
  check("payment status PENDING", r.body?.data?.payments?.[0]?.status === "PENDING");

  r = await request("POST", "/rides", { body: { pickup: "BracU", dropoff: "Uttara", departureTime: "18:00", seats: 1, charge: 100 } });
  const oneSeatRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${oneSeatRideId}/requests`, { headers: strangerAuth });
  const oneSeatReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${oneSeatRideId}/requests/${oneSeatReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${oneSeatRideId}`);
  check("one-seat charge not divided (100)", r.body?.data?.chargePerRider === 100);

  r = await request("POST", "/rides", { body: { pickup: "X", dropoff: "Y", departureTime: "07:00", seats: 2 } });
  const noChargeRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${noChargeRideId}/requests`, { headers: riderAuth });
  const noChargeReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${noChargeRideId}/requests/${noChargeReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${noChargeRideId}`);
  check("ride without charge creates no payments", (r.body?.data?.payments || []).length === 0);

  r = await request("POST", `/ride-payments/${chargePaymentId}/manual`, { headers: strangerAuth, body: { amount: 150 } });
  check("stranger cannot record payment -> 403", r.status === 403);
  r = await request("POST", `/ride-payments/${chargePaymentId}/manual`, { headers: riderAuth, body: { amount: 350 } });
  check("overpayment rejected -> 400", r.status === 400);

  r = await request("POST", `/ride-payments/${chargePaymentId}/manual`, { headers: riderAuth, body: { amount: 150, reference: "CASH-RIDER-01" } });
  check("rider manual payment -> 201", r.status === 201, JSON.stringify(r.body));
  check("partial payment balances", r.body?.data?.payment?.amountPaid === 150 && r.body?.data?.payment?.remainingAmount === 150);
  check("partial status", r.body?.data?.payment?.status === "PARTIAL");
  const firstTxId = r.body?.data?.transaction?._id;
  check("transaction created for manual payment", typeof firstTxId === "string");
  check("manual provider reference stored", r.body?.data?.transaction?.providerTransactionId === "CASH-RIDER-01");

  r = await request("POST", `/ride-payments/${chargePaymentId}/manual`, { headers: riderAuth, body: { amount: 150, reference: "CASH-RIDER-02" } });
  check("second manual payment -> 201", r.status === 201, JSON.stringify(r.body));
  check("full payment balances", r.body?.data?.payment?.amountPaid === 300 && r.body?.data?.payment?.remainingAmount === 0);
  check("full status PAID", r.body?.data?.payment?.status === "PAID");
  r = await request("POST", `/ride-payments/${chargePaymentId}/manual-status`, { headers: riderAuth, body: { status: "PENDING" } });
  check("paid payment cannot be flipped via manual status -> 400", r.status === 400);
  check("second transaction is distinct", r.body?.data?.transaction?._id !== firstTxId);

  r = await request("POST", `/ride-payments/${chargePaymentId}/manual`, { headers: riderAuth, body: { amount: 10 } });
  check("payment after fully paid -> 400", r.status === 400);

  r = await request("GET", "/ride-payments/transactions");
  check("poster transaction history -> 200", r.status === 200);
  check("poster sees received direction", (r.body?.data || []).some((t) => t._id === firstTxId && t.direction === "received"));
  check("poster totals received = 300", r.body?.totals?.received === 300 && r.body?.totals?.paid === 0);
  r = await request("GET", "/ride-payments/transactions", { headers: riderAuth });
  check("rider sees paid direction", (r.body?.data || []).some((t) => t._id === firstTxId && t.direction === "paid"));
  check("rider totals paid = 300", r.body?.totals?.paid === 300);
  check("transaction history persists both entries", (r.body?.data || []).filter((t) => t.ride?._id === chargeRideId).length === 2);

  r = await request("GET", "/ride-payments/transactions?direction=received");
  check("filter received", (r.body?.data || []).length > 0 && (r.body?.data || []).every((t) => t.direction === "received"));
  r = await request("GET", "/ride-payments/transactions?direction=paid", { headers: riderAuth });
  check("filter paid", (r.body?.data || []).length > 0 && (r.body?.data || []).every((t) => t.direction === "paid"));
  r = await request("GET", "/ride-payments/transactions?method=manual", { headers: riderAuth });
  check("filter manual", (r.body?.data || []).length > 0 && (r.body?.data || []).every((t) => t.method === "MANUAL"));
  r = await request("GET", `/ride-payments/transactions?ride=${chargeRideId}`);
  check("filter by ride", (r.body?.data || []).length === 2);
  r = await request("GET", `/ride-payments/transactions?person=${riderStudentId}`);
  check("filter by person", (r.body?.data || []).some((t) => String(t.counterparty?._id) === String(riderStudentId)));

  r = await request("GET", "/ride-payments/transactions?direction=paid", { headers: riderAuth });
  const firstTxNumber = (r.body?.data || []).find((t) => t._id === firstTxId)?.transactionId;
  r = await request("GET", `/ride-payments/transactions?search=${firstTxNumber}`, { headers: riderAuth });
  check("search by transaction id", (r.body?.data || []).some((t) => t.transactionId === firstTxNumber));

  r = await request("GET", `/ride-payments/ride/${oneSeatRideId}`);
  const oneSeatBkashPaymentId = r.body?.data?.payments?.[0]?._id;
  r = await request("POST", `/ride-payments/${oneSeatBkashPaymentId}/bkash/initiate`, { headers: strangerAuth, body: { amount: 100 } });
  check("initiate bkash -> 200", r.status === 200, JSON.stringify(r.body));
  const paymentID = r.body?.data?.paymentID;
  check("payment id returned", typeof paymentID === "string" && paymentID.startsWith("mock-"));
  r = await request("POST", `/ride-payments/${oneSeatBkashPaymentId}/bkash/verify`, { headers: strangerAuth, body: { paymentID, amount: 100 } });
  check("verify bkash -> 201", r.status === 201, JSON.stringify(r.body));
  check("bkash payment applied", r.body?.data?.payment?.amountPaid === 100 && r.body?.data?.payment?.status === "PAID");
  check("bkash transaction method", r.body?.data?.transaction?.method === "BKASH");
  check("provider transaction id recorded", typeof r.body?.data?.transaction?.providerTransactionId === "string" && r.body.data.transaction.providerTransactionId.startsWith("BKASH-"));

  r = await request("POST", `/ride-payments/${oneSeatBkashPaymentId}/bkash/verify`, { headers: strangerAuth, body: { paymentID, amount: 100 } });
  check("duplicate bkash verify -> already recorded", r.status === 200 && r.body?.data?.alreadyRecorded === true);
  r = await request("GET", `/ride-payments/${oneSeatBkashPaymentId}`, { headers: strangerAuth });
  check("no double-count after duplicate verify", r.body?.data?.amountPaid === 100);

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Bashundhara", departureTime: "17:00", seats: 1, charge: 200 } });
  const cbRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${cbRideId}/requests`, { headers: strangerAuth });
  const cbReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${cbRideId}/requests/${cbReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${cbRideId}`);
  const cbPaymentId = r.body?.data?.payments?.[0]?._id;
  r = await request("POST", `/ride-payments/${cbPaymentId}/bkash/initiate`, { headers: strangerAuth, body: { amount: 200 } });
  const cbPaymentID = r.body?.data?.paymentID;
  const cbBody = { paymentID: cbPaymentID, amount: 200, status: "Completed" };
  r = await request("POST", "/ride-payments/bkash/callback", { headers: strangerAuth, body: cbBody });
  check("bkash callback processed -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("POST", "/ride-payments/bkash/callback", { headers: strangerAuth, body: cbBody });
  check("duplicate bkash callback -> already recorded", r.status === 200 && r.body?.data?.alreadyRecorded === true);
  r = await request("GET", `/ride-payments/${cbPaymentId}`, { headers: strangerAuth });
  check("single financial record after duplicate callback", r.body?.data?.amountPaid === 200);
  check("single transaction after duplicate callback", (r.body?.data?.transactions || []).length === 1);

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Dhanmondi", departureTime: "18:00", seats: 1, charge: 150 } });
  const reinitRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${reinitRideId}/requests`, { headers: strangerAuth });
  const reinitReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${reinitRideId}/requests/${reinitReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${reinitRideId}`);
  const reinitPaymentId = r.body?.data?.payments?.[0]?._id;
  r = await request("POST", `/ride-payments/${reinitPaymentId}/bkash/initiate`, { headers: strangerAuth, body: { amount: 150 } });
  const reinitID1 = r.body?.data?.paymentID;
  check("bkash initiate returns a payment id", typeof reinitID1 === "string" && reinitID1.length > 0);
  r = await request("POST", `/ride-payments/${reinitPaymentId}/bkash/initiate`, { headers: strangerAuth, body: { amount: 150 } });
  check("second initiate reuses the pending payment id", r.status === 200 && r.body?.data?.paymentID === reinitID1);
  r = await request("POST", "/ride-payments/bkash/callback", { headers: strangerAuth, body: { paymentID: reinitID1, amount: 150, status: "Completed" } });
  check("callback for the first payment id still records -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("GET", `/ride-payments/${reinitPaymentId}`, { headers: strangerAuth });
  check("no payment lost after repeated initiate", r.body?.data?.amountPaid === 150 && r.body?.data?.status === "PAID");

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Mirpur", departureTime: "18:15", seats: 1, charge: 120 } });
  const misapplyRideB = r.body?.data?._id;
  r = await request("POST", `/rides/${misapplyRideB}/requests`, { headers: strangerAuth });
  const misapplyReqB = r.body?.data?._id;
  r = await request("PUT", `/rides/${misapplyRideB}/requests/${misapplyReqB}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${misapplyRideB}`);
  const misapplyPaymentB = r.body?.data?.payments?.[0]?._id;
  r = await request("POST", `/ride-payments/${misapplyPaymentB}/bkash/initiate`, { headers: strangerAuth, body: { amount: 120 } });
  const pidB = r.body?.data?.paymentID;
  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Motijheel", departureTime: "18:30", seats: 1, charge: 120 } });
  const misapplyRideC = r.body?.data?._id;
  r = await request("POST", `/rides/${misapplyRideC}/requests`, { headers: strangerAuth });
  const misapplyReqC = r.body?.data?._id;
  r = await request("PUT", `/rides/${misapplyRideC}/requests/${misapplyReqC}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${misapplyRideC}`);
  const misapplyPaymentC = r.body?.data?.payments?.[0]?._id;
  r = await request("POST", `/ride-payments/${misapplyPaymentC}/bkash/initiate`, { headers: strangerAuth, body: { amount: 120 } });
  const pidC = r.body?.data?.paymentID;
  r = await request("POST", `/ride-payments/${misapplyPaymentB}/bkash/verify`, { headers: strangerAuth, body: { paymentID: pidC, amount: 120 } });
  check("foreign pending payment id cannot settle another bill -> 400", r.status === 400, JSON.stringify(r.body));
  r = await request("GET", `/ride-payments/${misapplyPaymentB}`, { headers: strangerAuth });
  check("misapplied payment id left the bill unchanged", r.body?.data?.amountPaid === 0 && r.body?.data?.status === "PENDING");
  r = await request("POST", `/ride-payments/${misapplyPaymentB}/bkash/verify`, { headers: strangerAuth, body: { paymentID: pidB, amount: 120 } });
  check("own pending payment id settles the bill -> 201", r.status === 201, JSON.stringify(r.body));
  r = await request("GET", `/ride-payments/${misapplyPaymentB}`, { headers: strangerAuth });
  check("bill settled with its own payment id", r.body?.data?.amountPaid === 120 && r.body?.data?.status === "PAID");
  r = await request("POST", `/ride-payments/${misapplyPaymentC}/bkash/verify`, { headers: strangerAuth, body: { paymentID: pidC, amount: 120 } });
  check("own pending payment id settles its own bill -> 201", r.status === 201, JSON.stringify(r.body));

  r = await request("POST", "/ride-payments/manual-due", { body: { receiver: riderStudentId, amount: 50 } });
  check("manual due created -> 201", r.status === 201, JSON.stringify(r.body));
  check("manual due amount", r.body?.data?.originalAmount === 50 && r.body?.data?.status === "PENDING");
  r = await request("POST", "/ride-payments/manual-due", { body: { receiver: riderStudentId, amount: 50 } });
  check("duplicate manual due -> 409", r.status === 409);

  r = await request("POST", "/ride-payments/manual-due", { headers: riderAuth, body: { receiver: recreatedStudentId, amount: 60 } });
  check("reverse manual due created -> 201", r.status === 201, JSON.stringify(r.body));

  r = await request("GET", "/ride-payments/dues");
  check("dues -> 200", r.status === 200, JSON.stringify(r.body));
  check("unequal netting: poster owed 10 by rider", r.body?.data?.owedToYou?.some((d) => String(d.counterparty._id) === String(riderStudentId) && d.amount === 10));
  check("poster owes nothing after netting", (r.body?.data?.youOwe || []).length === 0);
  check("dues net total 10", r.body?.data?.net === 10);

  r = await request("POST", "/ride-payments/manual-due", { body: { receiver: strangerStudentId, amount: 30 } });
  check("manual due (poster -> stranger) -> 201", r.status === 201);
  r = await request("POST", "/ride-payments/manual-due", { headers: strangerAuth, body: { receiver: recreatedStudentId, amount: 30 } });
  check("reciprocal manual due (stranger -> poster) -> 201", r.status === 201);
  r = await request("GET", "/ride-payments/dues");
  check("equal debts cancel (stranger not listed)", !r.body?.data?.owedToYou?.some((d) => String(d.counterparty._id) === String(strangerStudentId)) && !r.body?.data?.youOwe?.some((d) => String(d.counterparty._id) === String(strangerStudentId)));
  r = await request("GET", "/ride-payments/balances");
  check("net balances -> 200", r.status === 200, JSON.stringify(r.body));

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Gulshan", departureTime: "16:00", seats: 1, charge: 100 } });
  const lfRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${lfRideId}/requests`, { headers: riderAuth });
  const lfReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${lfRideId}/requests/${lfReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${lfRideId}`);
  const lfPaymentId = r.body?.data?.payments?.[0]?._id;
  const RidePaymentModel = require("../models/RidePayment");
  await RidePaymentModel.updateOne({ _id: lfPaymentId }, { $set: { dueDate: new Date(Date.now() - 1 * 86400000) } });
  r = await request("GET", `/ride-payments/${lfPaymentId}`, { headers: riderAuth });
  check("late fee after grace (day 4) = 50", r.body?.data?.lateFee === 50, JSON.stringify(r.body));
  check("status OVERDUE", r.body?.data?.status === "OVERDUE");
  r = await request("GET", `/ride-payments/${lfPaymentId}`, { headers: riderAuth });
  check("late fee idempotent (still 50)", r.body?.data?.lateFee === 50);
  r = await request("GET", "/ride-payments/summary", { headers: riderAuth });
  check("rider dashboard summary -> 200", r.status === 200, JSON.stringify(r.body));
  check("rider owes includes principal + late fee", r.body?.data?.youOwe === 210);

  r = await request("POST", `/ride-payments/${lfPaymentId}/mark-paid`, { body: { amount: 100, reference: "CASH-MARK-01" } });
  check("poster marks payment paid -> 201", r.status === 201, JSON.stringify(r.body));
  check("mark paid clears balance and late fee", r.body?.data?.payment?.remainingAmount === 0 && r.body?.data?.payment?.status === "PAID" && r.body?.data?.payment?.lateFee === 0);
  r = await request("GET", `/ride-payments/${lfPaymentId}`, { headers: riderAuth });
  check("late fee accrual stops after paid", r.body?.data?.lateFee === 0);
  r = await request("POST", `/ride-payments/${lfPaymentId}/mark-paid`, { headers: riderAuth });
  check("rider cannot mark as paid -> 403", r.status === 403);

  console.log("\n--- Ride payments: collectible late fee, finalization, cancel refund, webhook ---");

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "FeePay", departureTime: "16:45", seats: 1, charge: 100 } });
  const lfPayRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${lfPayRideId}/requests`, { headers: riderAuth });
  const lfPayReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${lfPayRideId}/requests/${lfPayReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${lfPayRideId}`);
  const lfPayPaymentId = r.body?.data?.payments?.[0]?._id;
  await RidePaymentModel.updateOne({ _id: lfPayPaymentId }, { $set: { dueDate: new Date(Date.now() - 1 * 86400000) } });
  r = await request("GET", `/ride-payments/${lfPayPaymentId}`, { headers: riderAuth });
  check("collectible late fee accrues (50 on 100)", r.body?.data?.lateFee === 50 && r.body?.data?.totalOutstanding === 150);
  r = await request("POST", `/ride-payments/${lfPayPaymentId}/manual`, { headers: riderAuth, body: { amount: 151 } });
  check("overpaying above total outstanding -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${lfPayPaymentId}/manual`, { headers: riderAuth, body: { amount: 150, reference: "CASH-FEE-01" } });
  check("manual payment collects principal + late fee -> 201", r.status === 201, JSON.stringify(r.body));
  check("fee split tracked on the bill", r.body?.data?.payment?.amountPaid === 100 && r.body?.data?.payment?.lateFeePaid === 50 && r.body?.data?.payment?.remainingAmount === 0 && r.body?.data?.payment?.status === "PAID" && r.body?.data?.payment?.totalOutstanding === 0);

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "FeeBkash", departureTime: "17:15", seats: 1, charge: 100 } });
  const lfBkashRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${lfBkashRideId}/requests`, { headers: strangerAuth });
  const lfBkashReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${lfBkashRideId}/requests/${lfBkashReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${lfBkashRideId}`);
  const lfBkashPaymentId = r.body?.data?.payments?.[0]?._id;
  await RidePaymentModel.updateOne({ _id: lfBkashPaymentId }, { $set: { dueDate: new Date(Date.now() - 1 * 86400000) } });
  r = await request("GET", `/ride-payments/${lfBkashPaymentId}`, { headers: strangerAuth });
  check("bkash bill shows outstanding incl fee", r.body?.data?.totalOutstanding === 150);
  r = await request("POST", `/ride-payments/${lfBkashPaymentId}/bkash/initiate`, { headers: strangerAuth, body: { amount: 151 } });
  check("bkash initiate over outstanding -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${lfBkashPaymentId}/bkash/initiate`, { headers: strangerAuth, body: { amount: 150 } });
  const lfBkashPaymentID = r.body?.data?.paymentID;
  const rawWebhookRes = await fetch(`${BASE}/ride-payments/bkash/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentID: lfBkashPaymentID, amount: 150 }),
  });
  const rawWebhookJson = await rawWebhookRes.json();
  check("webhook callback works without any auth token", rawWebhookRes.status === 200 && rawWebhookJson.success === true, JSON.stringify(rawWebhookJson));
  r = await request("GET", `/ride-payments/${lfBkashPaymentId}`, { headers: strangerAuth });
  check("bkash collects principal + fee via callback", r.body?.data?.amountPaid === 100 && r.body?.data?.lateFeePaid === 50 && r.body?.data?.status === "PAID");

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Finalize", departureTime: "17:45", seats: 1, charge: 200 } });
  const finRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${finRideId}/requests`, { headers: strangerAuth });
  const finReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${finRideId}/requests/${finReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${finRideId}`);
  const finPaymentId = r.body?.data?.payments?.[0]?._id;
  r = await request("POST", `/ride-payments/${finPaymentId}/mark-paid`, { body: { amount: 50, reference: "CASH-FINAL-01" } });
  check("owner confirm finalizes a partial payment", r.status === 201 && r.body?.data?.payment?.finalized === true && r.body?.data?.payment?.status === "PARTIAL");
  r = await request("POST", `/ride-payments/${finPaymentId}/mark-due`);
  check("finalized payment cannot be marked due -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${finPaymentId}/amount`, { body: { amount: 300 } });
  check("finalized payment amount cannot change -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${finPaymentId}/method`, { headers: strangerAuth, body: { method: "MANUAL" } });
  check("finalized payment method cannot change -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${finPaymentId}/bkash/initiate`, { headers: strangerAuth, body: { amount: 150 } });
  check("finalized payment cannot pay online -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${finPaymentId}/refund/request`, { body: { refundMethod: "MANUAL" } });
  check("finalized payment can still be refunded -> 200", r.status === 200);
  r = await request("POST", `/ride-payments/${finPaymentId}/refund/confirm`, { headers: strangerAuth });
  check("payer confirms refund on finalized payment -> 200", r.status === 200);
  r = await request("DELETE", `/rides/${finRideId}`);
  check("ride cancels after finalized refund -> 200", r.status === 200);

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "CancelRefund", departureTime: "18:45", seats: 1, charge: 200 } });
  const crRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${crRideId}/requests`, { headers: strangerAuth });
  const crReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${crRideId}/requests/${crReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${crRideId}`);
  const crPaymentId = r.body?.data?.payments?.[0]?._id;
  r = await request("POST", `/ride-payments/${crPaymentId}/manual`, { headers: strangerAuth, body: { amount: 200, reference: "CASH-CR-01" } });
  r = await request("POST", `/ride-payments/${crPaymentId}/refund/request`, { body: { refundMethod: "MANUAL" } });
  check("refund requested on paid payment -> 200", r.status === 200 && r.body?.data?.status === "REFUND_REQUESTED");
  r = await request("GET", `/ride-payments/${crPaymentId}`, { headers: strangerAuth });
  check("payer has no cancel permission", r.body?.data?.canCancelRefund === false);
  r = await request("POST", `/ride-payments/${crPaymentId}/refund/cancel`, { headers: strangerAuth });
  check("payer cannot cancel the refund request -> 403", r.status === 403);
  r = await request("POST", `/ride-payments/${crPaymentId}/refund/cancel`);
  check("owner cancels refund request -> 200", r.status === 200, JSON.stringify(r.body));
  check("cancelled refund restores the paid status", r.body?.data?.status === "PAID" && r.body?.data?.refundRequestedBy === null);
  r = await request("POST", `/ride-payments/${crPaymentId}/refund/request`, { body: { refundMethod: "MANUAL" } });
  check("refund can be requested again after cancel -> 200", r.status === 200);
  r = await request("POST", `/ride-payments/${crPaymentId}/refund/confirm`, { headers: strangerAuth });
  check("payer confirms the re-requested refund -> 200", r.status === 200);
  r = await request("DELETE", `/rides/${crRideId}`);
  check("ride cancels after confirmed refund -> 200", r.status === 200);

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "FeeRefund", departureTime: "19:45", seats: 1, charge: 100 } });
  const feeRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${feeRideId}/requests`, { headers: strangerAuth });
  const feeReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${feeRideId}/requests/${feeReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${feeRideId}`);
  const feePaymentId = r.body?.data?.payments?.[0]?._id;
  await RidePaymentModel.updateOne({ _id: feePaymentId }, { $set: { dueDate: new Date(Date.now() - 1 * 86400000) } });
  r = await request("POST", `/ride-payments/${feePaymentId}/amount`, { body: { amount: 150 } });
  check("set due amount does not double-count the late fee", r.body?.data?.totalOutstanding === 150 && r.body?.data?.remainingAmount === 100, JSON.stringify(r.body));
  r = await request("POST", `/ride-payments/${feePaymentId}/manual`, { headers: strangerAuth, body: { amount: 150, reference: "CASH-FEE-02" } });
  check("pay the fee-adjusted due -> 201", r.status === 201);
  check("fee paid recorded on the bill", r.body?.data?.payment?.amountPaid === 100 && r.body?.data?.payment?.lateFeePaid === 50 && r.body?.data?.payment?.status === "PAID");
  r = await request("POST", `/ride-payments/${feePaymentId}/refund/request`, { body: { refundMethod: "MANUAL" } });
  r = await request("GET", `/ride-payments/${feePaymentId}`, { headers: strangerAuth });
  check("refund request keeps the paid late fee on the record", r.body?.data?.status === "REFUND_REQUESTED" && r.body?.data?.lateFeePaid === 50);
  r = await request("POST", `/ride-payments/${feePaymentId}/refund/cancel`);
  r = await request("GET", `/ride-payments/${feePaymentId}`, { headers: strangerAuth });
  check("cancelled refund restores paid status and keeps the fee paid", r.body?.data?.status === "PAID" && r.body?.data?.lateFeePaid === 50);
  r = await request("POST", `/ride-payments/${feePaymentId}/refund/request`, { body: { refundMethod: "MANUAL" } });
  r = await request("POST", `/ride-payments/${feePaymentId}/refund/confirm`, { headers: strangerAuth });
  check("payer confirms refund incl late fee -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("GET", `/ride-payments/${feePaymentId}`, { headers: strangerAuth });
  const feeRefundTxn = (r.body?.data?.transactions || []).find((t) => t.kind === "REFUND");
  check("refund transaction covers principal + late fee", feeRefundTxn?.amount === 150);
  r = await request("DELETE", `/rides/${feeRideId}`);
  check("ride cancels after fee-inclusive refund -> 200", r.status === 200);

  r = await request("GET", `/ride-payments/ride/${chargeRideId}`, { headers: riderAuth });
  check("rider cannot view poster payment management -> 403", r.status === 403);
  r = await request("GET", `/ride-payments/${chargePaymentId}`, { headers: strangerAuth });
  check("stranger cannot view payment details -> 403", r.status === 403);

  r = await request("DELETE", `/ride-payments/transactions/${firstTxId}`, { headers: riderAuth });
  check("rider hides own transaction -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("GET", "/ride-payments/transactions", { headers: riderAuth });
  check("hidden transaction gone from own history", !(r.body?.data || []).some((t) => t._id === firstTxId));
  r = await request("GET", "/ride-payments/transactions");
  check("other participant still sees the transaction", (r.body?.data || []).some((t) => t._id === firstTxId));
  r = await request("DELETE", `/ride-payments/transactions/${firstTxId}`, { headers: strangerAuth });
  check("stranger cannot delete transaction -> 403", r.status === 403);

  r = await request("GET", "/ride-payments/summary");
  check("poster dashboard summary -> 200", r.status === 200, JSON.stringify(r.body));
  check("poster net = 10 (netted dues)", r.body?.data?.net === 10);

  r = await request("GET", `/ride-payments/transactions/${firstTxId}/receipt`, { headers: strangerAuth });
  check("stranger cannot fetch transaction receipt -> 403", r.status === 403);
  r = await request("GET", `/ride-payments/transactions/${firstTxId}/receipt`);
  check("involved user fetches receipt data -> 200", r.status === 200);

  console.log("\n--- Ride payments v2: method, one-time manual status, refunds, cancellation ---");

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Mohakhali", departureTime: "11:00", seats: 3, charge: 300 } });
  const multiRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${multiRideId}/requests`, { headers: riderAuth, body: { seats: 2 } });
  const multiReqId = r.body?.data?._id;
  check("multi-seat request created", r.status === 201 && r.body?.data?.seats === 2);
  r = await request("POST", `/rides/${multiRideId}/requests`, { headers: riderAuth, body: { seats: 2 } });
  check("duplicate request blocked", r.status === 409);
  r = await request("PUT", `/rides/${multiRideId}/requests/${multiReqId}`, { body: { decision: "accepted" } });
  check("poster accepts multi-seat request", r.status === 200);
  r = await request("GET", `/ride-payments/ride/${multiRideId}`);
  check("payment amount = 2 seats x 300", r.body?.data?.payments?.[0]?.originalAmount === 600);
  check("payment seats recorded", r.body?.data?.payments?.[0]?.seats === 2);
  const multiPaymentId = r.body?.data?.payments?.[0]?._id;

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Banani", departureTime: "12:00", seats: 1, charge: 100 } });
  const overRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${overRideId}/requests`, { headers: riderAuth, body: { seats: 2 } });
  check("requesting more seats than available -> 400", r.status === 400);

  r = await request("POST", `/ride-payments/${multiPaymentId}/method`, { headers: strangerAuth, body: { method: "MANUAL" } });
  check("stranger cannot select method -> 403", r.status === 403);
  r = await request("POST", `/ride-payments/${multiPaymentId}/method`, { headers: riderAuth, body: { method: "CASH" } });
  check("invalid method -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${multiPaymentId}/method`, { headers: riderAuth, body: { method: "MANUAL" } });
  check("rider selects MANUAL -> 200", r.status === 200);
  check("method stored on payment", r.body?.data?.paymentMethod === "MANUAL");

  r = await request("POST", `/ride-payments/${multiPaymentId}/bkash/initiate`, { headers: riderAuth, body: { amount: 200 } });
  check("bkash blocked for manual-method payment -> 400", r.status === 400);

  r = await request("POST", `/ride-payments/${multiPaymentId}/manual-status`, { headers: strangerAuth, body: { status: "PENDING" } });
  check("non-payer cannot set manual status -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${multiPaymentId}/manual-status`, { headers: riderAuth, body: { status: "DUE" } });
  check("payer cannot set DUE (owner only) -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${multiPaymentId}/manual-status`, { headers: riderAuth, body: { status: "PENDING" } });
  check("manual status PENDING -> 201", r.status === 201, JSON.stringify(r.body));
  check("PENDING notification does not finalize payment", r.body?.data?.finalized === false && r.body?.data?.manualStatus === "PENDING");
  r = await request("POST", `/ride-payments/${multiPaymentId}/manual-status`, { headers: riderAuth, body: { status: "PAID" } });
  check("payer cannot submit PAID manual status -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${multiPaymentId}/mark-due`);
  check("owner can still mark payment due after PENDING -> 200", r.status === 200, JSON.stringify(r.body));
  check("payment marked DUE by owner", r.body?.data?.status === "DUE" && r.body?.data?.manualStatus === "DUE");
  r = await request("POST", `/ride-payments/${multiPaymentId}/manual-status`, { headers: riderAuth, body: { status: "PENDING" } });
  check("passenger PENDING cannot clear owner's due flag -> 400", r.status === 400, JSON.stringify(r.body));
  r = await request("GET", `/ride-payments/${multiPaymentId}`, { headers: riderAuth });
  check("payment stays DUE after rejected PENDING", r.body?.data?.status === "DUE" && r.body?.data?.canSubmitManualStatus === false);

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Banani", departureTime: "12:30", seats: 1, charge: 200 } });
  const dueRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${dueRideId}/requests`, { headers: strangerAuth });
  const dueReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${dueRideId}/requests/${dueReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${dueRideId}`);
  const duePaymentId = r.body?.data?.payments?.[0]?._id;
  check("payment auto-created for due ride", typeof duePaymentId === "string");

  r = await request("POST", `/ride-payments/${duePaymentId}/mark-due`, { headers: strangerAuth });
  check("passenger cannot mark due -> 403", r.status === 403);
  r = await request("GET", "/ride-payments/dues", { headers: strangerAuth });
  const oweBefore = (r.body?.data?.youOwe || []).find((d) => String(d.counterparty?._id) === recreatedStudentId)?.amount || 0;
  r = await request("GET", "/ride-payments/dues");
  const owedBefore = (r.body?.data?.owedToYou || []).find((d) => String(d.counterparty?._id) === strangerStudentId)?.amount || 0;
  check("pending ride payment already in passenger's you owe", oweBefore >= 200);
  check("pending ride payment already in rider's owed to you", owedBefore >= 200);
  r = await request("POST", `/ride-payments/${duePaymentId}/mark-due`);
  check("owner marks payment due -> 200", r.status === 200, JSON.stringify(r.body));
  check("payment status DUE", r.body?.data?.status === "DUE" && r.body?.data?.manualStatus === "DUE");
  r = await request("GET", "/ride-payments/dues", { headers: strangerAuth });
  const oweAfter = (r.body?.data?.youOwe || []).find((d) => String(d.counterparty?._id) === recreatedStudentId)?.amount || 0;
  check("due payment still in passenger's you owe", oweAfter === oweBefore);
  r = await request("GET", "/ride-payments/dues");
  const owedAfter = (r.body?.data?.owedToYou || []).find((d) => String(d.counterparty?._id) === strangerStudentId)?.amount || 0;
  check("due payment still in rider's owed to you", owedAfter === owedBefore);
  r = await request("POST", `/ride-payments/${duePaymentId}/mark-due`, { body: { due: false } });
  check("owner clears due -> 200", r.status === 200 && r.body?.data?.status === "PENDING");
  r = await request("POST", `/ride-payments/${duePaymentId}/mark-due`);
  r = await request("POST", `/ride-payments/${duePaymentId}/manual`, { headers: strangerAuth, body: { amount: 50, reference: "CASH-DUE-01" } });
  check("partial payment shows PARTIAL while due flag kept", r.body?.data?.payment?.status === "PARTIAL" && r.body?.data?.payment?.manualStatus === "DUE");

  r = await request("POST", `/ride-payments/${duePaymentId}/amount`, { headers: strangerAuth, body: { amount: 300 } });
  check("passenger cannot set due amount -> 403", r.status === 403);
  r = await request("POST", `/ride-payments/${duePaymentId}/amount`, { body: { amount: 0 } });
  check("zero remaining owed -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${duePaymentId}/amount`, { body: { amount: 300 } });
  check("owner sets the remaining amount owed -> 200", r.status === 200, JSON.stringify(r.body));
  check("remaining = entered, total = paid + remaining", r.body?.data?.originalAmount === 350 && r.body?.data?.remainingAmount === 300 && r.body?.data?.manualStatus === "DUE");
  r = await request("DELETE", `/rides/${dueRideId}`);
  check("cannot cancel ride with partial payment -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${duePaymentId}/refund/request`, { headers: strangerAuth, body: { refundMethod: "MANUAL" } });
  check("payer cannot request refund -> 403", r.status === 403);
  r = await request("POST", `/ride-payments/${duePaymentId}/refund/request`, { body: { refundMethod: "MANUAL" } });
  check("receiver requests refund for partial payment -> 200", r.status === 200, JSON.stringify(r.body));
  check("partial payment REFUND_REQUESTED", r.body?.data?.status === "REFUND_REQUESTED");
  r = await request("GET", `/ride-payments/ride/${dueRideId}`);
  check("pending refund survives management re-read", r.body?.data?.payments?.[0]?.status === "REFUND_REQUESTED");
  r = await request("DELETE", `/rides/${dueRideId}`);
  check("cannot cancel while refund pending -> 400", r.status === 400);
  r = await request("POST", `/ride-payments/${duePaymentId}/refund/confirm`, { headers: strangerAuth });
  check("payer confirms partial refund -> 200", r.status === 200, JSON.stringify(r.body));
  check("partial payment REFUNDED with 0 outstanding", r.body?.data?.status === "REFUNDED" && r.body?.data?.totalOutstanding === 0);
  r = await request("DELETE", `/rides/${dueRideId}`);
  check("cancel due ride after partial refund -> 200", r.status === 200);
  r = await request("POST", `/ride-payments/${cbPaymentId}/mark-due`);
  check("owner cannot mark fully paid payment due -> 400", r.status === 400);

  r = await request("DELETE", `/rides/${multiRideId}`);
  check("poster cancels ride with unpaid payment -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("GET", `/ride-payments/${multiPaymentId}`, { headers: riderAuth });
  check("unpaid payment voided on cancel", r.body?.data?.status === "CANCELLED");
  check("voided payment to pay 0", r.body?.data?.totalOutstanding === 0);

  await RidePaymentModel.updateOne({ _id: multiPaymentId }, { $set: { dueDate: new Date(Date.now() - 5 * 86400000) } });
  r = await request("GET", `/ride-payments/${multiPaymentId}`, { headers: riderAuth });
  check("cancelled payment never accrues late fee", r.body?.data?.status === "CANCELLED" && r.body?.data?.lateFee === 0);

  await RidePaymentModel.updateOne(
    { _id: multiPaymentId },
    { $set: { status: "PENDING", remainingAmount: 600, totalOutstanding: 600, lateFee: 0 } }
  );
  r = await request("GET", "/ride-payments/summary");
  check("stale unpaid payment self-heals on read", r.status === 200);
  r = await request("GET", `/ride-payments/${multiPaymentId}`, { headers: riderAuth });
  check("self-healed payment zeroed to pay", r.body?.data?.status === "CANCELLED" && r.body?.data?.totalOutstanding === 0);

  r = await request("DELETE", `/rides/${oneSeatRideId}`);
  check("cannot cancel ride with paid payment -> 400", r.status === 400);
  r = await request("DELETE", `/rides/${oneSeatRideId}/requests/${oneSeatReqId}`, { headers: strangerAuth, body: { reason: "Changed" } });
  check("rider with paid payment cannot cancel own request -> 400", r.status === 400);

  r = await request("POST", `/ride-payments/${cbPaymentId}/refund/request`, { headers: strangerAuth, body: { refundMethod: "MANUAL" } });
  check("payer cannot request refund -> 403", r.status === 403);
  r = await request("POST", `/ride-payments/${cbPaymentId}/refund/request`, { body: { refundMethod: "MANUAL" } });
  check("receiver requests refund -> 200", r.status === 200, JSON.stringify(r.body));
  check("payment REFUND_REQUESTED", r.body?.data?.status === "REFUND_REQUESTED");
  r = await request("POST", `/ride-payments/${cbPaymentId}/refund/confirm`);
  check("receiver cannot confirm refund -> 403", r.status === 403);
  r = await request("POST", `/ride-payments/${cbPaymentId}/refund/confirm`, { headers: strangerAuth });
  check("payer confirms refund -> 200", r.status === 200, JSON.stringify(r.body));
  check("payment REFUNDED", r.body?.data?.status === "REFUNDED");
  const BookingModel = require("../models/Booking");
  const cbBooking = await BookingModel.findOne({ ride: cbRideId, rider: strangerStudentId });
  check("refund while ride open frees the seat", cbBooking?.status === "cancelled");
  r = await request("GET", `/ride-payments/ride/${cbRideId}`);
  check("management excludes refunded payment from totals", r.body?.data?.received === 0 && r.body?.data?.expected === 0 && r.body?.data?.counts?.refunded === 1);
  r = await request("POST", `/ride-payments/${cbPaymentId}/refund/confirm`, { headers: strangerAuth });
  check("double refund confirm -> 400", r.status === 400);
  r = await request("GET", `/ride-payments/${cbPaymentId}`, { headers: strangerAuth });
  check("refund transaction created", (r.body?.data?.transactions || []).some((t) => t.kind === "REFUND"));

  r = await request("DELETE", `/rides/${cbRideId}`);
  check("ride cancelled after refund -> 200", r.status === 200);
  r = await request("GET", `/ride-payments/${cbPaymentId}`, { headers: strangerAuth });
  check("refunded payment contributes 0 to pay", r.body?.data?.totalOutstanding === 0);
  check("refunded payment stays REFUNDED after cancel", r.body?.data?.status === "REFUNDED");

  await RidePaymentModel.updateOne(
    { _id: cbPaymentId },
    { $set: { status: "REFUND_REQUESTED", amountPaid: 200, remainingAmount: 0, totalOutstanding: 0, lateFee: 0 } }
  );
  r = await request("POST", `/ride-payments/${cbPaymentId}/refund/confirm`, { headers: strangerAuth });
  check("reused payment can be refunded again -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("GET", `/ride-payments/${cbPaymentId}`, { headers: strangerAuth });
  check("second refund also creates a ledger entry", (r.body?.data?.transactions || []).filter((t) => t.kind === "REFUND").length === 2);

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Tejgaon", departureTime: "13:00", seats: 1, charge: 150 } });
  const manualPaidRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${manualPaidRideId}/requests`, { headers: strangerAuth });
  const manualPaidReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${manualPaidRideId}/requests/${manualPaidReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${manualPaidRideId}`);
  const manualPaidPaymentId = r.body?.data?.payments?.[0]?._id;
  r = await request("POST", `/ride-payments/${manualPaidPaymentId}/method`, { headers: strangerAuth, body: { method: "MANUAL" } });
  check("select MANUAL on fresh payment", r.status === 200);
  r = await request("POST", `/ride-payments/${manualPaidPaymentId}/manual-status`, { headers: strangerAuth, body: { status: "PAID" } });
  check("passenger cannot self-finalize as PAID -> 400", r.status === 400, JSON.stringify(r.body));
  r = await request("POST", `/ride-payments/${manualPaidPaymentId}/manual-status`, { headers: strangerAuth, body: { status: "PENDING" } });
  check("passenger submits PENDING -> 201", r.status === 201, JSON.stringify(r.body));
  check("PENDING declaration does not pay the bill", r.body?.data?.status === "PENDING" && r.body?.data?.finalized === false && r.body?.data?.manualStatus === "PENDING" && r.body?.data?.amountPaid === 0 && r.body?.data?.remainingAmount === 150);
  r = await request("GET", `/ride-payments/${manualPaidPaymentId}`, { headers: strangerAuth });
  check("PENDING declaration creates no transaction", (r.body?.data?.transactions || []).length === 0);
  r = await request("POST", `/ride-payments/${manualPaidPaymentId}/manual-status`, { headers: strangerAuth, body: { status: "DUE" } });
  check("passenger cannot submit DUE manual status -> 400", r.status === 400);
  r = await request("DELETE", `/rides/${manualPaidRideId}`);
  check("ride cancels when passenger only declared PENDING -> 200", r.status === 200, JSON.stringify(r.body));

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Mirpur", departureTime: "15:30", seats: 1, charge: 200 } });
  const notifyRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${notifyRideId}/requests`, { headers: riderAuth });
  const notifyReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${notifyRideId}/requests/${notifyReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${notifyRideId}`);
  const notifyPaymentId = r.body?.data?.payments?.[0]?._id;
  check("payment auto-created for notified partial ride", typeof notifyPaymentId === "string");
  r = await request("POST", `/ride-payments/${notifyPaymentId}/method`, { headers: riderAuth, body: { method: "MANUAL" } });
  check("passenger selects MANUAL -> 200", r.status === 200);
  r = await request("POST", `/ride-payments/${notifyPaymentId}/manual`, { headers: riderAuth, body: { amount: 50, reference: "CASH-NOTIFY-01" } });
  check("passenger partially pays (50 of 200)", r.status === 201 && r.body?.data?.payment?.amountPaid === 50 && r.body?.data?.payment?.status === "PARTIAL");
  r = await request("POST", `/ride-payments/${notifyPaymentId}/manual-status`, { headers: riderAuth, body: { status: "PENDING" } });
  check("passenger notifies PENDING after partial -> 201", r.status === 201, JSON.stringify(r.body));
  check("PENDING notification leaves payment open", r.body?.data?.finalized === false && r.body?.data?.manualStatus === "PENDING" && r.body?.data?.amountPaid === 50 && r.body?.data?.remainingAmount === 150);
  r = await request("POST", `/ride-payments/${notifyPaymentId}/mark-due`);
  check("rider can still mark due with a partial amount -> 200", r.status === 200, JSON.stringify(r.body));
  check("due kept alongside partial balance", r.body?.data?.status === "PARTIAL" && r.body?.data?.manualStatus === "DUE" && r.body?.data?.amountPaid === 50 && r.body?.data?.remainingAmount === 150);
  r = await request("POST", `/ride-payments/${notifyPaymentId}/amount`, { body: { amount: 150 } });
  check("rider can still set the remaining amount owed -> 200", r.status === 200);
  r = await request("POST", `/ride-payments/${notifyPaymentId}/mark-paid`, { body: { amount: 150, reference: "CASH-NOTIFY-02" } });
  check("rider can still confirm the payment as paid -> 201", r.status === 201 && r.body?.data?.payment?.status === "PAID");
  r = await request("POST", `/ride-payments/${notifyPaymentId}/refund/request`, { body: { refundMethod: "MANUAL" } });
  check("receiver requests refund after confirm -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("POST", `/ride-payments/${notifyPaymentId}/refund/confirm`, { headers: riderAuth });
  check("payer confirms refund -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("DELETE", `/rides/${notifyRideId}`);
  check("ride cancels after full refund -> 200", r.status === 200);

  r = await request("POST", "/rides", { body: { pickup: "BRAC University", dropoff: "Gulshan", departureTime: "14:00", seats: 1, charge: 200 } });
  const partialPaidRideId = r.body?.data?._id;
  r = await request("POST", `/rides/${partialPaidRideId}/requests`, { headers: strangerAuth });
  const partialPaidReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${partialPaidRideId}/requests/${partialPaidReqId}`, { body: { decision: "accepted" } });
  r = await request("GET", `/ride-payments/ride/${partialPaidRideId}`);
  const partialPaidPaymentId = r.body?.data?.payments?.[0]?._id;
  r = await request("POST", `/ride-payments/${partialPaidPaymentId}/method`, { headers: strangerAuth, body: { method: "MANUAL" } });
  r = await request("POST", `/ride-payments/${partialPaidPaymentId}/manual`, { headers: strangerAuth, body: { amount: 50, reference: "CASH-PARTIAL-01" } });
  check("partial manual recorded before PAID declaration", r.body?.data?.payment?.amountPaid === 50 && r.body?.data?.payment?.status === "PARTIAL");
  r = await request("POST", `/ride-payments/${partialPaidPaymentId}/manual-status`, { headers: strangerAuth, body: { status: "PAID" } });
  check("passenger PAID claim rejected even after partial -> 400", r.status === 400, JSON.stringify(r.body));
  r = await request("GET", `/ride-payments/${partialPaidPaymentId}`, { headers: strangerAuth });
  const partialPaidTxns = r.body?.data?.transactions || [];
  check("rejected PAID leaves payment partially paid", r.body?.data?.amountPaid === 50 && r.body?.data?.remainingAmount === 150 && r.body?.data?.status === "PARTIAL");
  check("only the real payment is on the ledger", partialPaidTxns.length === 1 && partialPaidTxns.reduce((s, t) => s + t.amount, 0) === 50);
  r = await request("POST", `/ride-payments/${partialPaidPaymentId}/refund/request`, { body: { refundMethod: "MANUAL" } });
  check("receiver requests refund for partial payment -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("POST", `/ride-payments/${partialPaidPaymentId}/refund/confirm`, { headers: strangerAuth });
  check("payer confirms refund for partial payment -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("DELETE", `/rides/${partialPaidRideId}`);
  check("ride cancels after partial refund -> 200", r.status === 200);

  r = await request("GET", "/ride-payments/dues");
  check("voided/refunded payments absent from dues", (r.body?.data?.youOwe || []).every((d) => String(d.counterparty?._id) !== String(strangerStudentId)) && (r.body?.data?.owedToYou || []).every((d) => String(d.counterparty?._id) !== String(strangerStudentId)));

  r = await request("POST", "/rides", { body: { pickup: "Mirpur 1", dropoff: "BracU", departureTime: "09:30", seats: 2, charge: 100 } });
  const guardRideId = r.body?.data?._id;
  r = await request("POST", `/recurring/from/${guardRideId}`);
  check("third ride marked recurring -> 201", r.status === 201, JSON.stringify(r.body));
  const guardTemplateId = r.body?.data?._id;
  const RideModel = require("../models/Ride");
  await RideModel.updateOne({ _id: guardRideId }, { $set: { recurringRef: guardTemplateId } });
  r = await request("POST", `/rides/${guardRideId}/requests`, { headers: riderAuth });
  const guardReqId = r.body?.data?._id;
  r = await request("PUT", `/rides/${guardRideId}/requests/${guardReqId}`, { body: { decision: "accepted" } });
  check("rider accepted on guard ride -> 200", r.status === 200);
  r = await request("GET", `/ride-payments/ride/${guardRideId}`);
  const guardPaymentId = r.body?.data?.payments?.[0]?._id;
  check("payment auto-created on guard ride", typeof guardPaymentId === "string");
  r = await request("POST", `/ride-payments/${guardPaymentId}/manual`, { headers: riderAuth, body: { amount: 50, reference: "CASH-GUARD-01" } });
  check("rider partially pays on guard ride", r.status === 201 && r.body?.data?.payment?.amountPaid === 50);
  r = await request("POST", `/recurring/${guardTemplateId}/skips`, { body: { date: todayKey() } });
  check("skip today blocked while passenger paid -> 400", r.status === 400, JSON.stringify(r.body));
  check("blocked skip tells poster to refund first", String(r.body?.message || "").includes("refund"));
  let guardRide = await RideModel.findById(guardRideId);
  check("guard ride stays open after blocked skip", guardRide?.status === "open");
  r = await request("GET", `/recurring/${guardTemplateId}/skips`);
  check("blocked skip leaves no skip record", (r.body?.data || []).length === 0);
  r = await request("POST", `/ride-payments/${guardPaymentId}/refund/request`, { body: { refundMethod: "MANUAL" } });
  check("receiver requests refund on guard payment -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("POST", `/ride-payments/${guardPaymentId}/refund/confirm`, { headers: riderAuth });
  check("payer confirms refund on guard payment -> 200", r.status === 200, JSON.stringify(r.body));
  r = await request("POST", `/recurring/${guardTemplateId}/skips`, { body: { date: todayKey() } });
  check("skip today succeeds after refund -> 201", r.status === 201, JSON.stringify(r.body));
  guardRide = await RideModel.findById(guardRideId);
  check("guard ride cancelled after refunded skip", guardRide?.status === "cancelled");

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
  await mongo.stop();
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
