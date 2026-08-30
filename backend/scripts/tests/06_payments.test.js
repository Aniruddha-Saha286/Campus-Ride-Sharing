const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "smoke-test-secret";
process.env.PORT = "5906";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5906;
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


  // Setup: Create poster, rider, stranger and admin approve all
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
  const adminAuth = { Authorization: `Bearer ${r.body.token}` };
  
  await request("PUT", `/admin/verifications/${recreatedStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  await request("PUT", `/admin/verifications/${riderStudentId}`, { headers: adminAuth, body: { decision: "approved" } });
  // The stranger is created inside the block below, we let the script do it.
  
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
