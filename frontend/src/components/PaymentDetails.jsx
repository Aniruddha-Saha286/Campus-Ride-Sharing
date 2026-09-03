import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  X,
  BadgeCheck,
  Wallet,
  CreditCard,
  HandCoins,
  Receipt,
  Check,
  Download,
  Clock3,
  FileText,
  CheckCircle2,
  Hourglass,
  Inbox,
  Copy,
  Smartphone,
} from "lucide-react";
import {
  getPaymentRequest,
  recordBkashPayment,
  recordManualPayment,
  verifyManualPayment,
} from "../api/paymentRequestApi";
import { downloadReceiptPdf } from "../utils/pdf";

const STATUS_META = {
  PAID: { label: "Paid", classes: "bg-emerald-50 text-emerald-700" },
  PARTIALLY_PAID: { label: "Partially Paid", classes: "bg-sky-50 text-sky-700" },
  UNPAID: { label: "Unpaid", classes: "bg-amber-50 text-amber-700" },
};

const PAYMENT_STATUS_META = {
  COMPLETED: { label: "Completed", classes: "bg-emerald-50 text-emerald-700" },
  PENDING_VERIFICATION: { label: "Pending Verification", classes: "bg-amber-50 text-amber-700" },
  VERIFIED: { label: "Verified", classes: "bg-sky-50 text-sky-700" },
  REJECTED: { label: "Rejected", classes: "bg-rose-50 text-rose-700" },
};

