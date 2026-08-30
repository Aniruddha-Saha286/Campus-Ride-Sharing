const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5903";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5903;
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


  // Setup: Create poster
  let r = await request("POST", "/students/profile", { body: createFormData() });
  const recreatedStudentId = r.body?.data?._id;
  
  r = await request("POST", "/admin/login", { body: { email: "admin@campusride.local", password: "Admin@12345" } });
  const adminToken = r.body?.token;
  const adminAuth = { Authorization: `Bearer ${adminToken}` };
  
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

  // --- Edit Ride Offer Tests ---
  console.log("\n--- Edit Ride Offer ---");
  r = await request("POST", "/rides", {
    headers: auth,
    body: {
      pickup: "Dhanmondi 27",
      dropoff: "Campus Gate 1",
      departureTime: "08:30",
      seats: 3,
      charge: 40,
      notes: "Original note",
    },
  });
  check("create ride for edit tests -> 201", r.status === 201, JSON.stringify(r.body));
  const editRideId = r.body?.data?._id;

  // Stranger/rider cannot edit
  r = await request("PUT", `/rides/${editRideId}`, {
    headers: riderAuth,
    body: { pickup: "Hacked pickup" },
  });
  check("rider cannot edit poster's ride -> 403", r.status === 403);

  // Invalid data checks
  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: { departureTime: "99:99" },
  });
  check("invalid departure time -> 400", r.status === 400);

  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: { seats: 8 },
  });
  check("invalid seat count (>6) -> 400", r.status === 400);

  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: { pickup: "   " },
  });
  check("empty pickup -> 400", r.status === 400);

  // Successful edit
  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: {
      pickup: "Mirpur 10",
      dropoff: "Campus Gate 2",
      departureTime: "09:15",
      seats: 4,
      charge: 60,
      notes: "Updated route and time",
    },
  });
  check("poster updates ride -> 200", r.status === 200, JSON.stringify(r.body));
  check("updated pickup persisted", r.body?.data?.pickup === "Mirpur 10");
  check("updated dropoff persisted", r.body?.data?.dropoff === "Campus Gate 2");
  check("updated departureTime persisted", r.body?.data?.departureTime === "09:15");
  check("updated seats persisted", r.body?.data?.seats === 4);
  check("updated charge persisted", r.body?.data?.charge === 60);
  check("updated notes persisted", r.body?.data?.notes === "Updated route and time");

  // Request 1 seat and accept it
  r = await request("POST", `/rides/${editRideId}/requests`, {
    headers: riderAuth,
    body: { seats: 1 },
  });
  check("rider requests 1 seat -> 201", r.status === 201, JSON.stringify(r.body));
  const partialReqId = r.body?.data?._id;

  r = await request("PUT", `/rides/${editRideId}/requests/${partialReqId}`, {
    headers: auth,
    body: { decision: "accepted" },
  });
  check("poster accepts 1 seat -> 200", r.status === 200, JSON.stringify(r.body));

  // Poster attempts to change pickup location when 1 seat is accepted -> 400
  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: { pickup: "Gulshan 1" },
  });
  check("location change blocked after booking accepted -> 400", r.status === 400);
  check(
    "location lock error message",
    r.body?.message === "Cannot change pickup or drop-off location once a seat request has been accepted"
  );

  // Poster attempts to change departure time when 1 seat is accepted -> 400
  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: { departureTime: "11:00" },
  });
  check("departure time change blocked after booking accepted -> 400", r.status === 400);
  check(
    "departure time lock error message",
    r.body?.message === "Cannot change departure time once a seat request has been accepted"
  );

  // Poster attempts to change fare when 1 seat is accepted -> 400
  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: { charge: 200 },
  });
  check("fare change blocked after booking accepted -> 400", r.status === 400);
  check(
    "fare lock error message",
    r.body?.message === "Cannot change ride fare once a seat request has been accepted"
  );

  // Poster can still update seats and notes
  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: { seats: 5, notes: "Updated pickup note" },
  });
  check("poster can still edit seats and notes when booking accepted -> 200", r.status === 200);
  check("seats updated to 5", r.body?.data?.seats === 5);
  check("notes updated", r.body?.data?.notes === "Updated pickup note");

  // Create and approve second rider to test filling remaining seats
  const RIDER2_EMAIL = "rider2.student@g.bracu.ac.bd";
  const rider2Token = jwt.sign({ id: "rider2_id", universityEmail: RIDER2_EMAIL }, process.env.JWT_SECRET);
  const rider2Auth = { Authorization: `Bearer ${rider2Token}` };

  r = await request("POST", "/students/profile", {
    headers: rider2Auth,
    body: createFormData({
      ...VALID_PROFILE,
      studentId: "20109999",
      name: "Second Rider",
      phone: "+8801788000000",
      studentNid: "20030514999999999",
    }),
  });
  check("rider2 profile created -> 201", r.status === 201);
  const rider2StudentId = r.body?.data?._id;

  r = await request("PUT", `/admin/verifications/${rider2StudentId}`, {
    headers: adminAuth,
    body: { decision: "approved" },
  });
  check("approve rider2 -> 200", r.status === 200);

  // Rider 2 requests remaining 4 seats to fully book the ride
  r = await request("POST", `/rides/${editRideId}/requests`, {
    headers: rider2Auth,
    body: { seats: 4 },
  });
  check("rider2 requests remaining 4 seats -> 201", r.status === 201, JSON.stringify(r.body));
  const fullReqId = r.body?.data?._id;

  r = await request("PUT", `/rides/${editRideId}/requests/${fullReqId}`, {
    headers: auth,
    body: { decision: "accepted" },
  });
  check("poster accepts remaining 4 seats -> 200", r.status === 200, JSON.stringify(r.body));

  // Attempt to edit fully booked ride
  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: { notes: "Trying to edit fully booked ride" },
  });
  check("edit fully booked ride -> 400", r.status === 400);
  check("fully booked error message", r.body?.message === "Cannot edit a fully booked ride offer");

  // Rider 2 cancels the booking, freeing up seats
  r = await request("DELETE", `/rides/${editRideId}/requests/${fullReqId}`, {
    headers: rider2Auth,
    body: { reason: "Change of plans" },
  });
  check("rider2 cancels accepted seats -> 200", r.status === 200);

  // Edit again once seats are free
  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: { seats: 2 },
  });
  check("poster updates seats to 2 -> 200", r.status === 200);
  check("seats updated to 2", r.body?.data?.seats === 2);

  // Cancel ride and attempt edit
  r = await request("DELETE", `/rides/${editRideId}`, { headers: auth });
  check("poster cancels ride -> 200", r.status === 200);

  r = await request("PUT", `/rides/${editRideId}`, {
    headers: auth,
    body: { notes: "Edit cancelled ride" },
  });
  check("edit cancelled ride -> 400", r.status === 400);

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
