const crypto = require("crypto");

const BKASH_SANDBOX = process.env.BKASH_SANDBOX !== "false";
const BKASH_BASE_URL = BKASH_SANDBOX
  ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta"
  : "https://tokenized.pay.bka.sh/v1.2.0-beta";
const BKASH_APP_KEY = process.env.BKASH_APP_KEY || "";
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET || "";
const BKASH_USERNAME = process.env.BKASH_USERNAME || "";
const BKASH_PASSWORD = process.env.BKASH_PASSWORD || "";

let cachedToken = null;
let tokenExpiry = 0;
const mockTrxCache = new Map();

const grantToken = async () => {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  if (BKASH_SANDBOX && (!BKASH_APP_KEY || BKASH_APP_KEY === "your_bkash_app_key")) {
    return { id_token: `mock-bkash-token-${Date.now()}`, token_type: "Bearer", expires_in: 3600 };
  }

  const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Key": BKASH_APP_KEY },
    body: JSON.stringify({ app_key: BKASH_APP_KEY, app_secret: BKASH_APP_SECRET }),
  });
  const data = await res.json();
  if (!data.id_token) {
    throw new Error(data.statusMessage || "Failed to grant bKash token");
  }
  cachedToken = { id_token: data.id_token, token_type: data.token_type };
  tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  return cachedToken;
};

const createPayment = async ({ amount, payerReference, callbackURL, invoiceNumber }) => {
  const token = await grantToken();

  if (BKASH_SANDBOX && (!BKASH_APP_KEY || BKASH_APP_KEY === "your_bkash_app_key")) {
    return {
      paymentID: `mock-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      bkashURL: null,
      amount,
      transactionStatus: "Initiated",
    };
  }

  const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token.id_token,
      "X-App-Key": BKASH_APP_KEY,
    },
    body: JSON.stringify({
      mode: "0001",
      payerReference: payerReference || "",
      callbackURL,
      amount: String(amount),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: invoiceNumber || `INV-${Date.now()}`,
    }),
  });
  const data = await res.json();
  if (data.statusCode !== "0000") {
    throw new Error(data.statusMessage || "bKash create payment failed");
  }
  return {
    paymentID: data.paymentID,
    bkashURL: data.bkashURL,
    amount,
    transactionStatus: data.transactionStatus,
  };
};

const executePayment = async (paymentIDOrOpts) => {
  const token = await grantToken();
  const paymentID = typeof paymentIDOrOpts === "string" ? paymentIDOrOpts : paymentIDOrOpts?.paymentID;

  if (BKASH_SANDBOX && (!BKASH_APP_KEY || BKASH_APP_KEY === "your_bkash_app_key")) {
    if (typeof paymentIDOrOpts === "object" && !paymentID) {
      return {
        transactionId: generateTrxId(),
        amount: paymentIDOrOpts.amount,
        paymentStatus: "COMPLETED",
        paymentID: `mock-${Date.now()}`,
        payerId: paymentIDOrOpts.payerId,
      };
    }
    if (!mockTrxCache.has(paymentID)) {
      mockTrxCache.set(paymentID, `BKASH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`);
    }
    return {
      paymentID,
      trxID: mockTrxCache.get(paymentID),
      amount: "0",
      transactionStatus: "Completed",
      paymentExecuteTime: new Date().toISOString(),
    };
  }

  const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token.id_token,
      "X-App-Key": BKASH_APP_KEY,
    },
    body: JSON.stringify({ paymentID }),
  });
  const data = await res.json();
  if (data.statusCode !== "0000") {
    throw new Error(data.statusMessage || "bKash execute payment failed");
  }
  return {
    paymentID: data.paymentID,
    trxID: data.trxID,
    amount: data.amount,
    transactionStatus: data.transactionStatus,
    paymentExecuteTime: data.paymentExecuteTime,
    customerMsisdn: data.customerMsisdn,
  };
};

const queryPayment = async (paymentID) => {
  const token = await grantToken();

  if (BKASH_SANDBOX && (!BKASH_APP_KEY || BKASH_APP_KEY === "your_bkash_app_key")) {
    return { paymentID, transactionStatus: "Completed" };
  }

  const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/payment/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token.id_token,
      "X-App-Key": BKASH_APP_KEY,
    },
    body: JSON.stringify({ paymentID }),
  });
  return res.json();
};

const generateTrxId = () =>
  `BKASH-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

module.exports = { createPayment, executePayment, queryPayment, grantToken, generateTrxId };
