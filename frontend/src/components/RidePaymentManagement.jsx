import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CarFront,
  MapPin,
  Navigation,
  Clock3,
  Users,
  Loader2,
  BadgeCheck,
  Wallet,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  Smartphone,
  HandCoins,
  X,
} from "lucide-react";
import { getRidePaymentManagement, requestRefund, markDue, setPaymentAmount, driverConfirmRefund } from "../api/ridePaymentApi";
import usePolling from "../hooks/usePolling";

const formatTaka = (value) =>
  `৳${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
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

export default function RidePaymentManagement() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [amountInputs, setAmountInputs] = useState({});
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundMethod, setRefundMethod] = useState("BKASH");
  const [refundTxnId, setRefundTxnId] = useState("");
  const [confirmRefundTarget, setConfirmRefundTarget] = useState(null);

  const load = async () => {
    setError("");
    try {
      const res = await getRidePaymentManagement(rideId);
      setData(res.data.data);
      setAmountInputs((prev) => {
        const next = { ...prev };
        for (const p of res.data.data.payments || []) {
          if (next[p._id] === undefined) next[p._id] = String(p.remainingAmount || "");
        }
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.message || "Could not load payment management.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  const doRequestRefund = async (paymentId, method, txnId) => {
    setBusy(paymentId);
    setError("");
    try {
      await requestRefund(paymentId, method, txnId || undefined);
      setRefundTarget(null);
      setRefundTxnId("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not request the refund.");
    } finally {
      setBusy("");
    }
  };

  const doMarkDue = async (paymentId, due) => {
    setBusy(paymentId);
    setError("");
    try {
      await markDue(paymentId, due);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the due flag.");
    } finally {
      setBusy("");
    }
  };

  const doSetAmount = async (paymentId) => {
    const amount = Number(amountInputs[paymentId]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a positive due amount.");
      return;
    }
    setBusy(paymentId);
    setError("");
    try {
      await setPaymentAmount(paymentId, amount);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the amount due.");
    } finally {
      setBusy("");
    }
  };

  const doDriverConfirmRefund = async (paymentId) => {
    setBusy(paymentId);
    setError("");
    try {
      await driverConfirmRefund(paymentId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not confirm the refund.");
    } finally {
      setBusy("");
    }
  };

  const doDriverConfirmRefundWithMethod = async (paymentId) => {
    setBusy(paymentId);
    setError("");
    try {
      await driverConfirmRefund(paymentId, refundMethod, refundMethod === "BKASH" ? refundTxnId : undefined);
      setConfirmRefundTarget(null);
      setRefundTxnId("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not confirm the refund.");
    } finally {
      setBusy("");
    }
  };

  const isTerminal = (p) => ["REFUND_REQUESTED", "REFUNDED", "CANCELLED"].includes(p.status);
  const canToggleDue = (p) =>
    p.status !== "PAID" && !isTerminal(p) && !p.finalized && Number(p.amountPaid) < Number(p.originalAmount);

  const statCard = (label, Icon, value, tone) => (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-card">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <Link to="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800">
            <ArrowLeft size={16} /> Back to dashboard
          </Link>
          <div className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">{error || "Could not load this ride's payments."}</div>
        </div>
      </div>
    );
  }

  const ride = data.ride;

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </button>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-y-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
              <Wallet size={22} className="text-brand-600" /> Ride payments
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span className="flex items-center gap-1 font-medium text-slate-800">
                <MapPin size={13} className="text-brand-500" /> {ride.pickup}
              </span>
              <Navigation size={13} className="text-slate-300" />
              <span className="flex items-center gap-1 font-medium text-slate-800">{ride.dropoff}</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock3 size={12} /> {ride.departureTime}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Users size={12} /> {ride.seats} seats
              </span>
            </div>
          </div>
          <div className="rounded-xl bg-slate-100 px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Charge per seat</p>
            <p className="text-lg font-bold text-slate-800">{formatTaka(data.chargePerRider)}</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {statCard("Expected", CarFront, formatTaka(data.expected), "bg-brand-50 text-brand-600")}
          {statCard("Received", CheckCircle2, formatTaka(data.received), "bg-emerald-50 text-emerald-600")}
          {statCard("Outstanding", AlertTriangle, formatTaka(data.outstanding), "bg-rose-50 text-rose-600")}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status:</span>
          {data.counts.overdue > 0 && (
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
              {data.counts.overdue} overdue
            </span>
          )}
          {data.counts.partial > 0 && (
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
              {data.counts.partial} partially paid
            </span>
          )}
          {data.counts.pending > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {data.counts.pending} pending
            </span>
          )}
          {data.counts.due > 0 && (
            <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
              {data.counts.due} due
            </span>
          )}
          {data.counts.refundRequested > 0 && (
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
              {data.counts.refundRequested} refund requested
            </span>
          )}
          {data.counts.refunded > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {data.counts.refunded} refunded
            </span>
          )}
          {data.counts.cancelled > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
              {data.counts.cancelled} cancelled
            </span>
          )}
          {data.counts.paid > 0 && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              {data.counts.paid} paid
            </span>
          )}
        </div>

        {data.payments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-card">
            <Wallet size={26} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">No payments for this ride yet</p>
            <p className="mt-1 text-xs text-slate-400">
              When you accept a passenger on this ride, their charge appears here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Passenger</th>
                    <th className="px-4 py-3 font-semibold">Seats</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Original charge</th>
                    <th className="px-4 py-3 font-semibold">Paid</th>
                    <th className="px-4 py-3 font-semibold">Due</th>
                    <th className="px-4 py-3 font-semibold">Late fee</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.payments.map((p) => {
                    const meta = STATUS_META[p.status] || STATUS_META.PENDING;
                    return (
                      <tr key={p._id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white">
                              {p.passenger?.profilePhoto ? (
                                <img src={p.passenger.profilePhoto} alt={p.passenger.name} className="h-full w-full object-cover" />
                              ) : (
                                (p.passenger?.name || "?").trim().charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="flex items-center gap-1 text-xs font-bold text-slate-800">
                                <span className="truncate">{p.passenger?.name || "Passenger"}</span>
                                {p.passenger?.idVerified && (
                                  <BadgeCheck size={12} className="shrink-0 fill-brand-600 text-white" />
                                )}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {p.passenger?.department || ""} · due {formatDate(p.dueDate)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-800">
                          {p.seats > 1 ? `${p.seats} seats` : "1"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-slate-600">
                            {p.paymentMethod === "BKASH" ? "bKash" : p.paymentMethod === "MANUAL" ? "Manual" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-800">{formatTaka(p.originalAmount)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{formatTaka(p.amountPaid)}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700">{formatTaka(p.remainingAmount)}</td>
                        <td className="px-4 py-3">
                          {p.lateFee > 0 ? (
                            <span className="text-xs font-semibold text-rose-600">{formatTaka(p.lateFee)}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.classes}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {p.status === "PAID" && (
                              <button
                                onClick={() => {
                                  setRefundTarget(p._id);
                                  setRefundMethod(p.paymentMethod === "BKASH" ? "BKASH" : "MANUAL");
                                  setRefundTxnId("");
                                }}
                                disabled={busy === p._id}
                                className="flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                              >
                                {busy === p._id ? (
                                  <Loader2 className="animate-spin" size={12} />
                                ) : (
                                  <RefreshCcw size={12} />
                                )}
                                Refunded
                              </button>
                            )}
                            {p.status === "REFUND_REQUESTED" && p.refundRequestedBy && (
                              <button
                                onClick={() => {
                                  setConfirmRefundTarget(p._id);
                                  setRefundMethod(p.paymentMethod === "BKASH" ? "BKASH" : "MANUAL");
                                  setRefundTxnId("");
                                }}
                                disabled={busy === p._id}
                                className="flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                              >
                                {busy === p._id ? <Loader2 className="animate-spin" size={12} /> : <RefreshCcw size={12} />}
                                Process refund
                              </button>
                            )}
                            {p.status === "REFUND_REQUESTED" && !p.refundRequestedBy && (
                              <span className="text-[11px] font-semibold text-violet-600">Awaiting confirmation</span>
                            )}
                            {canToggleDue(p) && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={amountInputs[p._id] ?? ""}
                                  onChange={(e) =>
                                    setAmountInputs((prev) => ({ ...prev, [p._id]: e.target.value }))
                                  }
                                  placeholder="Due"
                                  className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                                />
                                <button
                                  onClick={() => doSetAmount(p._id)}
                                  disabled={busy === p._id}
                                  className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                                >
                                  {busy === p._id ? <Loader2 className="animate-spin" size={12} /> : <AlertTriangle size={12} />}
                                  Set due
                                </button>
                                {p.manualStatus === "DUE" && (
                                  <button
                                    onClick={() => doMarkDue(p._id, false)}
                                    disabled={busy === p._id}
                                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-60"
                                  >
                                    Clear due
                                  </button>
                                )}
                              </div>
                            )}
                            <span className="text-[11px] text-slate-400">
                              {p.transactionCount} txns
                            </span>
                            <Link
                              to={`/ride-payments/${p._id}`}
                              className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900"
                            >
                              Manage <ChevronRight size={12} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <RefreshCcw size={16} /> Record refund
              </h3>
              <button onClick={() => setRefundTarget(null)} className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-slate-500">
                Select how you refunded this passenger. After recording, the passenger will see a "Got refund" button.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setRefundMethod("BKASH")}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition disabled:opacity-60 ${
                    refundMethod === "BKASH" ? "border-rose-300 bg-rose-50" : "border-slate-200 hover:border-rose-200"
                  }`}
                >
                  <Smartphone size={20} className="shrink-0 text-rose-600" />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">bKash</span>
                    <span className="block text-xs text-slate-500">Refund via bKash</span>
                  </span>
                </button>
                <button
                  onClick={() => setRefundMethod("MANUAL")}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition disabled:opacity-60 ${
                    refundMethod === "MANUAL" ? "border-slate-400 bg-slate-50" : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <HandCoins size={20} className="shrink-0 text-slate-600" />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">Manual</span>
                    <span className="block text-xs text-slate-500">Cash or other method</span>
                  </span>
                </button>
              </div>
              {refundMethod === "BKASH" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">bKash Transaction Reference</span>
                  <input
                    value={refundTxnId}
                    onChange={(e) => setRefundTxnId(e.target.value)}
                    placeholder="e.g. bKash txn ID"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              )}
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setRefundTarget(null)}
                  disabled={busy === refundTarget}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={() => doRequestRefund(refundTarget, refundMethod, refundTxnId)}
                  disabled={busy === refundTarget || (refundMethod === "BKASH" && !refundTxnId.trim())}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {busy === refundTarget ? <Loader2 className="animate-spin" size={15} /> : <RefreshCcw size={15} />}
                  Refunded
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmRefundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <RefreshCcw size={16} /> Process refund
              </h3>
              <button onClick={() => setConfirmRefundTarget(null)} className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <p className="text-sm text-slate-500">
                The passenger cancelled and requested a refund. Select how you will return the money.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setRefundMethod("BKASH")}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition disabled:opacity-60 ${
                    refundMethod === "BKASH" ? "border-rose-300 bg-rose-50" : "border-slate-200 hover:border-rose-200"
                  }`}
                >
                  <Smartphone size={20} className="shrink-0 text-rose-600" />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">bKash</span>
                    <span className="block text-xs text-slate-500">Refund via bKash</span>
                  </span>
                </button>
                <button
                  onClick={() => setRefundMethod("MANUAL")}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition disabled:opacity-60 ${
                    refundMethod === "MANUAL" ? "border-slate-400 bg-slate-50" : "border-slate-200 hover:border-slate-400"
                  }`}
                >
                  <HandCoins size={20} className="shrink-0 text-slate-600" />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">Manual</span>
                    <span className="block text-xs text-slate-500">Cash or other method</span>
                  </span>
                </button>
              </div>
              {refundMethod === "BKASH" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">bKash Transaction Reference</span>
                  <input
                    value={refundTxnId}
                    onChange={(e) => setRefundTxnId(e.target.value)}
                    placeholder="e.g. bKash txn ID"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              )}
              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  onClick={() => setConfirmRefundTarget(null)}
                  disabled={busy === confirmRefundTarget}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={() => doDriverConfirmRefundWithMethod(confirmRefundTarget)}
                  disabled={busy === confirmRefundTarget || (refundMethod === "BKASH" && !refundTxnId.trim())}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {busy === confirmRefundTarget ? <Loader2 className="animate-spin" size={15} /> : <RefreshCcw size={15} />}
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
