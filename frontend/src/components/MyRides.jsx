import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CarFront,
  MapPin,
  Navigation,
  Clock3,
  Users,
  Loader2,
  Check,
  X,
  Eye,
  BadgeCheck,
  Inbox,
  Info,
  Wallet,
  AlertTriangle,
  Map,
  FileText,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Pencil,
  Star,
  QrCode,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import {
  getMyRides,
  respondToRequest,
  getRequestContact,
  cancelRequest,
  cancelRide,
  updateBookingSeats,
} from "../api/rideApi";
import {
  selectPaymentMethod,
  markManualPaid,
  driverConfirmRefund,
  confirmRefund,
} from "../api/ridePaymentApi";
import AcceptedContactModal from "./AcceptedContactModal.jsx";
import RideChatModal from "./RideChatModal.jsx";
import EditRideModal from "./EditRideModal.jsx";
import PaymentOptionModal from "./PaymentOptionModal.jsx";
import BkashQrPaymentModal from "./BkashQrPaymentModal.jsx";
import DriverCancelRefundModal from "./DriverCancelRefundModal.jsx";
import DriverProcessRefundModal from "./DriverProcessRefundModal.jsx";
import usePolling from "../hooks/usePolling";
import { formatTime12Hour } from "../utils/rideStatusConstants";

const STATUS_META = {
  pending: { label: "Pending", classes: "bg-amber-50 text-amber-700 border-amber-200/60" },
  accepted: { label: "Accepted", classes: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
  declined: { label: "Declined", classes: "bg-rose-50 text-rose-700 border-rose-200/60" },
  cancelled: { label: "Cancelled", classes: "bg-slate-100 text-slate-500 border-slate-200" },
};

const formatTaka = (value) =>
  `৳${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const shortLabel = (str) => {
  if (!str) return "";
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[0] || str;
};

const cleanAddress = (str) => {
  if (!str) return "";
  const parts = str.split(",").map((s) => s.trim()).filter(Boolean);
  const unique = [...new Set(parts)];
  const trimmed = unique.slice(0, 4).join(", ");
  return trimmed.includes("Bangladesh") ? trimmed : `${trimmed}, Bangladesh`;
};

const mapsUrl = (ride) => {
  const hasCoords =
    ride.pickupLat != null &&
    ride.pickupLng != null &&
    ride.dropoffLat != null &&
    ride.dropoffLng != null;
  if (hasCoords) {
    return `https://www.google.com/maps/dir/?api=1&origin=${ride.pickupLat},${ride.pickupLng}&destination=${ride.dropoffLat},${ride.dropoffLng}&travelmode=driving`;
  }
  const origin = encodeURIComponent(cleanAddress(ride.pickup));
  const dest = encodeURIComponent(cleanAddress(ride.dropoff));
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
};

function RideDetailPanel({ ride }) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Pickup</p>
          <p className="text-sm font-medium text-slate-700 leading-relaxed">{ride.pickup}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Dropoff</p>
          <p className="text-sm font-medium text-slate-700 leading-relaxed">{ride.dropoff}</p>
        </div>
      </div>
      {ride.notes && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Note</p>
          <p className="text-sm text-slate-600 italic">"{ride.notes}"</p>
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Total seats</p>
          <p className="text-sm font-semibold text-slate-700">{ride.seats}</p>
        </div>
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Seats left</p>
          <p className="text-sm font-semibold text-slate-700">{ride.seatsLeft ?? "—"}</p>
        </div>
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Fare / seat</p>
          <p className="text-sm font-semibold text-slate-700">{ride.charge > 0 ? formatTaka(ride.charge) : "Free"}</p>
        </div>
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Departure</p>
          <p className="text-sm font-semibold text-slate-700">{formatTime12Hour(ride.departureTime)}</p>
        </div>
      </div>
    </div>
  );
}

function MapDetailBar({ ride, expanded, onToggle }) {
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-slate-50 pt-3">
      <a
        href={mapsUrl(ride)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
      >
        <Map size={13} />
        View in map
      </a>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        <FileText size={13} />
        {expanded ? "Hide details" : "Show details"}
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
    </div>
  );
}

