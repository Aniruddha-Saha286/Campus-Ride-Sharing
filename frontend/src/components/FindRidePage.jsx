import React, { useState, useRef, useEffect } from "react";
import {
  MapPin,
  Navigation,
  Clock3,
  Users,
  Loader2,
  Search,
  Map,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
  Wallet,
  FileText,
  Star,
  Check,
  X,
  RotateCcw,
  AlertCircle,
  ArrowUpDown,
  Play,
} from "lucide-react";
import { listRides, requestSeat, cancelRequest } from "../api/rideApi";
import { selectPaymentMethod, recordManualPayment, confirmRefund } from "../api/ridePaymentApi";
import usePolling from "../hooks/usePolling";
import { formatTime12Hour } from "../utils/rideStatusConstants";
import PaymentOptionModal from "./PaymentOptionModal";
import BkashPaymentManagement from "./BkashPaymentManagement";

const formatTaka = (v) =>
  `৳${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

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

function CustomSeatSelect({ value, onChange, maxSeats }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalSeats = Math.min(6, Math.max(1, Number(maxSeats) || 1));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer"
      >
        <span>
          {value} {value === 1 ? "Seat" : "Seats"}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-slate-700" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-36 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-2xl z-50 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-slate-900/5">
          <p className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Select seats
          </p>
          {Array.from({ length: totalSeats }, (_, i) => i + 1).map((n) => {
            const isSelected = value === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  onChange(n);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                  isSelected
                    ? "bg-brand-50 text-brand-700 font-extrabold"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>
                  {n} {n === 1 ? "Seat" : "Seats"}
                </span>
                {isSelected && <Check size={14} className="text-brand-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RideCard({ ride, onRequest, busy, onOpenPayment, onOpenCancel, onConfirmRefund }) {
  const [expanded, setExpanded] = useState(false);
  const [seats, setSeats] = useState(1);

  const initial = (ride.poster?.name || "?").charAt(0).toUpperCase();
  const driverRating = ride.poster?.rating;
  const myBooking = ride.myBooking;
  const payment = myBooking?.payment;

  const posterId = String(ride.poster?._id || ride.poster || "");
  const refundRequesterId = String(payment?.refundRequestedBy || "");

  const isDriverWantsToCancel =
    ride.status === "pending_cancellation" ||
    (payment?.status === "REFUND_REQUESTED" && posterId && refundRequesterId === posterId) ||
    (myBooking?.status === "cancelled" && myBooking?.cancelReason && myBooking.cancelReason.toLowerCase().includes("driver"));

  const isDriverRefundAwaitingPassenger =
    payment?.status === "REFUND_REQUESTED" &&
    (ride.status === "pending_cancellation" || (posterId && refundRequesterId === posterId) || payment?.driverRefundConfirmedAt);

  const bookingSeats = myBooking?.seats || seats;
  const totalAmount = (ride.charge || 0) * bookingSeats;

  return (
    <div className="relative rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all">
      <div className="p-5 space-y-4">
        {/* 1. Header: Driver Profile & Live Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white shadow-2xs">
              {ride.poster?.profilePhoto ? (
                <img src={ride.poster.profilePhoto} alt={ride.poster.name} className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800 text-sm">{ride.poster?.name}</span>
                {ride.poster?.idVerified && (
                  <BadgeCheck size={14} className="fill-brand-600 text-white shrink-0" />
                )}
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60 shadow-2xs">
                  <Star size={10} className="fill-amber-400 text-amber-400" />
                  {driverRating && driverRating.average != null ? `${driverRating.average}` : "New"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {ride.poster?.department || "Student"}{ride.poster?.year ? `, ${ride.poster.year}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {ride.tripStatus === "ongoing" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-700">
                <Play size={11} className="text-amber-500 animate-pulse" />
                In Transit
              </span>
            )}
            {myBooking ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold border ${
                  myBooking.status === "accepted"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : myBooking.status === "pending"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {myBooking.status === "accepted"
                  ? "Accepted"
                  : myBooking.status === "pending"
                  ? "Pending Request"
                  : "Cancelled"}
              </span>
            ) : ride.seatsLeft > 0 ? (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
                {ride.seatsLeft} Seat{ride.seatsLeft > 1 ? "s" : ""} Available
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-500">
                Fully Booked
              </span>
            )}
          </div>
        </div>

        {/* 2. Journey & Route Card */}
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 space-y-3.5">
          {/* Route line */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200/80 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="truncate max-w-[200px] sm:max-w-xs">{shortLabel(ride.pickup)}</span>
              </span>
              <Navigation size={13} className="text-slate-400 shrink-0 mx-0.5" />
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200/80 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0"></span>
                <span className="truncate max-w-[200px] sm:max-w-xs">{shortLabel(ride.dropoff)}</span>
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1 text-slate-700 bg-white border border-slate-200/80 px-2.5 py-1 rounded-lg">
                <Clock3 size={13} className="text-blue-600" />
                {formatTime12Hour(ride.departureTime)}
              </span>
            </div>
          </div>

          {/* Journey metadata strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 pt-3 text-xs">
            <div className="flex items-center gap-2">
              <Users size={13} className="text-slate-400" />
              <span className="font-bold text-slate-700">
                {ride.seatsLeft} of {ride.seats} seats remaining
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Wallet size={13} className="text-brand-500" />
                <span>{ride.charge > 0 ? `${formatTaka(ride.charge)} / seat` : "Free Ride"}</span>
                {ride.charge > 0 && bookingSeats > 1 && (
                  <span className="text-brand-600 font-extrabold ml-1">
                    (Total: {formatTaka(totalAmount)})
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Alerts if driver requested cancel / refund ready */}
        {isDriverWantsToCancel && payment?.status !== "REFUNDED" && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-bold text-rose-700">
            <AlertCircle size={14} className="text-rose-500 shrink-0" />
            <span>Driver requested to cancel this ride and initiate a refund.</span>
          </div>
        )}

        {isDriverRefundAwaitingPassenger && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
            <div className="text-xs text-emerald-800">
              <p className="font-bold flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600" />
                Driver has sent your refund!
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Please confirm below once you have received the refund in your account.
              </p>
            </div>
            <button
              onClick={() => onConfirmRefund(payment._id)}
              disabled={busy === payment._id}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 animate-pulse disabled:opacity-60 cursor-pointer"
            >
              {busy === payment._id ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
              Confirm Refunded
            </button>
          </div>
        )}

        {/* 4. Footer Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          {/* Left Utilities */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={mapsUrl(ride)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
            >
              <Map size={13} className="text-slate-500" />
              View in map
            </a>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 shadow-2xs cursor-pointer"
            >
              <FileText size={13} className="text-slate-500" />
              {expanded ? "Hide details" : "Show details"}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {myBooking && (myBooking.status === "pending" || myBooking.status === "accepted") && (
              <button
                type="button"
                onClick={() => onOpenCancel(ride, myBooking, payment)}
                disabled={busy === ride._id}
                className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition px-2 py-1 cursor-pointer"
              >
                {payment &&
                (payment.amountPaid > 0 || payment.status === "PAID" || myBooking.paymentStatus === "SETTLED")
                  ? "Cancel & ask for refund"
                  : myBooking.status === "pending"
                  ? "Withdraw request"
                  : "Cancel booking"}
              </button>
            )}
          </div>

          {/* Right Action Trigger */}
          <div className="flex flex-wrap items-center gap-2">
            {ride.tripStatus === "ongoing" && (!myBooking || myBooking.status === "cancelled") ? (
              <span className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-800">
                <Play size={12} className="text-amber-500 animate-pulse" />
                Ride in Progress
              </span>
            ) : !myBooking || myBooking.status === "cancelled" ? (
              <div className="flex items-center gap-2">
                {ride.seatsLeft > 1 && (
                  <CustomSeatSelect
                    value={seats}
                    onChange={setSeats}
                    maxSeats={ride.seatsLeft}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onRequest(ride._id, seats)}
                  disabled={busy === ride._id || ride.seatsLeft <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-brand-700 disabled:opacity-60 cursor-pointer"
                >
                  {busy === ride._id ? <Loader2 className="animate-spin" size={13} /> : <Users size={13} />}
                  Request {seats > 1 ? `${seats} seats` : "seat"}
                </button>
              </div>
            ) : myBooking.status === "pending" ? (
              <span className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-1.5 text-xs font-bold text-amber-800">
                <Clock3 size={12} className="animate-spin text-amber-500" />
                Request Pending Driver Approval
              </span>
            ) : myBooking.status === "accepted" ? (
              <div className="flex flex-wrap items-center gap-2">
                {ride.charge > 0 && payment ? (
                  <>
                    {payment.status === "PAID" || myBooking.paymentStatus === "SETTLED" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 border border-emerald-200/80 px-3 py-1 text-xs font-extrabold text-emerald-800">
                        <Check size={12} /> Paid & Confirmed
                      </span>
                    ) : payment.paymentMethod ? (
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-800 flex items-center gap-1">
                          <Clock3 size={11} className="animate-spin text-amber-600" /> Wait for approval
                        </span>
                        {payment.paymentMethod === "BKASH" && payment.bkashTrxId && (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-xl bg-pink-50/90 border border-[#d12053]/30 px-3 py-1 text-[#d12053] shadow-2xs"
                            title="bKash Transaction ID submitted by passenger"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#d12053]/75 font-sans">
                              TrxID:
                            </span>
                            <span className="font-mono text-xs sm:text-sm font-black tracking-wider text-[#d12053] select-all">
                              {payment.bkashTrxId}
                            </span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenPayment(myBooking, ride, payment)}
                          className="text-xs font-bold text-brand-600 hover:underline px-1 cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenPayment(myBooking, ride, payment)}
                        className="flex items-center gap-1.5 rounded-xl bg-[#d12053] px-4 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-[#b01742] animate-pulse cursor-pointer"
                      >
                        <Wallet size={13} />
                        Pay Fare ({formatTaka(ride.charge * (myBooking.seats || 1))})
                      </button>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 border border-emerald-200/80 px-3 py-1 text-xs font-extrabold text-emerald-800">
                    <Check size={12} /> Confirmed (Free)
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 space-y-3 rounded-b-2xl">
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
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Driver note</p>
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
              <p className="text-sm font-semibold text-slate-700">{ride.seatsLeft}</p>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Fare / seat</p>
              <p className="text-sm font-semibold text-slate-700">
                {ride.charge > 0 ? formatTaka(ride.charge) : "Free"}
              </p>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Departure</p>
              <p className="text-sm font-semibold text-slate-700">{formatTime12Hour(ride.departureTime)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const QUICK_FILTERS = [
  { id: "all", label: "All Rides" },
  { id: "free", label: "Free Rides" },
  { id: "badda", label: "Merul Badda", query: "Badda" },
  { id: "mohakhali", label: "Mohakhali", query: "Mohakhali" },
  { id: "dhanmondi", label: "Dhanmondi", query: "Dhanmondi" },
  { id: "mirpur", label: "Mirpur", query: "Mirpur" },
  { id: "uttara", label: "Uttara", query: "Uttara" },
  { id: "gulshan", label: "Gulshan", query: "Gulshan" },
];

export default function FindRidePage() {
  const [browse, setBrowse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [success, setSuccess] = useState("");

  // Payment Option modal states
  const [paymentOptionTarget, setPaymentOptionTarget] = useState(null); // { booking, ride, payment }
  const [bkashPaymentTarget, setBkashPaymentTarget] = useState(null); // { booking, ride, payment }
  const [paymentBusy, setPaymentBusy] = useState(false);

  // Cancellation modal states
  const [cancelTarget, setCancelTarget] = useState(null); // { ride, booking, payment }
  const [cancelReason, setCancelReason] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await listRides();
      setBrowse(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load rides.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  const openCancelModal = (ride, booking, payment) => {
    setError("");
    setSuccess("");
    setCancelTarget({ ride, booking, payment });
    setCancelReason("");
  };

  const handleCancelRequest = async () => {
    if (!cancelTarget) return;
    setBusy(cancelTarget.ride._id);
    setError("");
    setSuccess("");
    try {
      const res = await cancelRequest(cancelTarget.ride._id, cancelTarget.booking._id, cancelReason);
      if (res.data?.fine > 0) {
        setSuccess(`Request cancelled. A late cancellation fine of ৳${res.data.fine} applies.`);
      } else {
        setSuccess(res.data?.message || "Request cancelled successfully.");
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

  const handleConfirmRefund = async (paymentId) => {
    setBusy(paymentId);
    setError("");
    setSuccess("");
    try {
      await confirmRefund(paymentId);
      setSuccess("Refund confirmed and booking cancelled successfully.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not confirm refund.");
    } finally {
      setBusy("");
    }
  };

  const handleRequest = async (rideId, seats) => {
    setBusy(rideId);
    setError("");
    setSuccess("");
    try {
      await requestSeat(rideId, seats);
      setSuccess("Seat request sent! The driver will review your request.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not request seat.");
    } finally {
      setBusy("");
    }
  };

  const handleOpenPaymentOptions = (booking, ride) => {
    setPaymentOptionTarget({
      booking,
      ride,
      payment: booking.payment,
    });
  };

  const handleSelectBkashFromOptions = () => {
    if (!paymentOptionTarget) return;
    const target = { ...paymentOptionTarget };
    setPaymentOptionTarget(null);
    setBkashPaymentTarget(target);
  };

  const handleSelectManualFromOptions = async () => {
    const paymentId = paymentOptionTarget?.payment?._id || paymentOptionTarget?.booking?.payment?._id;
    if (!paymentId) return;
    setPaymentBusy(true);
    setError("");
    try {
      await selectPaymentMethod(paymentId, "MANUAL");
      setPaymentOptionTarget(null);
      setSuccess("Manual Cash payment selected. Driver will confirm once received.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not select manual payment.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const handleBkashPaymentSubmit = async (trxId) => {
    const paymentId = bkashPaymentTarget?.payment?._id || bkashPaymentTarget?.booking?.payment?._id;
    if (!paymentId) return;
    setPaymentBusy(true);
    setError("");
    try {
      await selectPaymentMethod(paymentId, "BKASH", trxId);
      setBkashPaymentTarget(null);
      setSuccess("bKash payment submitted! Driver will confirm upon verification.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit bKash payment.");
      throw err;
    } finally {
      setPaymentBusy(false);
    }
  };

  // Filtered and sorted rides calculation
  const filteredRides = browse
    .filter((ride) => {
      const q = searchTerm.trim().toLowerCase();
      
      // Quick filter check
      if (activeFilter === "free" && ride.charge > 0) return false;
      if (activeFilter !== "all" && activeFilter !== "free") {
        const filterObj = QUICK_FILTERS.find((f) => f.id === activeFilter);
        if (filterObj && filterObj.query) {
          const queryTerm = filterObj.query.toLowerCase();
          const matchesPickup = (ride.pickup || "").toLowerCase().includes(queryTerm);
          const matchesDropoff = (ride.dropoff || "").toLowerCase().includes(queryTerm);
          if (!matchesPickup && !matchesDropoff) return false;
        }
      }

      // Search query check
      if (!q) return true;

      const matchesPickup = (ride.pickup || "").toLowerCase().includes(q);
      const matchesDropoff = (ride.dropoff || "").toLowerCase().includes(q);
      const matchesDriver = (ride.poster?.name || "").toLowerCase().includes(q);
      const matchesDept = (ride.poster?.department || "").toLowerCase().includes(q);
      const matchesNotes = (ride.notes || "").toLowerCase().includes(q);

      return matchesPickup || matchesDropoff || matchesDriver || matchesDept || matchesNotes;
    })
    .sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      if (sortBy === "latest") return bDate - aDate;
      if (sortBy === "oldest") return aDate - bDate;
      if (sortBy === "departure_asc") return (a.departureTime || "").localeCompare(b.departureTime || "");
      if (sortBy === "departure_desc") return (b.departureTime || "").localeCompare(a.departureTime || "");
      if (sortBy === "fare_asc") return (a.charge || 0) - (b.charge || 0);
      if (sortBy === "fare_desc") return (b.charge || 0) - (a.charge || 0);
      if (sortBy === "seats_desc") return (b.seatsLeft || 0) - (a.seatsLeft || 0);
      return 0;
    });

  return (
    <div className="w-full max-w-none px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px]">
        {/* Top Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Find Ride</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse available rides shared by verified students. Search by pickup, destination, or driver.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 border border-rose-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 border border-emerald-100">
            {success}
          </div>
        )}

        {/* Search Bar & Quick Filters */}
        <div className="mb-6 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          {/* Main Search Input */}
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by pickup, destination, or driver name..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-10 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Filter Chips & Sort Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
                Filter:
              </span>
              {QUICK_FILTERS.map((f) => {
                const isSelected = activeFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilter(f.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Sort Dropdown Menu */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Sort:
              </span>
              <div className="relative flex items-center">
                <ArrowUpDown size={13} className="pointer-events-none absolute left-3 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort available rides"
                  className="rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-bold text-slate-700 shadow-2xs outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
                >
                  <option value="latest">Latest Posted (Newest)</option>
                  <option value="oldest">Oldest Posted</option>
                  <option value="departure_asc">Departure (Earliest First)</option>
                  <option value="departure_desc">Departure (Latest First)</option>
                  <option value="fare_asc">Fare (Lowest First)</option>
                  <option value="fare_desc">Fare (Highest First)</option>
                  <option value="seats_desc">Most Seats Left</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Ride List */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={26} />
          </div>
        ) : browse.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center shadow-card">
            <Search size={30} className="text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">No open rides right now</p>
            <p className="mt-1 text-xs text-slate-400">Check back soon, or post your own ride from the sidebar.</p>
          </div>
        ) : filteredRides.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
            <Search size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">No rides matched your search</p>
            <p className="mt-1 text-xs text-slate-500">
              Try searching with different keywords or clear your active filters.
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setActiveFilter("all");
              }}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Showing {filteredRides.length} of {browse.length} available ride{browse.length === 1 ? "" : "s"}
              </p>
              {(searchTerm || activeFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setActiveFilter("all");
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>

            {filteredRides.map((ride) => (
              <RideCard
                key={ride._id}
                ride={ride}
                onRequest={handleRequest}
                busy={busy}
                onOpenPayment={handleOpenPaymentOptions}
                onOpenCancel={openCancelModal}
                onConfirmRefund={handleConfirmRefund}
              />
            ))}
          </div>
        )}

        {/* Cancellation Modal */}
        {cancelTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
                <h3 className="text-base font-bold text-slate-800">
                  Cancel Seat Request
                </h3>
                <button
                  onClick={() => setCancelTarget(null)}
                  disabled={busy}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {cancelTarget.payment?.status === "PAID" || cancelTarget.booking?.paymentStatus === "SETTLED" ? (
                    <>
                      You have already paid for this ride. If you cancel, a refund request of{" "}
                      <strong className="text-slate-800">
                        {formatTaka(
                          cancelTarget.payment?.amountPaid ||
                            cancelTarget.payment?.originalAmount ||
                            cancelTarget.ride.charge * (cancelTarget.booking.seats || 1)
                        )}
                      </strong>{" "}
                      will be sent to the driver. The ride will be cancelled once the driver confirms the refund.
                    </>
                  ) : (
                    <>Are you sure you want to cancel your seat request for this ride?</>
                  )}
                </p>

                {cancelTarget.booking.status === "accepted" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Reason for cancellation <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g. Schedule changed, emergency arose..."
                      rows={3}
                      maxLength={300}
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCancelTarget(null)}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                  >
                    Keep Booking
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelRequest}
                    disabled={busy || (cancelTarget.booking.status === "accepted" && !cancelReason.trim())}
                    className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    {cancelTarget.payment?.status === "PAID" ||
                    (cancelTarget.payment?.amountPaid && cancelTarget.payment.amountPaid > 0) ||
                    cancelTarget.booking?.paymentStatus === "SETTLED"
                      ? "Cancel and ask for refund"
                      : "Cancel ride"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modals in Find Rides */}
        <PaymentOptionModal
          isOpen={!!paymentOptionTarget}
          onClose={() => setPaymentOptionTarget(null)}
          booking={paymentOptionTarget?.booking}
          ride={paymentOptionTarget?.ride}
          onSelectBkash={handleSelectBkashFromOptions}
          onSelectManual={handleSelectManualFromOptions}
          busy={paymentBusy}
        />
        {bkashPaymentTarget && (
          <BkashPaymentManagement
            isOpen={!!bkashPaymentTarget}
            onClose={() => setBkashPaymentTarget(null)}
            booking={bkashPaymentTarget?.booking}
            ride={bkashPaymentTarget?.ride}
            driver={bkashPaymentTarget?.ride?.poster}
            payment={bkashPaymentTarget?.payment}
            onConfirm={handleBkashPaymentSubmit}
            onSubmit={handleBkashPaymentSubmit}
            busy={paymentBusy}
          />
        )}
      </div>
    </div>
  );
}
