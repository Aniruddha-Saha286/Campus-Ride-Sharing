const { spawn } = require("child_process");
const path = require("path");

const TEST_FILES = [
  "01_profile.test.js",
  "02_admin_verification.test.js",
  "03_rides.test.js",
  "04_recurring_rides.test.js",
  "05_contact_privacy.test.js",
  "06_payments.test.js",
  "07_ride_history.test.js",
  "08_chat.test.js",
  "09_ride_payment_smoke.test.js",
  "10_safety_reports_smoke.test.js",
  "11_user_feedback_smoke.test.js",
];

const runTest = (file) =>
  new Promise((resolve) => {
    const filePath = path.join(__dirname, file);
    const proc = spawn(process.execPath, [filePath], {
      stdio: "inherit",
      env: process.env,
    });

    proc.on("close", (code) => {
      resolve({ file, code });
    });
  });

const main = async () => {
  console.log("=========================================");
  console.log("  Running Modular Backend Test Suites");
  console.log("=========================================\n");

  const results = [];

  for (const file of TEST_FILES) {
    console.log(`\n>>> Running test: ${file}`);
    const res = await runTest(file);
    results.push(res);
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("\n=========================================");
  console.log("  Test Results Summary");
  console.log("=========================================");

  let failedCount = 0;
  for (const { file, code } of results) {
    if (code === 0) {
      console.log(`  ✓ PASS: ${file}`);
    } else {
      failedCount += 1;
      console.log(`  ✗ FAIL: ${file} (Exit Code ${code})`);
    }
  }

  console.log("=========================================");
  if (failedCount === 0) {
    console.log("🎉 ALL MODULAR TEST SUITES PASSED!\n");
    process.exit(0);
  } else {
    console.log(`❌ ${failedCount} SUITE(S) FAILED.\n`);
    process.exit(1);
  }
};

main();