export default function MyRides() {
  const [my, setMy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRideTarget, setCancelRideTarget] = useState(null);
  const [driverRefundTarget, setDriverRefundTarget] = useState(null);
  const [editRideTarget, setEditRideTarget] = useState(null);
  const [chatTarget, setChatTarget] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});
  const [paymentOptionTarget, setPaymentOptionTarget] = useState(null);
  const [bkashQrTarget, setBkashQrTarget] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [seatEditTarget, setSeatEditTarget] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState(1);
  const navigate = useNavigate();

  const handleSaveSeats = async () => {
    if (!seatEditTarget) return;
    const targetRide = seatEditTarget.ride;
    const targetReq = seatEditTarget.req;
    setBusy(targetReq._id);
    setError("");
    try {
      const res = await updateBookingSeats(targetRide._id, targetReq._id, selectedSeats);
      const updatedBooking = res.data?.data || targetReq;
      const updatedPayment = res.data?.payment || targetReq.payment;
      const isExtra = selectedSeats > (targetReq.seats || 1);

      setSeatEditTarget(null);
      await load();

      // If increasing seats on a paid ride and extra fare is due, open payment options modal for the extra seats
      if (targetRide.charge > 0 && isExtra && updatedPayment && updatedPayment.remainingAmount > 0) {
        handleOpenPaymentOptions(updatedBooking, targetRide, updatedPayment);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not update seats.");
    } finally {
      setBusy("");
    }
  };

  const handleOpenPaymentOptions = (booking, ride, payment) => {
    setPaymentOptionTarget({ booking, ride, payment });
  };

  const handleSelectBkashFromOptions = () => {
    if (!paymentOptionTarget) return;
    const target = { ...paymentOptionTarget };
    setPaymentOptionTarget(null);
    setBkashQrTarget(target);
  };

  const handleSelectManualFromOptions = async () => {
    const paymentId = paymentOptionTarget?.payment?._id || paymentOptionTarget?.booking?.payment?._id;
    if (!paymentId) return;
    setPaymentBusy(true);
    setError("");
    try {
      await selectPaymentMethod(paymentId, "MANUAL");
      setPaymentOptionTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not select manual payment.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const handleConfirmBkashQr = async (trxId) => {
    const paymentId = bkashQrTarget?.payment?._id || bkashQrTarget?.booking?.payment?._id;
    if (!paymentId) return;
    setPaymentBusy(true);
    setError("");
    try {
      await selectPaymentMethod(paymentId, "BKASH", trxId);
      setBkashQrTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit bKash payment.");
      throw err;
    } finally {
      setPaymentBusy(false);
    }
  };

  const handleDriverApprove = async (paymentId) => {
    setBusy(paymentId);
    setError("");
    try {
      await markManualPaid(paymentId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not approve payment.");
    } finally {
      setBusy("");
    }
  };

  // Passenger clicks "Refunded" (or "Got Refund") to confirm receiving refund
  const handlePassengerConfirmRefund = async (paymentId) => {
    setBusy(paymentId);
    setError("");
    try {
      await confirmRefund(paymentId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not confirm refund.");
    } finally {
      setBusy("");
    }
  };

  // Driver processes passenger's refund request
  const handleDriverProcessRefund = async (paymentId, refundMethod, refundTransactionId) => {
    setBusy(paymentId);
    setError("");
    try {
      await driverConfirmRefund(paymentId, refundMethod, refundTransactionId);
      setDriverRefundTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not process refund.");
    } finally {
      setBusy("");
    }
  };

  const toggleExpanded = (id) =>
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

  const load = async () => {
    setError("");
    try {
      const res = await getMyRides();
      setMy(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load rides.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  const respond = async (rideId, requestId, decision) => {
    setBusy(requestId);
    setError("");
    try {
      await respondToRequest(rideId, requestId, decision);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the request.");
    } finally {
      setBusy("");
    }
  };

  const reveal = async (requestId) => {
    setBusy(requestId);
    setError("");
    try {
      const res = await getRequestContact(requestId);
      setContact(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Contact details are hidden.");
    } finally {
      setBusy("");
    }
  };

  const openCancelModal = (rideId, requestId, status, payment) => {
    setError("");
    setCancelTarget({ rideId, requestId, status, payment });
    setCancelReason("");
  };

  const cancelRequestOn = async () => {
    if (!cancelTarget) return;
    setBusy(cancelTarget.requestId);
    setError("");
    try {
      const res = await cancelRequest(cancelTarget.rideId, cancelTarget.requestId, cancelReason);
      if (res.data?.fine > 0) {
        setError(`Request cancelled. A late cancellation fine of ৳${res.data.fine} applies (past 15 minutes).`);
      }
      setCancelTarget(null);
      setCancelReason("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel the request.");
    } finally {
      setBusy("");
    }
  };

  const cancelRideOn = async ({ cancelReason, refundMethod, refundTransactionId }) => {
    if (!cancelRideTarget) return;
    setBusy(cancelRideTarget._id);
    setError("");
    try {
      const res = await cancelRide(cancelRideTarget._id, cancelReason, refundMethod, refundTransactionId);
      const fine = res.data?.cancellationFine;
      if (fine > 0) {
        setError(`Ride cancelled. A late cancellation fine of ${formatTaka(fine)} has been applied (past 15 minutes).`);
      }
      setCancelRideTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel the ride.");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={24} />
      </div>
    );
  }

  const avatar = (student) => {
    if (!student) return null;
    const src = student.profilePhoto || null;
    const initial = (student.name || "?").trim().charAt(0).toUpperCase();
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white shadow-2xs">
        {src ? <img src={src} alt={student.name} className="h-full w-full object-cover" /> : initial}
      </div>
    );
  };

  const nameLine = (student) => (
    <div className="flex items-center gap-1.5">
      <p className="flex items-center gap-1 text-sm font-bold text-slate-800">
        <span className="truncate">{student?.name || "Student"}</span>
        {student?.idVerified && (
          <BadgeCheck size={14} className="shrink-0 fill-brand-600 text-white" />
        )}
      </p>
      {student?.rating && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60 shadow-2xs">
          <Star size={10} className="fill-amber-400 text-amber-400" />
          {student.rating.average != null ? `${student.rating.average}` : "New"}
        </span>
      )}
    </div>
  );

  const rideLinePills = (ride) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
        <MapPin size={11} className="shrink-0" />
        {shortLabel(ride.pickup)}
      </span>
      <Navigation size={13} className="shrink-0 text-slate-300" />
      <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
        <MapPin size={11} className="shrink-0" />
        {shortLabel(ride.dropoff)}
      </span>
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Clock3 size={12} /> {formatTime12Hour(ride.departureTime)}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 shadow-xs">
          {error}
        </div>
      )}

      {my && (my.posted.length > 0 || my.requested.length > 0) && (
        <>
          {/* DRIVER POSTED RIDES */}
          {my.posted.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                <CarFront size={15} /> Rides I posted
              </h2>
              <div className="space-y-4">
                {my.posted.map((ride) => (
                  <div key={ride._id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          {rideLinePills(ride)}
                          <p className="mt-2 text-xs text-slate-400">
                            {ride.seatsLeft} of {ride.seats} seats left
                            {ride.charge > 0 && (
                              <span className="ml-2 font-semibold text-slate-600">· {formatTaka(ride.charge)} / seat</span>
                            )}
                            {ride.charge === 0 && (
                              <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Free</span>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {ride.requests.length} request{ride.requests.length === 1 ? "" : "s"}
                          </span>
                          {ride.status === "open" && (
                            <>
                              {ride.seatsLeft > 0 ? (
                                <button
                                  onClick={() => setEditRideTarget(ride)}
                                  disabled={busy === ride._id}
                                  className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Pencil size={13} />
                                  Edit offer
                                </button>
                              ) : (
                                <span
                                  title="Cannot edit: this ride offer is fully booked"
                                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed"
                                >
                                  <Pencil size={13} />
                                  Fully booked
                                </span>
                              )}
                              <button
                                onClick={() => setCancelRideTarget(ride)}
                                disabled={busy === ride._id}
                                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busy === ride._id ? <Loader2 className="animate-spin" size={13} /> : <X size={13} />}
                                Cancel ride
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <MapDetailBar
                        ride={ride}
                        expanded={!!expandedIds[ride._id]}
                        onToggle={() => toggleExpanded(ride._id)}
                      />

                      {ride.requests.length === 0 ? (
                        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-400">
                          No one has requested a seat yet.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {ride.requests.map((req) => {
                            const meta = STATUS_META[req.status] || STATUS_META.pending;
                            const payment = req.payment;
                            const posterId = String(ride.poster?._id || ride.poster || "");
                            const refundRequesterId = String(payment?.refundRequestedBy || "");

                            // When driver cancelled the ride or initiated refund, OR when driver processed the passenger's refund:
                            const isDriverCancelledWaitingPassenger =
                              payment?.status === "REFUND_REQUESTED" &&
                              (ride.status === "pending_cancellation" || (posterId && refundRequesterId === posterId) || payment?.driverRefundConfirmedAt);

                            // When passenger requested refund on an active ride and driver has NOT refunded yet:
                            const isRefundRequestedByPassenger =
                              payment?.status === "REFUND_REQUESTED" &&
                              ride.status !== "pending_cancellation" &&
                              refundRequesterId &&
                              refundRequesterId !== posterId &&
                              !payment?.driverRefundConfirmedAt;

                            return (
                              <div
                                key={req._id}
                                className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-y-3">
                                  <div className="flex items-center gap-3">
                                    {avatar(req.rider)}
                                    <div>
                                      {nameLine(req.rider)}
                                      <p className="text-xs text-slate-500">
                                        {req.rider?.department}, {req.rider?.year}
                                        {req.seats > 1 && (
                                          <span className="ml-2 font-bold text-slate-700">· {req.seats} seats</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${meta.classes}`}>
                                      {meta.label}
                                    </span>

                                    {/* REFUND BADGES ON DRIVER SIDE */}
                                    {payment?.status === "REFUNDED" && (
                                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-extrabold text-slate-700">
                                        <Check size={12} /> Refunded
                                      </span>
                                    )}

                                    {isDriverCancelledWaitingPassenger && (
                                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-800">
                                        <Clock3 size={12} className="animate-spin text-amber-500" />
                                        Waiting for approval
                                      </span>
                                    )}

                                    {isRefundRequestedByPassenger && (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700">
                                          <AlertCircle size={12} className="text-rose-500" />
                                          {req.rider?.name || "Passenger"} wants to cancel
                                        </span>
                                        <button
                                          onClick={() => setDriverRefundTarget(req)}
                                          className="flex items-center gap-1 rounded-lg bg-[#d12053] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#b01742] animate-pulse cursor-pointer"
                                          title="Passenger cancelled and asked for refund. Click to refund via bKash or Manual Cash."
                                        >
                                          <RotateCcw size={13} />
                                          Refund Passenger ({formatTaka(payment.amountPaid || payment.originalAmount)})
                                        </button>
                                      </div>
                                    )}

                                    {req.status === "pending" && (
                                      <>
                                        <button
                                          onClick={() => respond(ride._id, req._id, "accepted")}
                                          disabled={busy === req._id}
                                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                                        >
                                          {busy === req._id ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
                                          Accept
                                        </button>
                                        <button
                                          onClick={() => respond(ride._id, req._id, "declined")}
                                          disabled={busy === req._id}
                                          className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                                        >
                                          <X size={13} />
                                          Decline
                                        </button>
                                      </>
                                    )}

                                    {req.status === "accepted" && (
                                      <>
                                        {ride.charge > 0 && payment && (
                                          <>
                                            {payment.status === "PAID" || (req.paymentStatus === "SETTLED" && (!payment.remainingAmount || payment.remainingAmount === 0)) ? (
                                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
                                                <Check size={13} /> Paid
                                              </span>
                                            ) : payment.amountPaid > 0 && payment.remainingAmount > 0 && payment.status !== "REFUND_REQUESTED" && payment.status !== "REFUNDED" ? (
                                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
                                                <Check size={13} /> Paid: {formatTaka(payment.amountPaid)}
                                              </span>
                                            ) : payment.status !== "REFUND_REQUESTED" && payment.status !== "REFUNDED" ? (
                                              <div className="flex flex-wrap items-center gap-1.5">
                                                {payment.paymentMethod === "BKASH" && payment.bkashTrxId && (
                                                  <span
                                                    className="rounded-lg bg-pink-50 border border-[#d12053]/25 px-2 py-1 text-[11px] font-mono font-bold text-[#d12053]"
                                                    title="bKash Transaction ID submitted by passenger"
                                                  >
                                                    bKash TrxID: {payment.bkashTrxId}
                                                  </span>
                                                )}
                                                {payment.paymentMethod === "MANUAL" && (
                                                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                                                    Manual Cash
                                                  </span>
                                                )}
                                                <button
                                                  onClick={() => handleDriverApprove(payment._id)}
                                                  disabled={busy === payment._id}
                                                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
                                                  title="Approve payment and mark as Paid for both users"
                                                >
                                                  {busy === payment._id ? (
                                                    <Loader2 className="animate-spin" size={13} />
                                                  ) : (
                                                    <Check size={13} />
                                                  )}
                                                  Approve
                                                </button>
                                              </div>
                                            ) : null}
                                          </>
                                        )}
                                        <button
                                          onClick={() => setChatTarget({ rideId: ride._id, otherUser: req.rider })}
                                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
                                        >
                                          <MessageSquare size={13} />
                                          Chat
                                        </button>
                                        <button
                                          onClick={() => reveal(req._id)}
                                          disabled={busy === req._id}
                                          className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
                                        >
                                          {busy === req._id ? <Loader2 className="animate-spin" size={13} /> : <Eye size={13} />}
                                          Reveal contact
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* DRIVER EXTENDED EXTRA SEAT REQUEST BOX */}
                                {payment && payment.amountPaid > 0 && payment.remainingAmount > 0 && payment.status !== "REFUND_REQUESTED" && payment.status !== "REFUNDED" && (
                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50/80 border border-amber-200 p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Users size={13} className="text-amber-700" />
                                      <span className="text-xs font-bold text-amber-900">
                                        Requested Extra: +{Math.round(payment.remainingAmount / (ride.charge || 1))} Seat(s) ({formatTaka(payment.remainingAmount)})
                                      </span>
                                      {payment.paymentMethod === "BKASH" && payment.bkashTrxId && (
                                        <span className="rounded-md bg-pink-100 text-[#d12053] px-2 py-0.5 text-[10px] font-mono font-bold">
                                          bKash TrxID: {payment.bkashTrxId}
                                        </span>
                                      )}
                                      {payment.paymentMethod === "MANUAL" && (
                                        <span className="rounded-md bg-slate-200 text-slate-700 px-2 py-0.5 text-[10px] font-bold">
                                          Manual Cash
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleDriverApprove(payment._id)}
                                      disabled={busy === payment._id}
                                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60 cursor-pointer shrink-0"
                                      title="Approve extra seats payment and merge booking"
                                    >
                                      {busy === payment._id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                      Approve Extra ({formatTaka(payment.remainingAmount)})
                                    </button>
                                  </div>
                                )}

                                {req.status === "cancelled" && req.cancelReason && (
                                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 border border-rose-100">
                                    <Info size={13} className="mt-0.5 shrink-0" />
                                    <span>Request cancelled — {req.cancelReason}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {expandedIds[ride._id] && <RideDetailPanel ride={ride} />}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* PASSENGER REQUESTED RIDES */}
          {my.requested.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                <Users size={15} /> Rides I requested
              </h2>
              <div className="space-y-3">
                {my.requested.map((req) => {
                  const meta = STATUS_META[req.status] || STATUS_META.pending;
                  const ride = req.ride;
                  if (!ride) return null;
                  const payment = req.payment;

                  const posterId = String(ride.poster?._id || ride.poster || "");
                  const refundRequesterId = String(payment?.refundRequestedBy || "");

                  const isDriverWantsToCancel =
                    ride.status === "pending_cancellation" ||
                    (payment?.status === "REFUND_REQUESTED" && posterId && refundRequesterId === posterId) ||
                    (req.status === "cancelled" && req.cancelReason && req.cancelReason.toLowerCase().includes("driver"));

                  const isDriverRefundAwaitingPassenger =
                    payment?.status === "REFUND_REQUESTED" &&
                    (ride.status === "pending_cancellation" || (posterId && refundRequesterId === posterId) || payment?.driverRefundConfirmedAt);

                  const isPassengerRefundPendingDriver =
                    payment?.status === "REFUND_REQUESTED" &&
                    !isDriverRefundAwaitingPassenger;

                  return (
                    <div key={req._id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
                      <div className="p-5">
                        <div className="flex flex-wrap items-center justify-between gap-y-3">
                          <div className="flex items-center gap-3">
                            {avatar(ride?.poster)}
                            <div>
                              {nameLine(ride?.poster)}
                              <p className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                                <span>{rideLinePills(ride)}</span>
                                {ride.status === "open" &&
                                  (req.status === "pending" || req.status === "accepted") &&
                                  payment?.status !== "REFUND_REQUESTED" &&
                                  payment?.status !== "REFUNDED" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const perSeat = Number(ride.charge || 0);
                                        const paid = Number(
                                          payment?.amountPaid ||
                                          (payment?.status === "PAID" || req.paymentStatus === "SETTLED"
                                            ? payment?.originalAmount || (perSeat * (req.seats || 1))
                                            : 0)
                                        );
                                        const isPaid = paid > 0;
                                        const initial = isPaid && (ride.seatsLeft || 0) > 0 ? (req.seats || 1) + 1 : (req.seats || 1);
                                        setSeatEditTarget({ ride, req });
                                        setSelectedSeats(initial);
                                      }}
                                      className="text-[11px] font-bold text-brand-600 hover:underline cursor-pointer bg-brand-50 px-2 py-0.5 rounded-md"
                                      title="Request more seats or change seat count"
                                    >
                                      Change seats
                                    </button>
                                  )}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${meta.classes}`}>
                              {meta.label}
                            </span>

                            {/* DRIVER WANTS TO CANCEL NOTICE */}
                            {isDriverWantsToCancel && payment?.status !== "REFUNDED" && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700">
                                <AlertCircle size={12} className="text-rose-500" />
                                Driver wants to cancel ride
                              </span>
                            )}

                            {/* PASSENGER REFUND ACTIONS */}
                            {payment?.status === "REFUNDED" && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                                <Check size={13} /> Approved (Refund Completed)
                              </span>
                            )}

                            {isDriverRefundAwaitingPassenger && (
                              <button
                                onClick={() => handlePassengerConfirmRefund(payment._id)}
                                disabled={busy === payment._id}
                                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 animate-pulse disabled:opacity-60 cursor-pointer"
                                title="Click to confirm you received the refund and cancel ride"
                              >
                                {busy === payment._id ? (
                                  <Loader2 className="animate-spin" size={13} />
                                ) : (
                                  <Check size={13} />
                                )}
                                Refunded
                              </button>
                            )}

                            {isPassengerRefundPendingDriver && (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-800">
                                <Clock3 size={13} className="animate-spin text-amber-500" />
                                Waiting for driver to refund
                              </span>
                            )}

                            {(req.status === "pending" || req.status === "accepted") &&
                              payment?.status !== "REFUND_REQUESTED" &&
                              payment?.status !== "REFUNDED" && (
                                <button
                                  onClick={() => openCancelModal(ride._id, req._id, req.status, payment)}
                                  className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
                                >
                                  <X size={13} />
                                  {payment &&
                                  (payment.amountPaid > 0 || payment.status === "PAID" || req.paymentStatus === "SETTLED")
                                    ? "Cancel and ask for refund"
                                    : "Cancel ride"}
                                </button>
                              )}

                            {req.status === "declined" && (
                              <button
                                onClick={async () => {
                                  setBusy(req._id);
                                  try {
                                    await cancelRequest(ride._id, req._id);
                                    await load();
                                  } catch {
                                    /* ignore */
                                  } finally {
                                    setBusy("");
                                  }
                                }}
                                disabled={busy === req._id}
                                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-60"
                                title="Dismiss this declined request from your list"
                              >
                                {busy === req._id ? <Loader2 className="animate-spin" size={13} /> : <X size={13} />}
                                Dismiss
                              </button>
                            )}

                            {req.status === "accepted" && (
                              <>
                                {ride.charge > 0 && payment && (
                                  <>
                                    {payment.status === "PAID" || (req.paymentStatus === "SETTLED" && (!payment.remainingAmount || payment.remainingAmount === 0)) ? (
                                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-xs font-extrabold text-emerald-700">
                                        <Check size={13} /> Paid
                                      </span>
                                    ) : payment.amountPaid > 0 && payment.remainingAmount > 0 && payment.status !== "REFUND_REQUESTED" && payment.status !== "REFUNDED" ? (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">
                                          <Check size={11} /> Paid ({formatTaka(payment.amountPaid)})
                                        </span>
                                        {payment.paymentMethod === "BKASH" && payment.bkashTrxId && (
                                          <span className="rounded-lg bg-pink-50 border border-[#d12053]/25 px-2 py-0.5 text-[11px] font-mono font-bold text-[#d12053]">
                                            TrxID: {payment.bkashTrxId}
                                          </span>
                                        )}
                                        {payment.paymentMethod ? (
                                          <button
                                            onClick={() => handleOpenPaymentOptions(req, ride, payment)}
                                            className="text-xs font-bold text-brand-600 hover:underline px-1 cursor-pointer"
                                          >
                                            Change
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleOpenPaymentOptions(req, ride, payment)}
                                            className="flex items-center gap-1 rounded-lg bg-[#d12053] px-2.5 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-[#b01742] animate-pulse cursor-pointer"
                                          >
                                            <Wallet size={12} />
                                            Pay Extra ({formatTaka(payment.remainingAmount)})
                                          </button>
                                        )}
                                      </div>
                                    ) : payment.paymentMethod ? (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {payment.paymentMethod === "BKASH" && payment.bkashTrxId && (
                                          <span className="rounded-lg bg-pink-50 border border-[#d12053]/25 px-2 py-0.5 text-[11px] font-mono font-bold text-[#d12053]">
                                            TrxID: {payment.bkashTrxId}
                                          </span>
                                        )}
                                        <button
                                          onClick={() => handleOpenPaymentOptions(req, ride, payment)}
                                          className="text-xs font-bold text-brand-600 hover:underline px-1 cursor-pointer"
                                        >
                                          Change
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleOpenPaymentOptions(req, ride, payment)}
                                        className="flex items-center gap-1.5 rounded-lg bg-[#d12053] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#b01742] animate-pulse cursor-pointer"
                                      >
                                        <Wallet size={13} />
                                        Pay Fare ({formatTaka((ride.charge || 0) * (req.seats || 1))})
                                      </button>
                                    )}
                                  </>
                                )}
                                <button
                                  onClick={() => setChatTarget({ rideId: ride._id, otherUser: ride.poster })}
                                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700"
                                >
                                  <MessageSquare size={13} />
                                  Message driver
                                </button>
                                <button
                                  onClick={() => reveal(req._id)}
                                  disabled={busy === req._id}
                                  className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
                                >
                                  {busy === req._id ? <Loader2 className="animate-spin" size={13} /> : <Eye size={13} />}
                                  Reveal driver contact
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* DRIVER CANCELLATION REASON NOTICE */}
                        {(ride.status === "cancelled" || req.status === "cancelled") && (ride.cancelReason || req.cancelReason) && (
                          <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/80 p-3 text-xs text-rose-700 space-y-1">
                            <p className="font-bold flex items-center gap-1.5 text-rose-800">
                              <Info size={14} className="shrink-0" />
                              Cancellation Reason:
                            </p>
                            <p className="pl-5 italic">
                              "{ride.cancelReason || req.cancelReason}"
                            </p>
                            {payment?.refundMethod && (
                              <p className="pl-5 text-[11px] font-semibold text-slate-700 pt-1">
                                Refund via: <strong>{payment.refundMethod === "BKASH" ? "bKash" : "Manual Cash"}</strong>
                                {payment.refundTransactionId && (
                                  <span className="font-mono ml-2 bg-pink-100 text-[#d12053] px-2 py-0.5 rounded-md">
                                    TrxID: {payment.refundTransactionId}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        )}

                        <MapDetailBar
                          ride={ride}
                          expanded={!!expandedIds[req._id]}
                          onToggle={() => toggleExpanded(req._id)}
                        />

                        {payment && (() => {
                          const hasExtraPending =
                            payment.amountPaid > 0 &&
                            payment.remainingAmount > 0 &&
                            payment.status !== "REFUND_REQUESTED" &&
                            payment.status !== "REFUNDED";
                          const baseAmount = hasExtraPending ? payment.amountPaid : (payment.totalOutstanding || payment.originalAmount);

                          return (
                            <div className="mt-3 space-y-2">
                              {/* Main Fare Bar */}
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 border border-slate-100">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Wallet size={14} className="text-brand-500" />
                                  <span className="text-xs font-bold text-slate-800">
                                    Fare: {formatTaka(baseAmount)}
                                  </span>
                                  {payment.status === "PAID" || (req.paymentStatus === "SETTLED" && !hasExtraPending) ? (
                                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                                      Paid
                                    </span>
                                  ) : hasExtraPending ? (
                                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                                      Paid ({Math.round(payment.amountPaid / (ride.charge || 1))} seats)
                                    </span>
                                  ) : payment.status === "REFUND_REQUESTED" ? (
                                    <span className="rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-[10px] font-bold text-violet-700">
                                      Refund in Progress
                                    </span>
                                  ) : payment.status === "REFUNDED" ? (
                                    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                                      Refunded
                                    </span>
                                  ) : payment.paymentMethod ? (
                                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 flex items-center gap-1">
                                      <Clock3 size={10} className="animate-spin text-amber-500" /> Wait for approval (
                                      {payment.paymentMethod === "BKASH" ? "bKash" : "Manual Cash"})
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                      Unpaid
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  {!hasExtraPending &&
                                    payment.status !== "PAID" &&
                                    req.paymentStatus !== "SETTLED" &&
                                    payment.status !== "REFUND_REQUESTED" &&
                                    payment.status !== "REFUNDED" && (
                                      <button
                                        onClick={() => handleOpenPaymentOptions(req, ride, payment)}
                                        className="text-xs font-bold text-[#d12053] hover:underline"
                                      >
                                        {payment.paymentMethod ? "Switch / Repay" : "Pay via bKash / Manual"}
                                      </button>
                                    )}
                                  <Link
                                    to={`/ride-payments/${payment._id}`}
                                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                                  >
                                    Details
                                  </Link>
                                </div>
                              </div>

                              {/* Separate Extra Seat Request Row Below Fare */}
                              {hasExtraPending && (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50/80 border border-amber-200 px-3.5 py-2.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Users size={14} className="text-amber-700" />
                                    <span className="text-xs font-bold text-amber-900">
                                      Extra Seats: +{Math.round(payment.remainingAmount / (ride.charge || 1))} ({formatTaka(payment.remainingAmount)})
                                    </span>
                                    {payment.paymentMethod ? (
                                      <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                                        <Clock3 size={10} className="animate-spin text-amber-600" /> Wait for approval ({payment.paymentMethod === "BKASH" ? "bKash" : "Manual Cash"})
                                      </span>
                                    ) : (
                                      <span className="rounded-full bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-bold">
                                        Payment Pending
                                      </span>
                                    )}
                                    {payment.paymentMethod === "BKASH" && payment.bkashTrxId && (
                                      <span className="rounded-md bg-pink-100 text-[#d12053] px-2 py-0.5 text-[10px] font-mono font-bold">
                                        TrxID: {payment.bkashTrxId}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {payment.paymentMethod ? (
                                      <button
                                        onClick={() => handleOpenPaymentOptions(req, ride, payment)}
                                        className="text-xs font-bold text-brand-600 hover:underline cursor-pointer"
                                      >
                                        Change Method
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleOpenPaymentOptions(req, ride, payment)}
                                        className="flex items-center gap-1 rounded-lg bg-[#d12053] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#b01742] animate-pulse cursor-pointer"
                                      >
                                        <Wallet size={12} />
                                        Pay Extra ({formatTaka(payment.remainingAmount)})
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      {expandedIds[req._id] && <RideDetailPanel ride={ride} />}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {my && my.posted.length === 0 && my.requested.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-card">
          <Inbox size={26} className="text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">No rides yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Post a ride to share your commute, or use <strong>Find Ride</strong> to join one.
          </p>
        </div>
      )}

      {contact && <AcceptedContactModal contact={contact} onClose={() => setContact(null)} />}

      {/* PASSENGER CANCEL REQUEST MODAL */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">Cancel request</h3>
              <button
                onClick={() => setCancelTarget(null)}
                className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3">
              {cancelTarget.payment &&
              (cancelTarget.payment.amountPaid > 0 || cancelTarget.payment.status === "PAID") ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="font-bold">You have paid for this ride ({formatTaka(cancelTarget.payment.amountPaid || cancelTarget.payment.originalAmount)}).</p>
                  <p className="mt-1">
                    Cancelling will notify the driver to refund you via bKash or Manual Cash.
                  </p>
                </div>
              ) : null}

              {cancelTarget.status === "accepted" ? (
                <>
                  <p className="text-xs text-slate-500">
                    Let the driver know why you are cancelling. This reason will be shown to them.
                  </p>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Plans changed, found another ride"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                  />
                  <p className="text-[11px] text-slate-400">
                    Note: Free cancellation within 15 minutes of acceptance. After 15 minutes, a 30 Tk fine per 10 minutes applies.
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Cancel your pending seat request for this ride?
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={busy === cancelTarget.requestId}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Keep request
              </button>
              <button
                onClick={cancelRequestOn}
                disabled={
                  busy === cancelTarget.requestId ||
                  (cancelTarget.status === "accepted" && !cancelReason.trim())
                }
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === cancelTarget.requestId ? <Loader2 className="animate-spin" size={15} /> : <X size={15} />}
                {cancelTarget.payment &&
                (cancelTarget.payment.amountPaid > 0 || cancelTarget.payment.status === "PAID")
                  ? "Cancel and ask for refund"
                  : "Cancel ride"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEAT EDIT MODAL FOR PASSENGER */}
      {seatEditTarget && (() => {
        const perSeatFare = Number(seatEditTarget.ride.charge || 0);
        const alreadyPaid = Number(
          seatEditTarget.req.payment?.amountPaid ||
          (seatEditTarget.req.payment?.status === "PAID" || seatEditTarget.req.paymentStatus === "SETTLED"
            ? seatEditTarget.req.payment?.originalAmount || (perSeatFare * seatEditTarget.req.seats)
            : 0)
        );
        const paidSeats = perSeatFare > 0
          ? Math.floor(alreadyPaid / perSeatFare)
          : (seatEditTarget.req.payment?.status === "PAID" || seatEditTarget.req.paymentStatus === "SETTLED"
              ? seatEditTarget.req.seats
              : 0);
        const seatsLeft = seatEditTarget.ride.seatsLeft || 0;
        const totalOfferedSeats = Math.max(1, Number(seatEditTarget.ride.seats || 3));
        const maxSeats = paidSeats > 0
          ? Math.min(totalOfferedSeats, Math.max(1, seatsLeft + (seatEditTarget.req.seats || 1)))
          : totalOfferedSeats;
        const extraCount = Math.max(0, selectedSeats - paidSeats);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users size={16} className="text-brand-600" />
                  {paidSeats > 0 ? "Request Extra Seats" : "Change Number of Seats"}
                </h3>
                <button
                  onClick={() => setSeatEditTarget(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 transition"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {paidSeats > 0 ? (
                  seatsLeft <= 0 ? (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
                        <p className="font-bold">
                          Current Booking: {paidSeats} seat{paidSeats > 1 ? "s" : ""} (Paid: {formatTaka(paidSeats * perSeatFare)}).
                        </p>
                        <p className="text-[11px] text-blue-700">
                          0 extra seats left on this ride.
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                        <p className="text-xs font-bold text-slate-700">No extra seats available</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          This ride is currently full. No additional seats can be added.
                        </p>
                      </div>
                      <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSeatEditTarget(null)}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-900 transition cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
                        <p className="font-bold">
                          Current Booking: {paidSeats} seat{paidSeats > 1 ? "s" : ""} (Paid: {formatTaka(paidSeats * perSeatFare)}).
                        </p>
                        <p className="text-[11px] text-blue-700">
                          {seatsLeft} extra seat{seatsLeft === 1 ? "" : "s"} available on this ride.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Select Remaining Seats to Request
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {Array.from(
                            { length: Math.min(totalOfferedSeats - paidSeats, seatsLeft) },
                            (_, i) => i + 1
                          ).map((count) => {
                            const targetTotal = paidSeats + count;
                            const isSelected = selectedSeats === targetTotal;
                            return (
                              <button
                                key={count}
                                type="button"
                                onClick={() => setSelectedSeats(targetTotal)}
                                className={`py-2 px-2.5 rounded-xl border text-center transition cursor-pointer ${
                                  isSelected
                                    ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                <span className="block text-xs font-bold">{count} {count === 1 ? "Seat" : "Seats"}</span>
                                <span className={`block text-[10px] ${isSelected ? "text-white/90" : "text-slate-500"}`}>
                                  (+{formatTaka(count * perSeatFare)})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {perSeatFare > 0 && extraCount > 0 && (
                        <div className="rounded-xl bg-slate-50 p-3 text-xs border border-slate-100 space-y-1.5">
                          <div className="flex justify-between text-slate-600">
                            <span>Current Booking ({paidSeats} seats):</span>
                            <span className="font-semibold">{formatTaka(paidSeats * perSeatFare)} (Paid)</span>
                          </div>
                          <div className="flex justify-between text-[#d12053] font-bold">
                            <span>Extra Seats to Pay (+{extraCount} seat{extraCount > 1 ? "s" : ""}):</span>
                            <span>{formatTaka(extraCount * perSeatFare)}</span>
                          </div>
                          <div className="border-t border-slate-200 my-1"></div>
                          <div className="flex items-center justify-between text-slate-900 font-extrabold text-sm">
                            <span>Total after approval ({selectedSeats} seats):</span>
                            <span className="text-brand-700">{formatTaka(perSeatFare * selectedSeats)}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSeatEditTarget(null)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveSeats}
                          disabled={busy === seatEditTarget.req._id || extraCount <= 0}
                          className="px-4 py-2 rounded-xl bg-brand-600 text-xs font-bold text-white shadow-xs hover:bg-brand-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {busy === seatEditTarget.req._id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Check size={13} />
                          )}
                          Request Seat{extraCount > 1 ? "s" : ""}
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600">
                      You can reduce or increase your seats. Total offered seats on this ride: <strong>{totalOfferedSeats}</strong>
                    </p>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Select Seats
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: totalOfferedSeats }, (_, i) => i + 1).map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setSelectedSeats(num)}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                              selectedSeats === num
                                ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {num} {num === 1 ? "Seat" : "Seats"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {perSeatFare > 0 && (
                      <div className="rounded-xl bg-slate-50 p-3 text-xs border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between text-slate-900 font-extrabold text-sm">
                          <span>Total Fare ({selectedSeats} seat{selectedSeats > 1 ? "s" : ""}):</span>
                          <span className="text-brand-700">{formatTaka(perSeatFare * selectedSeats)}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSeatEditTarget(null)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSeats}
                        disabled={busy === seatEditTarget.req._id}
                        className="px-4 py-2 rounded-xl bg-brand-600 text-xs font-bold text-white shadow-xs hover:bg-brand-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busy === seatEditTarget.req._id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Check size={13} />
                        )}
                        Save Seats
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* DRIVER CANCEL RIDE WITH REASON & REFUND MODAL */}
      {cancelRideTarget && (
        <DriverCancelRefundModal
          isOpen={!!cancelRideTarget}
          onClose={() => setCancelRideTarget(null)}
          ride={cancelRideTarget}
          onConfirm={cancelRideOn}
          busy={busy === cancelRideTarget._id}
        />
      )}

      {/* DRIVER PROCESS PASSENGER REFUND MODAL */}
      {driverRefundTarget && (
        <DriverProcessRefundModal
          isOpen={!!driverRefundTarget}
          onClose={() => setDriverRefundTarget(null)}
          request={driverRefundTarget}
          onConfirm={handleDriverProcessRefund}
          busy={busy === driverRefundTarget.payment?._id}
        />
      )}

      {editRideTarget && (
        <EditRideModal
          ride={editRideTarget}
          onClose={() => setEditRideTarget(null)}
          onSuccess={() => load()}
        />
      )}

      {chatTarget && (
        <RideChatModal
          rideId={chatTarget.rideId}
          otherUser={chatTarget.otherUser}
          onClose={() => setChatTarget(null)}
        />
      )}

      {paymentOptionTarget && (
        <PaymentOptionModal
          isOpen={!!paymentOptionTarget}
          onClose={() => setPaymentOptionTarget(null)}
          booking={paymentOptionTarget.booking}
          ride={paymentOptionTarget.ride}
          onSelectBkash={handleSelectBkashFromOptions}
          onSelectManual={handleSelectManualFromOptions}
          busy={paymentBusy}
        />
      )}

      {bkashQrTarget && (
        <BkashQrPaymentModal
          isOpen={!!bkashQrTarget}
          onClose={() => setBkashQrTarget(null)}
          payment={bkashQrTarget.payment}
          driver={bkashQrTarget.ride?.poster}
          ride={bkashQrTarget.ride}
          onConfirm={handleConfirmBkashQr}
          busy={paymentBusy}
        />
      )}
    </div>
  );
}
