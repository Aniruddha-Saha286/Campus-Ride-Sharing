import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Clock3,
  Loader2,
  BadgeCheck,
  Wallet,
  FileDown,
  HandCoins,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  X,
  Inbox,
  Lock,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import {
  getRidePaymentDetails,
  recordManualPayment,
  markManualPaid,
  initiateBkashPayment,
  verifyBkashPayment,
  selectPaymentMethod,
  submitManualStatus,
  markDue,
  setPaymentAmount,
  requestRefund,
  cancelRefundRequest,
  confirmRefund,
  driverConfirmRefund,
  passengerCancelRide,
  getTransactionReceipt,
} from "../api/ridePaymentApi";
import { downloadTransactionReceiptPdf } from "../utils/ridePaymentPdf";
import usePolling from "../hooks/usePolling";

const formatTaka = (value) =>
  `৳${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STATUS_META = {
  PAID: { label: "Paid", classes: "bg-emerald-50 text-emerald-700" },
  PARTIAL: { label: "Partially paid", classes: "bg-sky-50 text-sky-700" },
  PENDING: { label: "Pending", classes: "bg-amber-50 text-amber-700" },
  DUE: { label: "Due", classes: "bg-orange-50 text-orange-700" },
  OVERDUE: { label: "Overdue", classes: "bg-rose-50 text-rose-700" },
  REFUND_REQUESTED: { label: "Refund requested", classes: "bg-violet-50 text-violet-700" },
  REFUNDED: { label: "Refunded", classes: "bg-slate-100 text-slate-600" },
  CANCELLED: { label: "Cancelled", classes: "bg-slate-100 text-slate-500" },
};

const MANUAL_OPTIONS = [
  {
    value: "PENDING",
    title: "Keep pending",
    hint: "Payment outcome is not decided yet. You cannot change this later.",
  },
];

export default function RidePaymentDetails() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [manualRef, setManualRef] = useState("");
  const [markOpen, setMarkOpen] = useState(false);
  const [markAmount, setMarkAmount] = useState("");
  const [markRef, setMarkRef] = useState("");
  const [bkashPaymentID, setBkashPaymentID] = useState("");
  const [bkashAmount, setBkashAmount] = useState("");
  const [bkashTrxId, setBkashTrxId] = useState("");
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [dueAmount, setDueAmount] = useState("");
  const [dueOpen, setDueOpen] = useState(false);
  const [confirmRefundOpen, setConfirmRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [driverConfirmRefundOpen, setDriverConfirmRefundOpen] = useState(false);
  const [driverRefundMethod, setDriverRefundMethod] = useState("BKASH");
  const [driverRefundTxnId, setDriverRefundTxnId] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await getRidePaymentDetails(paymentId);
      setPayment(res.data.data);
      if (!bkashPaymentID && !["PAID", "REFUND_REQUESTED", "REFUNDED", "CANCELLED"].includes(res.data.data.status)) {
        setBkashAmount(String(res.data.data.totalOutstanding || ""));
      }
      setDueAmount(String(res.data.data.totalOutstanding || ""));
    } catch (err) {
      setError(err.response?.data?.message || "Could not load this payment.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  useEffect(() => {
    const bkashStatus = searchParams.get("bkash");
    if (bkashStatus) {
      setSearchParams({}, { replace: true });
      if (bkashStatus === "success") {
        load();
      } else if (bkashStatus === "failed") {
        setError("bKash payment was not completed. Please try again.");
      } else {
        setError("Something went wrong with the bKash payment. Please try again.");
      }
    }
  }, [searchParams]);

  const openManual = () => {
    setManualAmount(String(payment?.totalOutstanding || ""));
    setManualRef("");
    setManualOpen(true);
  };

  const submitManual = async (e) => {
    e.preventDefault();
    setBusy("manual");
    setError("");
    try {
      await recordManualPayment(paymentId, Number(manualAmount), manualRef);
      setManualOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not record the payment.");
    } finally {
      setBusy("");
    }
  };

  const openMark = () => {
    setMarkAmount(String(payment?.totalOutstanding || ""));
    setMarkRef("");
    setMarkOpen(true);
  };

  const submitMark = async (e) => {
    e.preventDefault();
    setBusy("mark");
    setError("");
    try {
      await markManualPaid(paymentId, markAmount ? Number(markAmount) : undefined, markRef);
      setMarkOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not mark the payment as paid.");
    } finally {
      setBusy("");
    }
  };

  const pickMethod = async (method) => {
    setBusy(method);
    setError("");
    try {
      await selectPaymentMethod(paymentId, method);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not select the payment method.");
    } finally {
      setBusy("");
    }
  };

  const pickManualStatus = async (status) => {
    setBusy(`manual-status-${status}`);
    setError("");
    try {
      await submitManualStatus(paymentId, status);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not set the manual status.");
    } finally {
      setBusy("");
    }
  };

  const submitDueAmount = async () => {
    setBusy("due-amount");
    setError("");
    try {
      await setPaymentAmount(paymentId, Number(dueAmount));
      setDueOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the amount due.");
    } finally {
      setBusy("");
    }
  };

  const handleCopyPhone = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setPhoneCopied(true);
    setTimeout(() => setPhoneCopied(false), 2000);
  };

  const submitBkashPayment = async () => {
    if (!bkashTrxId.trim()) {
      setError("Please enter the bKash Transaction ID (TrxID).");
      return;
    }
    setBusy("bkash-submit");
    setError("");
    try {
      await verifyBkashPayment(paymentId, bkashTrxId.trim());
      setSuccess("bKash payment confirmed successfully!");
      setBkashTrxId("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not confirm bKash payment.");
    } finally {
      setBusy("");
    }
  };

  const doRequestRefund = async () => {
    setBusy("request-refund");
    setError("");
    try {
      await requestRefund(paymentId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not request the refund.");
    } finally {
      setBusy("");
    }
  };

  const doCancelRefund = async () => {
    setBusy("cancel-refund");
    setError("");
    try {
      await cancelRefundRequest(paymentId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel the refund request.");
    } finally {
      setBusy("");
    }
  };

  const doConfirmRefund = async () => {
    setBusy("confirm-refund");
    setError("");
    try {
      await confirmRefund(paymentId);
      setConfirmRefundOpen(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not confirm the refund.");
    } finally {
      setBusy("");
    }
  };

  const doDriverConfirmRefund = async () => {
    setBusy("driver-confirm-refund");
    setError("");
    try {
      await driverConfirmRefund(paymentId, driverRefundMethod, driverRefundMethod === "BKASH" ? driverRefundTxnId : undefined);
      setDriverConfirmRefundOpen(false);
      setDriverRefundTxnId("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not confirm the refund.");
    } finally {
      setBusy("");
    }
  };

  const doPassengerCancel = async () => {
    setBusy("passenger-cancel");
    setError("");
    setSuccess("");
    try {
      const res = await passengerCancelRide(paymentId);
      setCancelOpen(false);
      if (res.data?.refundPending) {
        setSuccess("Refund request sent to the driver. You will be refunded once the driver confirms.");
      } else if (res.data?.fine > 0) {
        setSuccess(`Ride cancelled. Fine of ${formatTaka(res.data.fine)} has been applied.`);
      } else {
        setSuccess("Ride cancelled successfully.");
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel the ride.");
    } finally {
      setBusy("");
    }
  };

  const downloadReceipt = async (id) => {
    setBusy(id);
    setError("");
    try {
      const res = await getTransactionReceipt(id);
      downloadTransactionReceiptPdf(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not fetch the receipt.");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="w-full px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => navigate("/dashboard")}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
          >
            <ArrowLeft size={16} /> Back to dashboard
          </button>
          <div className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
            {error || "Payment not found."}
          </div>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[payment.status] || STATUS_META.PENDING;
  const isPayer = payment.role === "payer";
  const isReceiver = payment.role === "receiver";
  const terminal = ["REFUND_REQUESTED", "REFUNDED", "CANCELLED"].includes(payment.status);

  const amountBox = (label, value, tone) => (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${tone || "text-slate-800"}`}>{value}</p>
    </div>
  );

  const personRow = (label, person) => (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white">
        {person?.profilePhoto ? (
          <img src={person.profilePhoto} alt={person.name} className="h-full w-full object-cover" />
        ) : (
          (person?.name || "?").trim().charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-800">{label}</p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <span className="truncate">{person?.name || "—"}</span>
          {person?.idVerified && <BadgeCheck size={12} className="shrink-0 fill-brand-600 text-white" />}
        </p>
      </div>
    </div>
  );

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <button
          onClick={() => navigate(isReceiver && payment.ride ? `/rides/${payment.ride._id}/payments` : "/dashboard")}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {error && (
          <div className="mb-5 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-200/80 px-4 py-2.5 text-sm font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-y-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
                <Wallet size={22} className="text-brand-600" /> Payment
              </h1>
              {payment.ride ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                  <span className="flex items-center gap-1 font-medium text-slate-800">
                    <MapPin size={13} className="text-brand-500" /> {payment.ride.pickup}
                  </span>
                  <Navigation size={13} className="text-slate-300" />
                  <span className="flex items-center gap-1 font-medium text-slate-800">{payment.ride.dropoff}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock3 size={12} /> {payment.ride.departureTime}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Manual due</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.classes}`}>{meta.label}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {isPayer ? "You are paying" : "You receive"}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {amountBox(
              payment.seats > 1 ? `Original charge (${payment.seats} seats)` : "Original charge",
              formatTaka(payment.originalAmount)
            )}
            {amountBox("Paid", formatTaka(payment.amountPaid), payment.amountPaid > 0 ? "text-emerald-600" : "")}
            {amountBox("Due", formatTaka(payment.remainingAmount), payment.remainingAmount > 0 ? "text-rose-600" : "text-emerald-600")}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {amountBox("Method", payment.paymentMethod === "MANUAL" ? "Manual" : payment.paymentMethod === "BKASH" ? "bKash" : "Not selected")}
            {amountBox(
              "Late fee",
              formatTaka(Math.max(0, payment.lateFee - (payment.lateFeePaid || 0))),
              payment.lateFee - (payment.lateFeePaid || 0) > 0 ? "text-rose-600" : ""
            )}
            {amountBox(
              "Seats",
              String(payment.seats || 1),
              ""
            )}
          </div>

          {payment.lateFee > (payment.lateFeePaid || 0) && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              <AlertTriangle size={13} className="shrink-0" />
              Late fee of {formatTaka(Math.max(0, payment.lateFee - (payment.lateFeePaid || 0)))} is still owed. Total
              due is {formatTaka(payment.totalOutstanding)}.
            </div>
          )}

          {payment.status === "REFUNDED" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <CheckCircle2 size={13} className="shrink-0" />
              Refund confirmed by the payer on {formatDate(payment.refundConfirmedAt)}. This payment is closed and
              contributes ৳0 to outstanding due.
            </div>
          )}

          {payment.status === "CANCELLED" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <AlertTriangle size={13} className="shrink-0" />
              This obligation was voided when the ride was cancelled. Due is ৳0.
            </div>
          )}

          {payment.status === "REFUND_REQUESTED" && (
            <div className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700">
              <div className="flex items-center gap-2">
                <RefreshCcw size={13} className="shrink-0" />
                {isPayer
                  ? `The ride owner refunded ${formatTaka((payment.amountPaid || 0) + (payment.lateFeePaid || 0))} via ${payment.refundMethod === "BKASH" ? "bKash" : "manual settlement"}. Click "Got refund" once you receive it.`
                  : `You requested a refund${payment.refundMethod ? ` via ${payment.refundMethod === "BKASH" ? "bKash" : "manual"}` : ""}. Waiting for the passenger to confirm receipt.`}
              </div>
              {payment.refundMethod === "BKASH" && payment.refundTransactionId && (
                <p className="mt-1 text-[11px] text-violet-600">
                  Transaction reference: <span className="font-bold">{payment.refundTransactionId}</span>
                </p>
              )}
              {payment.canCancelRefund && (
                <button
                  onClick={doCancelRefund}
                  disabled={busy === "cancel-refund"}
                  className="mt-2 flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                >
                  {busy === "cancel-refund" ? <Loader2 className="animate-spin" size={12} /> : <X size={12} />}
                  Cancel refund request
                </button>
              )}
            </div>
          )}

          {payment.finalized && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <Lock size={13} className="shrink-0" />
              Finalized on {formatDate(payment.finalizedAt)} as {payment.manualStatus || "decided"}. The status cannot be
              changed anymore.
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {personRow("Payer", payment.payer)}
            {personRow("Receiver", payment.receiver)}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Due date {formatDate(payment.dueDate)}
            {payment.lastPaymentDate ? ` · Last payment ${formatDate(payment.lastPaymentDate)}` : ""}
          </p>

          {payment.canPayOnline && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/80 via-white to-pink-50/40 p-5 shadow-xs">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                  <Smartphone size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pay via bKash (Send Money)</h3>
                  <p className="text-xs text-slate-500">Follow the steps below to complete your payment</p>
                </div>
              </div>

              {/* 4 Steps */}
              <div className="space-y-2.5 my-4">
                {/* Step 1 */}
                <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-white p-3 shadow-xs">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                    1
                  </span>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    Go to your <strong className="text-rose-600">bKash App</strong> on your phone.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-white p-3 shadow-xs">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                    2
                  </span>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    Go to <strong className="text-rose-600">"Send Money"</strong>.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-white p-3 shadow-xs">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                    3
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-700">
                      Copy driver's phone number and send <strong className="text-rose-600">{formatTaka(payment.originalAmount)}</strong> to him:
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Driver's bKash Number</span>
                        <span className="text-sm font-mono font-bold text-slate-800">
                          {payment.receiver?.phone || "017XXXXXXXX"}
                        </span>
                      </div>
                      {payment.receiver?.phone && (
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(payment.receiver.phone)}
                          className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700"
                        >
                          {phoneCopied ? <Check size={12} /> : <Copy size={12} />}
                          {phoneCopied ? "Copied!" : "Copy Number"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-white p-3 shadow-xs">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                    4
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      Paste the bKash <strong>Transaction ID (TrxID)</strong> here:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={bkashTrxId}
                        onChange={(e) => setBkashTrxId(e.target.value.toUpperCase())}
                        placeholder="e.g. 9M7A8K9L"
                        className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-mono font-bold tracking-wider text-slate-800 uppercase outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 bg-white"
                      />
                      <button
                        type="button"
                        onClick={submitBkashPayment}
                        disabled={busy === "bkash-submit" || !bkashTrxId.trim()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {busy === "bkash-submit" ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        Submit bKash Payment
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isPayer && payment.status !== "PAID" && !terminal && (
            <button
              onClick={openManual}
              disabled={busy !== ""}
              className="mt-4 flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-60"
            >
              <HandCoins size={15} />
              Record manual payment
            </button>
          )}
        </div>

        {payment.canSelectMethod && (
          <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Choose payment method</h2>
            <p className="mb-4 text-xs text-slate-400">
              Select how you will settle this payment. This is stored with the payment.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => pickMethod("BKASH")}
                disabled={busy !== ""}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-rose-300 hover:bg-rose-50/50 disabled:opacity-60"
              >
                <Smartphone size={20} className="shrink-0 text-rose-600" />
                <span>
                  <span className="block text-sm font-bold text-slate-800">bKash</span>
                  <span className="block text-xs text-slate-500">Pay online through the bKash app.</span>
                </span>
              </button>
              <button
                onClick={() => pickMethod("MANUAL")}
                disabled={busy !== ""}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
              >
                <HandCoins size={20} className="shrink-0 text-slate-600" />
                <span>
                  <span className="block text-sm font-bold text-slate-800">Manual</span>
                  <span className="block text-xs text-slate-500">Cash or manual settlement between the two of you.</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {payment.canSubmitManualStatus && (
          <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Settle manually</h2>
            <p className="mb-4 text-xs text-slate-400">
              Confirm the outcome of the manual payment. This is a one-time decision and cannot be changed afterwards.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MANUAL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => pickManualStatus(option.value)}
                  disabled={busy !== ""}
                  className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
                >
                  <span className="block text-sm font-bold text-slate-800">{option.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(payment.canMarkPaid || payment.canMarkDue) && (
          <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Driver action</h2>
            <p className="mb-4 text-xs text-slate-400">
              Confirm the payment is settled, or mark how much is still due.
            </p>
            <div className="flex flex-wrap gap-3">
              {payment.canMarkPaid && (
                <button
                  onClick={openMark}
                  disabled={busy !== ""}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 size={15} />
                  Mark as paid
                </button>
              )}
              {payment.canMarkDue && (
                <button
                  onClick={() => {
                    setDueAmount(String(payment.totalOutstanding || ""));
                    setDueOpen(true);
                  }}
                  disabled={busy !== ""}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
                >
                  <AlertTriangle size={15} />
                  Set due
                </button>
              )}
            </div>
          </div>
        )}

        {payment.manualStatus === "DUE" && !payment.canMarkDue && payment.status !== "PAID" && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-xs font-semibold text-amber-700">
            <AlertTriangle size={13} />
            The ride owner marked this payment as due — the amount is still owed.
          </div>
        )}

        {payment.canRequestRefund && (
          <div className="mb-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
            <h2 className="text-sm font-bold text-violet-800">Refund</h2>
            <p className="mt-1 text-xs text-violet-700">
              You want to cancel this ride, but this passenger has already paid. Refund them so they can confirm receipt,
              then cancel the ride.
            </p>
            <button
              onClick={doRequestRefund}
              disabled={busy === "request-refund"}
              className="mt-3 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
            >
              {busy === "request-refund" ? <Loader2 className="animate-spin" size={15} /> : <RefreshCcw size={15} />}
              Refunded
            </button>
          </div>
        )}

        {payment.canConfirmRefund && (
          <div className="mb-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
            <h2 className="text-sm font-bold text-violet-800">Got refund?</h2>
            <p className="mt-1 text-xs text-violet-700">
              The ride owner refunded {formatTaka((payment.amountPaid || 0) + (payment.lateFeePaid || 0))}
              {payment.refundMethod ? ` via ${payment.refundMethod === "BKASH" ? "bKash" : "manual settlement"}` : ""}.
              {payment.refundMethod === "BKASH" && payment.refundTransactionId
                ? ` Transaction ref: ${payment.refundTransactionId}.`
                : ""}{" "}
              Click once you receive the money, so the driver can cancel the ride.
            </p>
            <button
              onClick={() => setConfirmRefundOpen(true)}
              disabled={busy !== ""}
              className="mt-3 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
            >
              <CheckCircle2 size={15} />
              Got refund
            </button>
          </div>
        )}

        {payment.canPassengerCancel && (
          <div className="mb-5 rounded-2xl border border-rose-100 bg-rose-50/40 p-5">
            <h2 className="text-sm font-bold text-rose-800">Cancel ride</h2>
            <p className="mt-1 text-xs text-rose-700">
              Cancel your participation in this ride.
              {payment.amountPaid > 0
                ? " If you have already paid, a refund will be automatically requested from the driver."
                : " Free within 20 minutes of the driver accepting. After that, a fine of ৳100 per 15 minutes applies."}
            </p>
            <button
              onClick={() => setCancelOpen(true)}
              disabled={busy !== ""}
              className="mt-3 flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
            >
              <XCircle size={15} />
              {payment.amountPaid > 0 ? "Cancel & request refund" : "Cancel ride"}
            </button>
          </div>
        )}

        {payment.canDriverConfirmRefund && (
          <div className="mb-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
            <h2 className="text-sm font-bold text-violet-800">Passenger refund request</h2>
            <p className="mt-1 text-xs text-violet-700">
              The passenger cancelled and requested a refund. Choose how you will return the money.
            </p>
            <button
              onClick={() => setDriverConfirmRefundOpen(true)}
              disabled={busy !== ""}
              className="mt-3 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
            >
              <RefreshCcw size={15} />
              Process refund
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Payment transactions
          </h2>
          {payment.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <Inbox size={20} className="text-slate-300" />
              <p className="mt-2 text-xs text-slate-400">No payments recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {payment.transactions.map((t) => (
                <div key={t._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-slate-700">
                      {t.transactionId}{" "}
                      <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {t.kind === "FINE" ? "Fine" : t.kind === "REFUND" ? "Refund" : t.method === "BKASH" ? "bKash" : "Manual"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatDate(t.createdAt)}
                      {t.providerTransactionId ? ` · ${t.providerTransactionId}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold text-slate-800">{formatTaka(t.amount)}</span>
                    <button
                      onClick={() => downloadReceipt(t._id)}
                      disabled={busy === t._id}
                      title="Download receipt"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    >
                      {busy === t._id ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <HandCoins size={16} /> Record manual payment
              </h3>
              <button onClick={() => setManualOpen(false)} className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitManual} className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Amount (BDT)</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={payment.totalOutstanding}
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Maximum {formatTaka(payment.totalOutstanding)} is left due.
                </p>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Transaction Reference
                </span>
                <input
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value)}
                  placeholder="e.g. bKash txn ID, cash receipt number"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  disabled={busy === "manual"}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === "manual" || !manualAmount || !manualRef}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-60"
                >
                  {busy === "manual" ? <Loader2 className="animate-spin" size={15} /> : <HandCoins size={15} />}
                  Record payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {markOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <CheckCircle2 size={16} /> Mark as paid
              </h3>
              <button onClick={() => setMarkOpen(false)} className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitMark} className="space-y-4 px-5 py-5">
              <p className="text-sm text-slate-500">
                Confirm you received this payment. The amount below will be added to what the payer has paid.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Amount received (BDT)</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={payment.totalOutstanding}
                  value={markAmount}
                  onChange={(e) => setMarkAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Leave blank to mark the full remaining {formatTaka(payment.totalOutstanding)} as paid.
                </p>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Transaction Reference
                </span>
                <input
                  value={markRef}
                  onChange={(e) => setMarkRef(e.target.value)}
                  placeholder="e.g. bKash txn ID, cash receipt number"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setMarkOpen(false)}
                  disabled={busy === "mark"}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === "mark" || !markRef}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy === "mark" ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                  Confirm payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <AlertTriangle size={16} /> Set due amount
              </h3>
              <button onClick={() => setDueOpen(false)} className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitDueAmount();
              }}
              className="space-y-4 px-5 py-5"
            >
              <p className="text-sm text-slate-500">
                Enter the amount the passenger still owes. This will appear in their due section and update net balances.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Amount due (BDT)</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={dueAmount}
                  onChange={(e) => setDueAmount(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Outstanding due is currently {formatTaka(payment.totalOutstanding)}.
                </p>
              </label>
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setDueOpen(false)}
                  disabled={busy === "due-amount"}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === "due-amount" || !dueAmount || Number(dueAmount) <= 0}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
                >
                  {busy === "due-amount" ? <Loader2 className="animate-spin" size={15} /> : <AlertTriangle size={15} />}
                  Set due amount
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmRefundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <CheckCircle2 size={16} /> Confirm refund received
              </h3>
              <button onClick={() => setConfirmRefundOpen(false)} className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-slate-600">
                Confirm that {formatTaka((payment.amountPaid || 0) + (payment.lateFeePaid || 0))} has been refunded to
                you. This closes the payment and allows the driver to cancel the ride. This cannot be undone.
              </p>
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setConfirmRefundOpen(false)}
                  disabled={busy === "confirm-refund"}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={doConfirmRefund}
                  disabled={busy === "confirm-refund"}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {busy === "confirm-refund" ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                  Got refund
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <XCircle size={16} /> Cancel ride
              </h3>
              <button onClick={() => setCancelOpen(false)} className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-slate-600">
                Are you sure you want to cancel this ride? You will be removed from the ride.
              </p>
              <p className="text-xs text-amber-600">
                Free cancellation within 20 minutes of the driver accepting. After that, a fine of ৳100 per 15 minutes applies.
              </p>
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setCancelOpen(false)}
                  disabled={busy === "passenger-cancel"}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
                >
                  Keep ride
                </button>
                <button
                  onClick={doPassengerCancel}
                  disabled={busy === "passenger-cancel"}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                >
                  {busy === "passenger-cancel" ? <Loader2 className="animate-spin" size={15} /> : <XCircle size={15} />}
                  Confirm cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {driverConfirmRefundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <RefreshCcw size={16} /> Process refund
              </h3>
              <button onClick={() => setDriverConfirmRefundOpen(false)} className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-slate-600">
                How will you refund {formatTaka((payment.amountPaid || 0) + (payment.lateFeePaid || 0))} to the passenger?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDriverRefundMethod("BKASH")}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    driverRefundMethod === "BKASH" ? "border-rose-300 bg-rose-50" : "border-slate-200 hover:border-rose-200"
                  }`}
                >
                  <Smartphone size={20} className="shrink-0 text-rose-600" />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">bKash</span>
                    <span className="block text-xs text-slate-500">Refund via bKash</span>
                  </span>
                </button>
                <button
                  onClick={() => setDriverRefundMethod("MANUAL")}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    driverRefundMethod === "MANUAL" ? "border-slate-400 bg-slate-50" : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <HandCoins size={20} className="shrink-0 text-slate-600" />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">Manual</span>
                    <span className="block text-xs text-slate-500">Cash or other method</span>
                  </span>
                </button>
              </div>
              {driverRefundMethod === "BKASH" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">bKash Transaction Reference</span>
                  <input
                    value={driverRefundTxnId}
                    onChange={(e) => setDriverRefundTxnId(e.target.value)}
                    placeholder="e.g. bKash txn ID"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              )}
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setDriverConfirmRefundOpen(false)}
                  disabled={busy === "driver-confirm-refund"}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={doDriverConfirmRefund}
                  disabled={busy === "driver-confirm-refund" || (driverRefundMethod === "BKASH" && !driverRefundTxnId.trim())}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {busy === "driver-confirm-refund" ? <Loader2 className="animate-spin" size={15} /> : <RefreshCcw size={15} />}
                  Confirm refund
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
