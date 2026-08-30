const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5909";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5909;
const BASE = `http://localhost:${PORT}/api`;
const DRIVER_EMAIL = "driver.student@g.bracu.ac.bd";
const DRIVER_ID = "driver123";

const VALID_PROFILE = {
  studentId: "20101234",
  name: "Driver Student",
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

const driverToken = jwt.sign({ id: DRIVER_ID, universityEmail: DRIVER_EMAIL }, process.env.JWT_SECRET);
const driverAuth = { Authorization: `Bearer ${driverToken}` };

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

const createFormData = (profile = VALID_PROFILE, { withCard = true } = {}) => {
  const fd = new FormData();
  fd.append("profile", JSON.stringify(profile));
  if (withCard) fd.append("studentIdCard", new Blob([pngBuffer()], { type: "image/png" }), "idcard.png");
  return fd;
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

  // 1. Setup Driver and 2 Passengers with approved profiles
  let r = await request("POST", "/students/profile", { headers: driverAuth, body: createFormData() });
  const driverStudentId = r.body?.data?._id;

  const p1Token = jwt.sign({ id: "pass1", universityEmail: "p1@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  const p1Auth = { Authorization: `Bearer ${p1Token}` };
  r = await request("POST", "/students/profile", {
    headers: p1Auth,
    body: createFormData({ ...VALID_PROFILE, studentId: "20101111", name: "Passenger One", studentNid: "20030514111111111", phone: "+8801711111111" }),
  });
  const p1StudentId = r.body?.data?._id;

  const p2Token = jwt.sign({ id: "pass2", universityEmail: "p2@g.bracu.ac.bd" }, process.env.JWT_SECRET);
  const p2Auth = { Authorization: `Bearer ${p2Token}` };
  r = await request("POST", "/students/profile", {
    headers: p2Auth,
    body: createFormData({ ...VALID_PROFILE, studentId: "20102222", name: "Passenger Two", studentNid: "20030514222222222", phone: "+8801722222222" }),
  });
  const p2StudentId = r.body?.data?._id;

  r = await request("POST", "/admin/login", { body: { email: "admin@campusride.local", password: "Admin@12345" } });
  const adminAuth = { Authorization: `Bearer ${r.body.token}` };

  await request("PUT", `/admin/verifications/${driverStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  await request("PUT", `/admin/verifications/${p1StudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  await request("PUT", `/admin/verifications/${p2StudentId}`, { headers: adminAuth, body: { decision: "approved" } });

  console.log("\n--- Ride Payment Feature Smoke Tests ---");

  // 2. Driver creates a paid ride with 3 seats at 100 Tk each
  r = await request("POST", "/rides", {
    headers: driverAuth,
    body: { pickup: "Dhanmondi 27", dropoff: "BracU", departureTime: "08:30", seats: 3, charge: 100 },
  });
  check("driver posts paid ride (3 seats @ 100 Tk) -> 201", r.status === 201, JSON.stringify(r.body));
  const rideId = r.body?.data?._id;

  // 3. Passenger 1 requests 1 seat
  r = await request("POST", `/rides/${rideId}/requests`, { headers: p1Auth, body: { seats: 1 } });
  check("passenger 1 requests 1 seat -> 201", r.status === 201, JSON.stringify(r.body));
  const req1Id = r.body?.data?._id;

  // 4. Passenger 2 requests 1 seat
  r = await request("POST", `/rides/${rideId}/requests`, { headers: p2Auth, body: { seats: 1 } });
  check("passenger 2 requests 1 seat -> 201", r.status === 201, JSON.stringify(r.body));
  const req2Id = r.body?.data?._id;

  // Driver accepts both
  await request("PUT", `/rides/${rideId}/requests/${req1Id}`, { headers: driverAuth, body: { decision: "accepted" } });
  await request("PUT", `/rides/${rideId}/requests/${req2Id}`, { headers: driverAuth, body: { decision: "accepted" } });

  // Verify seats left
  r = await request("GET", "/rides", { headers: p1Auth });
  const rideInList = r.body?.data?.find((x) => x._id === rideId);
  check("1 seat left after 2 bookings accepted", rideInList?.seatsLeft === 1);

  // 5. Passenger 1 edits seats before payment: can reduce or increase freely
  r = await request("PUT", `/rides/${rideId}/requests/${req1Id}/seats`, { headers: p1Auth, body: { seats: 1 } });
  check("passenger 1 can reduce seat count when unpaid (to 1 seat) -> 200", r.status === 200);

  r = await request("PUT", `/rides/${rideId}/requests/${req1Id}/seats`, { headers: p1Auth, body: { seats: 2 } });
  check("passenger 1 updates seat count to 2 -> 200", r.status === 200, JSON.stringify(r.body));
  check("ride payment amount recalculated to 200 Tk", r.body?.payment?.originalAmount === 200);

  // Verify 0 seats left now
  r = await request("GET", "/rides", { headers: p2Auth });
  const rideInList2 = r.body?.data?.find((x) => x._id === rideId);
  check("0 seats left on ride (2 + 1 booked out of 3)", rideInList2?.seatsLeft === 0);

  // 6. Passenger 1 selects manual payment and Driver marks as paid
  r = await request("GET", "/rides/mine", { headers: p1Auth });
  const p1Booking = r.body?.data?.requested?.find((x) => x._id === req1Id);
  const p1PaymentId = p1Booking?.payment?._id;

  r = await request("POST", `/ride-payments/${p1PaymentId}/method`, {
    headers: p1Auth,
    body: { method: "MANUAL" },
  });
  check("passenger 1 selects manual payment method -> 200", r.status === 200);

  // Driver marks as paid
  r = await request("POST", `/ride-payments/${p1PaymentId}/mark-paid`, {
    headers: driverAuth,
    body: { amount: 200 },
  });
  check("driver marks passenger 1 as paid -> 201", r.status === 201);
  check("payment status is PAID", r.body?.data?.payment?.status === "PAID");

  // 7. Passenger 1 tries to REDUCE seats after paying -> must fail
  r = await request("PUT", `/rides/${rideId}/requests/${req1Id}/seats`, { headers: p1Auth, body: { seats: 1 } });
  check("passenger 1 cannot reduce seats after payment -> 400", r.status === 400);

  // 8. Passenger 2 cancels unpaid booking -> frees 1 seat
  r = await request("DELETE", `/rides/${rideId}/requests/${req2Id}`, {
    headers: p2Auth,
    body: { reason: "Need to take metro" },
  });
  check("passenger 2 cancels unpaid booking -> 200", r.status === 200);
  check("no refund pending for unpaid passenger", r.body?.refundPending === false);

  // 9. Passenger 1 requests EXTRA seat (now 3 seats total, 1 extra)
  r = await request("PUT", `/rides/${rideId}/requests/${req1Id}/seats`, { headers: p1Auth, body: { seats: 3 } });
  check("passenger 1 requests extra seat (total 3 seats) -> 200", r.status === 200);
  check("extra seat amount is 100 Tk pending", r.body?.payment?.remainingAmount === 100);

  // Driver approves the extra seat payment
  r = await request("POST", `/ride-payments/${p1PaymentId}/mark-paid`, {
    headers: driverAuth,
    body: { amount: 100 },
  });
  check("driver approves extra seat payment -> 201", r.status === 201);
  check("total booking merged to 3 paid seats", r.body?.data?.payment?.status === "PAID" && r.body?.data?.payment?.amountPaid === 300);

  // 10. Passenger 2 re-books the ride when full -> fails because 3 seats are booked by Passenger 1
  r = await request("POST", `/rides/${rideId}/requests`, { headers: p2Auth, body: { seats: 1 } });
  check("passenger 2 cannot re-book when ride is full (3/3 seats booked) -> 400", r.status === 400);

  // 9. Driver tries to cancel ride without reason while Passenger 1 is paid -> must fail
  r = await request("DELETE", `/rides/${rideId}`, {
    headers: driverAuth,
    body: { cancelReason: "" },
  });
  check("driver cancelling paid ride without reason -> 400 (reason required)", r.status === 400);

  // 10. Driver cancels with reason and bKash refund details
  r = await request("DELETE", `/rides/${rideId}`, {
    headers: driverAuth,
    body: {
      cancelReason: "Vehicle breakdown on road",
      refundMethod: "BKASH",
      refundTransactionId: "BKASH-REFUND-001",
    },
  });
  check("driver cancels with reason and refund -> 200", r.status === 200, JSON.stringify(r.body));
  check("ride status set to pending_cancellation", r.body?.data?.status === "pending_cancellation");

  // 11. Passenger 1 confirms refund
  r = await request("POST", `/ride-payments/${p1PaymentId}/refund/confirm`, { headers: p1Auth });
  check("passenger 1 confirms refund -> 200", r.status === 200);
  check("payment status is REFUNDED", r.body?.data?.status === "REFUNDED");

  // 12. Driver cancels an empty ride (no passengers) -> reason not required
  r = await request("POST", "/rides", {
    headers: driverAuth,
    body: { pickup: "Uttara 10", dropoff: "BracU", departureTime: "12:00", seats: 2, charge: 50 },
  });
  const emptyRideId = r.body?.data?._id;

  r = await request("DELETE", `/rides/${emptyRideId}`, { headers: driverAuth });
  check("driver cancels empty ride with 0 passengers without reason -> 200", r.status === 200);
  check("empty ride cancelled immediately", r.body?.data?.status === "cancelled");

  const mongoose = require("mongoose");
  await mongoose.disconnect();
  await mongo.stop();

  if (failures === 0) {
    console.log("\nALL RIDE PAYMENT SMOKE TESTS PASSED");
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
