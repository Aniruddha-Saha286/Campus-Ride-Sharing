const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");

process.env.MONGO_URI = null;
process.env.JWT_SECRET = "feedback-smoke-secret";
process.env.PORT = "5911";
process.env.CLIENT_URL = "*";
process.env.GOOGLE_CLIENT_ID = "smoke-client-id.apps.googleusercontent.com";
process.env.ADMIN_EMAIL = "admin@campusride.local";
process.env.ADMIN_PASSWORD = "Admin@12345";

const PORT = 5911;
const BASE = `http://localhost:${PORT}/api`;
const STUDENT_EMAIL = "student.feedback@g.bracu.ac.bd";
const STUDENT_ID = "student-feedback-1";

const VALID_PROFILE = {
  studentId: "20109999",
  name: "Feedback Submitter",
  department: "CSE",
  year: "3rd Year",
  homeArea: "Badda, Dhaka",
  phone: "+8801711999999",
  dateOfBirth: "2003-05-14",
  studentNid: "20030514123456789",
  passport: "AB1234567",
  emergencyContact: { name: "Guardian", relation: "Parent", phone: "01799000000" },
  parentInfo: {
    fatherName: "Father",
    fatherPhone: "01711111111",
    motherName: "Mother",
    motherPhone: "01722222222",
  },
  localGuardian: {
    name: "Uncle",
    relation: "Uncle",
    dateOfBirth: "1995-04-12",
    phone: "01733333333",
    address: "House 12, Road 7, Dhaka",
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

const studentToken = jwt.sign({ id: STUDENT_ID, universityEmail: STUDENT_EMAIL }, process.env.JWT_SECRET);
const studentAuth = { Authorization: `Bearer ${studentToken}` };
let adminAuth = {};

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
  } catch (e) {}
  return { status: res.status, body: json, headers: res.headers };
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
  console.log("\n=======================================================");
  console.log("  Smoke Test: Admin User Feedback and Complaints");
  console.log("=======================================================\n");

  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("campus-ride-feedback-test");
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
  check("Server boots and is reachable", up);

  // 1. Setup Student Profile
  let r = await request("POST", "/students/profile", { headers: studentAuth, body: createFormData() });
  check("Student profile created", r.status === 201);
  const studentDbId = r.body?.data?._id;

  // 2. Admin login
  r = await request("POST", "/admin/login", {
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  });
  check("Admin login successful", r.status === 200 && Boolean(r.body?.token));
  adminAuth = { Authorization: `Bearer ${r.body?.token}` };

  // 3. Admin approves verification
  r = await request("PUT", `/admin/verifications/${studentDbId}`, {
    headers: adminAuth,
    body: { decision: "approved" },
  });
  check("Admin approves student verification", r.status === 200);

  // 4. Validation: Invalid feedback type
  r = await request("POST", "/feedback", {
    headers: studentAuth,
    body: { type: "RandomType", subject: "Test subject", message: "Test message here" },
  });
  check("Invalid message type rejected with 400 Bad Request", r.status === 400);

  // 5. Validation: Missing subject
  r = await request("POST", "/feedback", {
    headers: studentAuth,
    body: { type: "Complaint", subject: "", message: "Test message here" },
  });
  check("Missing subject rejected with 400 Bad Request", r.status === 400);

  // 6. Validation: Short message (< 5 chars)
  r = await request("POST", "/feedback", {
    headers: studentAuth,
    body: { type: "Complaint", subject: "Valid subject", message: "hi" },
  });
  check("Short message (<5 chars) rejected with 400 Bad Request", r.status === 400);

  // 7. Student submits a Complaint
  r = await request("POST", "/feedback", {
    headers: studentAuth,
    body: {
      type: "Complaint",
      subject: "Driver arrived 30 minutes late without notice",
      message: "The driver did not update status or respond to chat before departure time.",
    },
  });
  check("Student submits Complaint (201 Created)", r.status === 201);
  check("Feedback initialized with status 'Pending'", r.body?.data?.status === "Pending");
  const complaintId = r.body?.data?._id;

  // 8. Student submits a Bug Report
  r = await request("POST", "/feedback", {
    headers: studentAuth,
    body: {
      type: "Bug Report",
      subject: "Map pin dropped 500m away from clicked coordinate",
      message: "On mobile screen, tapping map pins sometimes misplaces by half a kilometer.",
    },
  });
  check("Student submits Bug Report (201 Created)", r.status === 201);
  const bugReportId = r.body?.data?._id;

  // 9. Student retrieves their feedback submissions
  r = await request("GET", "/feedback/my", { headers: studentAuth });
  check("Student fetches their feedbacks (/api/feedback/my)", r.status === 200);
  check("Feedback list contains both submissions", r.body?.data?.length >= 2);

  // 10. Security: Student blocked from Admin feedback endpoint
  r = await request("GET", "/feedback/admin", { headers: studentAuth });
  check("Student blocked from admin feedbacks endpoint with 403 Forbidden", r.status === 403);

  // 11. Admin fetches all feedbacks
  r = await request("GET", "/feedback/admin", { headers: adminAuth });
  check("Admin fetches all user feedbacks", r.status === 200 && Array.isArray(r.body?.data));
  check("Admin list has populated student user details", Boolean(r.body?.data?.[0]?.user?.name));

  // 12. Admin filters by status: Pending
  r = await request("GET", "/feedback/admin?status=pending", { headers: adminAuth });
  check("Admin filters feedbacks by status 'pending'", r.status === 200 && r.body?.data?.every((f) => f.status === "Pending"));

  // 13. Admin filters by type: Complaint
  r = await request("GET", "/feedback/admin?type=Complaint", { headers: adminAuth });
  check("Admin filters feedbacks by type 'Complaint'", r.status === 200 && r.body?.data?.every((f) => f.type === "Complaint"));

  // 14. Admin searches feedback by subject/keyword
  r = await request("GET", "/feedback/admin?search=Map+pin", { headers: adminAuth });
  check("Admin searches by keyword matches bug report", r.status === 200 && r.body?.data?.some((f) => f._id === bugReportId));

  // 15. Admin sends reply to student complaint
  r = await request("PUT", `/feedback/admin/${complaintId}`, {
    headers: adminAuth,
    body: {
      adminReply: "Thank you for reporting. We have given an official warning to the driver.",
      status: "Reviewed",
    },
  });
  check("Admin replies to complaint and updates status to Reviewed (200 OK)", r.status === 200 && r.body?.data?.status === "Reviewed");
  check("Admin reply field correctly saved", r.body?.data?.adminReply?.includes("official warning"));

  // 16. Admin resolves complaint
  r = await request("PUT", `/feedback/admin/${complaintId}`, {
    headers: adminAuth,
    body: { status: "Resolved" },
  });
  check("Admin marks complaint as Resolved (200 OK)", r.status === 200 && r.body?.data?.status === "Resolved");

  // 17. Verify student sees admin reply and Resolved status
  r = await request("GET", "/feedback/my", { headers: studentAuth });
  const myComplaint = r.body?.data?.find((f) => f._id === complaintId);
  check("Student sees updated status 'Resolved'", myComplaint?.status === "Resolved");
  check("Student sees admin response text", myComplaint?.adminReply?.includes("official warning"));

  // 18. Admin deletes a feedback entry
  r = await request("DELETE", `/feedback/admin/${bugReportId}`, { headers: adminAuth });
  check("Admin deletes feedback entry (200 OK)", r.status === 200);

  // 19. Verify deleted item no longer in admin list
  r = await request("GET", "/feedback/admin", { headers: adminAuth });
  check("Deleted feedback is no longer present", !r.body?.data?.some((f) => f._id === bugReportId));

  console.log("\n-------------------------------------------------------");
  if (failures === 0) {
    console.log("🎉 ALL ADMIN USER FEEDBACK AND COMPLAINT TESTS PASSED!\n");
    process.exit(0);
  } else {
    console.log(`❌ ${failures} TEST CHECK(S) FAILED.\n`);
    process.exit(1);
  }
};

main().catch((err) => {
  console.error("Fatal error in feedback smoke test:", err);
  process.exit(1);
});
