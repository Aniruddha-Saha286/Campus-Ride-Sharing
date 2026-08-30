const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5908";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5908;
const BASE = `http://localhost:${PORT}/api`;
const POSTER_EMAIL = "poster.student@g.bracu.ac.bd";
const POSTER_ID = "poster123";

const RIDER_EMAIL = "rider.student@g.bracu.ac.bd";
const RIDER_ID = "rider123";

const STRANGER_EMAIL = "stranger.student@g.bracu.ac.bd";
const STRANGER_ID = "stranger123";

const VALID_PROFILE = {
  studentId: "20101234",
  name: "Poster Student",
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

const posterToken = jwt.sign({ id: POSTER_ID, universityEmail: POSTER_EMAIL }, process.env.JWT_SECRET);
const posterAuth = { Authorization: `Bearer ${posterToken}` };

const riderToken = jwt.sign({ id: RIDER_ID, universityEmail: RIDER_EMAIL }, process.env.JWT_SECRET);
const riderAuth = { Authorization: `Bearer ${riderToken}` };

const strangerToken = jwt.sign({ id: STRANGER_ID, universityEmail: STRANGER_EMAIL }, process.env.JWT_SECRET);
const strangerAuth = { Authorization: `Bearer ${strangerToken}` };

const request = async (method, p, { headers = {}, body } = {}) => {
  const opts = { method, headers: { ...posterAuth, ...headers } };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.body = JSON.stringify(body);
    if (opts.headers["Content-Type"] === undefined) {
      opts.headers["Content-Type"] = "application/json";
    }
  }
  const res = await fetch(`${BASE}${p}`, opts);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, body: data };
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
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();

  require("../../server");
  await new Promise((r) => setTimeout(r, 1000));

  const ping = await fetch(`http://localhost:${PORT}/`);
  check("server boots and answers on /", ping.status === 200);

  console.log("\n--- In-Ride Direct Chat Tests ---");

  // Create profiles
  let r = await request("POST", "/students/profile", { body: createFormData() });
  const posterStudentId = r.body?.data?._id;

  r = await request("POST", "/students/profile", {
    headers: riderAuth,
    body: createFormData({ ...VALID_PROFILE, studentId: "20105678", name: "Rider Student", studentNid: "20030514987654321", phone: "+8801722000000" }),
  });
  const riderStudentId = r.body?.data?._id;

  r = await request("POST", "/students/profile", {
    headers: strangerAuth,
    body: createFormData({ ...VALID_PROFILE, studentId: "20109999", name: "Stranger Student", studentNid: "20030514999999999", phone: "+8801733000000" }),
  });
  const strangerStudentId = r.body?.data?._id;

  // Admin approves all
  r = await request("POST", "/admin/login", { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
  const adminAuth = { Authorization: `Bearer ${r.body.token}` };
  await request("PUT", `/admin/verifications/${posterStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  await request("PUT", `/admin/verifications/${riderStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  await request("PUT", `/admin/verifications/${strangerStudentId}`, { headers: adminAuth, body: { decision: "approved" } });

  // Poster creates a ride
  r = await request("POST", "/rides", {
    body: { pickup: "Mirpur 10", dropoff: "BRAC University", departureTime: "08:00", seats: 2 },
  });
  const rideId = r.body?.data?._id;

  // Rider requests seat (status is pending)
  r = await request("POST", `/rides/${rideId}/requests`, { headers: riderAuth });
  const reqId = r.body?.data?._id;

  // 1. Pending rider blocked from sending messages -> 403
  r = await request("POST", `/chat/${rideId}`, {
    headers: riderAuth,
    body: { text: "Hello driver, please accept my request" },
  });
  check("pending rider blocked from sending chat -> 403", r.status === 403);

  // 2. Pending rider blocked from viewing messages -> 403
  r = await request("GET", `/chat/${rideId}`, { headers: riderAuth });
  check("pending rider blocked from viewing chat -> 403", r.status === 403);

  // 3. Stranger blocked from chat -> 403
  r = await request("POST", `/chat/${rideId}`, {
    headers: strangerAuth,
    body: { text: "Stranger intrusion" },
  });
  check("stranger blocked from sending chat -> 403", r.status === 403);

  // 4. Accept booking
  r = await request("PUT", `/rides/${rideId}/requests/${reqId}`, { body: { decision: "accepted" } });
  check("poster accepts rider request -> 200", r.status === 200);

  // 5. Accepted rider sends message to poster -> 201
  r = await request("POST", `/chat/${rideId}`, {
    headers: riderAuth,
    body: { text: "Hi, I will be waiting near Gate 1!" },
  });
  check("accepted rider sends message -> 201", r.status === 201);
  check("message content stored", r.body?.data?.text === "Hi, I will be waiting near Gate 1!");
  check("message has sender populated", r.body?.data?.sender?.name === "Rider Student");

  // 6. Poster replies to accepted rider -> 201
  r = await request("POST", `/chat/${rideId}`, {
    body: { text: "Got it! See you at 8:00 AM.", recipientId: riderStudentId },
  });
  check("poster sends reply to accepted rider -> 201", r.status === 201);

  // 7. Both rider and poster can read the full message stream -> 200
  r = await request("GET", `/chat/${rideId}`, { headers: riderAuth });
  check("rider fetches chat stream -> 200", r.status === 200);
  check("rider sees 2 messages", Array.isArray(r.body?.data) && r.body.data.length === 2);

  r = await request("GET", `/chat/${rideId}?otherUserId=${riderStudentId}`);
  check("poster fetches chat stream with rider -> 200", r.status === 200);
  check("poster sees 2 messages", Array.isArray(r.body?.data) && r.body.data.length === 2);

  // 8. Stranger still blocked after acceptance -> 403
  r = await request("GET", `/chat/${rideId}`, { headers: strangerAuth });
  check("stranger still blocked after acceptance -> 403", r.status === 403);

  // 9. Validation: empty message -> 400
  r = await request("POST", `/chat/${rideId}`, {
    headers: riderAuth,
    body: { text: "   " },
  });
  check("empty message rejected -> 400", r.status === 400);

  // 10. Rider sends a message to edit and delete
  r = await request("POST", `/chat/${rideId}`, {
    headers: riderAuth,
    body: { text: "Initial message to edit" },
  });
  const messageToEditId = r.body?.data?._id;
  check("rider sends message for edit/delete tests -> 201", r.status === 201);

  // 11. Stranger / non-author blocked from editing -> 403
  r = await request("PUT", `/chat/${rideId}/messages/${messageToEditId}`, {
    headers: strangerAuth,
    body: { text: "Stranger trying to edit" },
  });
  check("stranger blocked from editing message -> 403", r.status === 403);

  // 12. Author edits their message -> 200
  r = await request("PUT", `/chat/${rideId}/messages/${messageToEditId}`, {
    headers: riderAuth,
    body: { text: "Edited message text" },
  });
  check("author edits message -> 200", r.status === 200);
  check("edited text persisted", r.body?.data?.text === "Edited message text");
  check("isEdited is true", r.body?.data?.isEdited === true);

  // 13. Stranger / non-author blocked from deleting -> 403
  r = await request("DELETE", `/chat/${rideId}/messages/${messageToEditId}`, {
    headers: strangerAuth,
  });
  check("stranger blocked from deleting message -> 403", r.status === 403);

  // 14. Author deletes their message -> 200
  r = await request("DELETE", `/chat/${rideId}/messages/${messageToEditId}`, {
    headers: riderAuth,
  });
  check("author deletes message -> 200", r.status === 200);
  check("isDeleted is true", r.body?.data?.isDeleted === true);
  check("deleted message placeholder", r.body?.data?.text === "This message was deleted");

  // 15. Cannot edit a deleted message -> 400
  r = await request("PUT", `/chat/${rideId}/messages/${messageToEditId}`, {
    headers: riderAuth,
    body: { text: "Trying to edit deleted msg" },
  });
  check("cannot edit deleted message -> 400", r.status === 400);

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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