const formatTaka = (value) =>
  `৳${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const formatDateTime = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMethod = (method) => (method === "BKASH" ? "bKash (Online)" : "Manual / Offline");

const ReceiptModal = ({ receipt, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Receipt size={16} className="text-emerald-600" /> Payment receipt
        </h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-5 py-5">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center">
          <CheckCircle2 size={28} className="mx-auto text-emerald-600" />
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {formatTaka(receipt.amount)}
          </p>
          <p className="text-xs font-semibold text-emerald-700">Payment successful</p>
        </div>
        <div className="mt-4 space-y-2.5 text-sm">
          <Row label="Request ID" value={receipt.requestCode} />
          <Row label="Requester" value={receipt.requester?.name} />
          <Row label="Payer" value={receipt.payer?.name} />
          <Row label="Amount paid" value={formatTaka(receipt.amount)} />
          <Row label="Method" value={formatMethod(receipt.method)} />
          <Row label="Transaction / Reference" value={receipt.reference} />
          <Row label="Date & time" value={formatDateTime(receipt.paidAt)} />
          <Row label="Remaining balance" value={formatTaka(receipt.summary?.remaining)} />
          <Row label="Status" value={STATUS_META[receipt.summary?.status]?.label || receipt.summary?.status} />
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-5 py-4">
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
        >
          Close
        </button>
        <button
          onClick={() => downloadReceiptPdf(receipt)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <Download size={15} />
          Download PDF
        </button>
      </div>
    </div>
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4">
    <p className="text-xs font-semibold text-slate-400">{label}</p>
    <p className="text-right text-sm font-semibold text-slate-800">{value || "—"}</p>
  </div>
);

export default function PaymentDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payError, setPayError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [busy, setBusy] = useState("");
  const [bkashAmount, setBkashAmount] = useState("");
  const [bkashTrxId, setBkashTrxId] = useState("");
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualReference, setManualReference] = useState("");
  const [receipt, setReceipt] = useState(null);

  const load = async () => {
    setError("");
    try {
      const res = await getPaymentRequest(id);
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load the payment request.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full px-6 py-10 lg:px-10">
        <div className="mx-auto w-full max-w-4xl">
          {error && (
            <div className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  const meta = STATUS_META[data.status] || STATUS_META.UNPAID;
  const remaining = data.summary?.remaining || 0;

  const handleCopyPhone = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setPhoneCopied(true);
    setTimeout(() => setPhoneCopied(false), 2000);
  };

  const payWithBkash = async () => {
    if (!bkashTrxId.trim()) {
      setPayError("Please enter the bKash Transaction ID (TrxID).");
      return;
    }
    setBusy("bkash");
    setPayError("");
    try {
      const res = await recordBkashPayment(id, remaining, bkashTrxId.trim());
      const { payment, summary } = res.data.data;
      await load();
      setBkashTrxId("");
      setReceipt({
        requestCode: data.requestCode,
        requester: data.requester,
        payer: data.payer,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        paidAt: payment.paidAt,
        summary,
      });
    } catch (err) {
      setPayError(err.response?.data?.message || "bKash payment failed.");
    } finally {
      setBusy("");
    }
  };

  const recordManual = async () => {
    setBusy("manual");
    setPayError("");
    try {
      await recordManualPayment(id, Number(manualAmount), manualReference);
      await load();
      setManualAmount("");
      setManualReference("");
    } catch (err) {
      setPayError(err.response?.data?.message || "Could not record the manual payment.");
    } finally {
      setBusy("");
    }
  };

  const verify = async (paymentId, decision) => {
    setBusy(paymentId);
    setHistoryError("");
    try {
      await verifyManualPayment(id, paymentId, decision);
      await load();
    } catch (err) {
      setHistoryError(err.response?.data?.message || "Could not update the payment.");
    } finally {
      setBusy("");
    }
  };

  const downloadPaymentReceipt = (payment) => {
    const countedStatuses = ["COMPLETED", "VERIFIED"];
    const countedSoFar = data.payments
      .filter((p) => countedStatuses.includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0);
    const summary = {
      amountDue: data.summary.amountDue,
      amountPaid: countedSoFar,
      remaining: Math.max(0, Number(data.summary.amountDue) - countedSoFar),
      status: data.status,
    };
    downloadReceiptPdf({
      requestCode: data.requestCode,
      requester: data.requester,
      payer: data.payer,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      paidAt: payment.paidAt,
      summary,
    });
  };

  const paymentInputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          to="/payments"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
        >
          <ArrowLeft size={16} />
          Back to payment requests
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-y-2">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
              <Wallet size={22} className="text-brand-600" /> Payment Details
            </h1>
            <p className="mt-1 font-mono text-xs font-bold text-slate-400">
              {data.requestCode}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.classes}`}>
            {meta.label}
          </span>
        </div>

        {error && (
          <div className="mt-5 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Requested by
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-slate-800">
                {data.requester?.name || "—"}
                {data.requester?.idVerified && (
                  <BadgeCheck size={14} className="fill-brand-600 text-white" />
                )}
              </p>
            </div>
            <ArrowLeft size={16} className="rotate-180 text-slate-300" />
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                To be paid by
              </p>
              <p className="mt-1 flex items-center justify-end gap-1 text-sm font-bold text-slate-800">
                {data.payer?.name || "—"}
                {data.payer?.idVerified && (
                  <BadgeCheck size={14} className="fill-brand-600 text-white" />
                )}
              </p>
            </div>
          </div>
          {data.description && (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {data.description}
            </p>
          )}
          {data.dueDate && (
            <p className="mt-3 flex items-center gap-1 text-xs text-slate-400">
              <Clock3 size={12} /> Due by{" "}
              {new Date(data.dueDate).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
          {data.role === "requester" && (
            <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
              You expect to receive {formatTaka(remaining)} from {data.payer?.name || "them"} (
              {formatTaka(data.summary?.amountPaid)} received so far).
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Amount due</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900">
              {formatTaka(data.summary?.amountDue)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Amount paid</p>
            <p className="mt-1 text-lg font-extrabold text-emerald-600">
              {formatTaka(data.summary?.amountPaid)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Remaining</p>
            <p className="mt-1 text-lg font-extrabold text-sky-600">
              {formatTaka(remaining)}
            </p>
          </div>
          <div className={`rounded-2xl border p-4 shadow-card ${meta.classes}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Status</p>
            <p className="mt-1 text-lg font-extrabold">{meta.label}</p>
          </div>
        </div>

        {data.role === "payer" && remaining > 0 && (
          <section className="mt-8">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              <HandCoins size={15} /> Make Payment
            </h2>
            <p className="mb-3 text-xs text-slate-400">
              You still owe {formatTaka(remaining)}. Pay online with bKash or record a manual / offline payment.
            </p>
            {payError && (
              <div className="mb-3 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
                {payError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/60 via-white to-pink-50/40 p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">
                    <Smartphone size={17} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Option A — bKash (Send Money)</h3>
                    <p className="text-xs text-slate-400">Send money directly from your bKash app.</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="flex items-start gap-2.5 rounded-lg border border-rose-100 bg-white p-2.5 text-xs shadow-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-bold text-rose-700 text-[10px]">1</span>
                    <span className="text-slate-700">Open your <strong>bKash App</strong> on your phone.</span>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-rose-100 bg-white p-2.5 text-xs shadow-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-bold text-rose-700 text-[10px]">2</span>
                    <span className="text-slate-700">Go to <strong>Send Money</strong>.</span>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-rose-100 bg-white p-2.5 text-xs shadow-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-bold text-rose-700 text-[10px]">3</span>
                    <div className="flex-1">
                      <span className="text-slate-700 block mb-1">
                        Send <strong>{formatTaka(remaining)}</strong> to requester's phone:
                      </span>
                      <div className="flex items-center justify-between rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                        <span className="font-mono font-bold text-slate-800 text-xs">{data.requester?.phone || "017XXXXXXXX"}</span>
                        {data.requester?.phone && (
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(data.requester.phone)}
                            className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs hover:bg-rose-700"
                          >
                            {phoneCopied ? <Check size={10} /> : <Copy size={10} />}
                            {phoneCopied ? "Copied!" : "Copy"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-rose-100 bg-white p-2.5 text-xs shadow-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 font-bold text-rose-700 text-[10px]">4</span>
                    <div className="flex-1">
                      <span className="text-slate-700 block mb-1.5">Paste the bKash <strong>TrxID</strong>:</span>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={bkashTrxId}
                          onChange={(e) => setBkashTrxId(e.target.value.toUpperCase())}
                          placeholder="e.g. 9M7A8K9L"
                          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider outline-none focus:border-rose-500 bg-white"
                        />
                        <button
                          type="button"
                          onClick={payWithBkash}
                          disabled={busy === "bkash" || !bkashTrxId.trim()}
                          className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 shrink-0"
                        >
                          {busy === "bkash" ? "Submitting..." : "Submit bKash"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <HandCoins size={17} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Option B — Manual / Offline</h3>
                    <p className="text-xs text-slate-400">
                      Record a payment made offline. The requester must verify it.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={remaining}
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder={`Amount (max ${formatTaka(remaining)})`}
                    className={paymentInputClass}
                  />
                  <input
                    value={manualReference}
                    onChange={(e) => setManualReference(e.target.value)}
                    placeholder="Transaction / reference info (required)"
                    maxLength={200}
                    required
                    className={paymentInputClass}
                  />
                  <button
                    onClick={recordManual}
                    disabled={busy === "manual" || !manualAmount || !manualReference}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === "manual" ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                    {busy === "manual" ? "Recording..." : "Record manual payment"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <FileText size={15} /> Payment History
          </h2>
          {historyError && (
            <div className="mb-3 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
              {historyError}
            </div>
          )}
          {data.payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-card">
              <Inbox size={24} className="text-slate-300" />
              <p className="mt-2 text-xs text-slate-400">No payments have been recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Date &amp; time</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Transaction / Reference</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p) => {
                      const pMeta = PAYMENT_STATUS_META[p.status] || PAYMENT_STATUS_META.PENDING_VERIFICATION;
                      const counted = ["COMPLETED", "VERIFIED"].includes(p.status);
                      return (
                        <tr key={p._id} className="border-b border-slate-50 last:border-0">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                            {formatDateTime(p.paidAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-slate-800">
                            {formatTaka(p.amount)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                            {formatMethod(p.method)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">
                            {p.reference || "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pMeta.classes}`}>
                              {pMeta.label}
                            </span>
                            {(p.status === "VERIFIED" || p.status === "REJECTED") && (
                              <p className="mt-1 text-[10px] text-slate-400">
                                {formatDateTime(p.verifiedAt)}
                              </p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {data.role === "requester" && p.status === "PENDING_VERIFICATION" && (
                                <>
                                  <button
                                    onClick={() => verify(p._id, "verified")}
                                    disabled={busy === p._id}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    {busy === p._id ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}
                                    Verify
                                  </button>
                                  <button
                                    onClick={() => verify(p._id, "rejected")}
                                    disabled={busy === p._id}
                                    className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                                  >
                                    <X size={12} />
                                    Reject
                                  </button>
                                </>
                              )}
                              {counted && (
                                <button
                                  onClick={() => downloadPaymentReceipt(p)}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                                >
                                  <Download size={12} />
                                  PDF
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total due</p>
                  <p className="text-sm font-bold text-slate-800">{formatTaka(data.summary?.amountDue)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total paid</p>
                  <p className="text-sm font-bold text-emerald-700">{formatTaka(data.summary?.amountPaid)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Remaining</p>
                  <p className="text-sm font-bold text-sky-700">{formatTaka(remaining)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
                  <p className="text-sm font-bold text-slate-800">{meta.label}</p>
                </div>
              </div>
            </div>
          )}
          {data.payments.some((p) => p.status === "PENDING_VERIFICATION") && data.role === "requester" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <Hourglass size={13} />
              Pending manual payments count toward the total only after you verify them.
            </p>
          )}
        </section>
      </div>

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
