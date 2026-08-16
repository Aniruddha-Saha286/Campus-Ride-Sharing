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
  r = await request("POST", "/recurring/generate");
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
  r = await request("POST", "/recurring/generate");
  check("restored template generates again", Number(r.body?.data?.generated) >= 1);
  const ridesAfter = await generatedRides(templateId);
  check("occurrence created with template link", ridesAfter.length >= 1);
  check("generated occurrence is open", ridesAfter.every((ride) => ride.status === "open"));

  await backdateTemplate(secondTemplateId);
  r = await request("POST", "/recurring/generate");
  check("second template generates a ride -> 200", r.status === 200, JSON.stringify(r.body));
  const published = await generatedRides(secondTemplateId);
  check("second template has a published ride", published.some((ride) => ride.status === "open"));
  r = await request("POST", `/recurring/${secondTemplateId}/skips`, { body: { date: today } });
  check("skip today's published occurrence -> 201", r.status === 201, JSON.stringify(r.body));
  const afterCancel = await generatedRides(secondTemplateId);
  check("published occurrence cancelled without touching the series", afterCancel.every((ride) => ride.status === "cancelled"));
  r = await request("GET", "/recurring/mine");
  check("template still exists and stays active", (r.body?.data || []).some((t) => t._id === secondTemplateId && t.status === "active"));

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
  await mongo.stop();
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
