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
} from "lucide-react";
import { listRides, requestSeat, cancelRequest } from "../api/rideApi";
import { selectPaymentMethod, recordManualPayment, confirmRefund } from "../api/ridePaymentApi";
import usePolling from "../hooks/usePolling";
import { formatTime12Hour } from "../utils/rideStatusConstants";
import PaymentOptionModal from "./PaymentOptionModal";
import BkashQrPaymentModal from "./BkashQrPaymentModal";

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
        <div className="absolute right-0 top-full mt-1.5 w-40 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-2xl z-50 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-slate-900/5">
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

  return (
    <div className="relative rounded-2xl border border-slate-100 bg-white shadow-card transition-shadow hover:shadow-md">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                <MapPin size={11} className="shrink-0" />
                {shortLabel(ride.pickup)}
              </span>
              <Navigation size={13} className="shrink-0 text-slate-300" />
              <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                <MapPin size={11} className="shrink-0" />
                {shortLabel(ride.dropoff)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock3 size={13} className="text-brand-400" />
                <span className="font-semibold text-slate-700">{formatTime12Hour(ride.departureTime)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Users size={13} className="text-brand-400" />
                <span className="font-semibold text-slate-700">{ride.seatsLeft}</span> seat{ride.seatsLeft === 1 ? "" : "s"} left
              </span>
              {ride.charge > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Wallet size={13} className="text-brand-400" />
                  <span className="font-semibold text-slate-700">{formatTaka(ride.charge)}</span> / seat
                  {!myBooking && seats > 1 && (
                    <span className="font-bold text-brand-600 ml-1">
                      (Total: {formatTaka(ride.charge * seats)})
                    </span>
                  )}
                  {myBooking && myBooking.seats > 1 && (
                    <span className="font-bold text-brand-600 ml-1">
                      ({myBooking.seats} seats · Total: {formatTaka(ride.charge * myBooking.seats)})
                    </span>
                  )}
                </span>
              )}
              {ride.charge === 0 && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  Free
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white">
                {ride.poster?.profilePhoto
                  ? <img src={ride.poster.profilePhoto} alt={ride.poster.name} className="h-full w-full object-cover" />
                  : initial}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{ride.poster?.name}</span>
                {ride.poster?.idVerified && (
                  <BadgeCheck size={13} className="fill-brand-600 text-white" />
                )}
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60 shadow-2xs">
                  <Star size={10} className="fill-amber-400 text-amber-400" />
                  {driverRating && driverRating.average != null
                    ? `${driverRating.average}`
                    : "New"}
                </span>
                <span className="text-slate-300">·</span>
                {ride.poster?.department}, {ride.poster?.year}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {!myBooking || myBooking.status === "cancelled" ? (
              <div className="flex items-center gap-2">
                {ride.seatsLeft > 1 && (
                  <CustomSeatSelect
                    value={seats}
                    onChange={setSeats}
                    maxSeats={ride.seatsLeft}
                  />
                )}
                <button
                  onClick={() => onRequest(ride._id, seats)}
                  disabled={busy === ride._id || ride.seatsLeft <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60 cursor-pointer"
                >
                  {busy === ride._id ? <Loader2 className="animate-spin" size={13} /> : <Users size={13} />}
                  Request {seats > 1 ? `${seats} seats` : "seat"}
                </button>
              </div>
            ) : myBooking.status === "pending" ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200/80 px-3.5 py-2 text-xs font-bold text-amber-800">
                  <Clock3 size={13} className="animate-spin text-amber-500" />
                  Pending Approval
                </div>
                <button
                  onClick={() => onOpenCancel(ride, myBooking, payment)}
                  disabled={busy === ride._id}
                  className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                  title="Cancel seat request"
                >
                  <X size={13} />
                  Cancel
                </button>
              </div>
            ) : myBooking.status === "declined" ? (
              <div className="flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200/80 px-3.5 py-2 text-xs font-semibold text-rose-700">
                <X size={13} />
                Declined
              </div>
            ) : myBooking.status === "accepted" ? (
              <div className="flex flex-wrap items-center gap-2">
                {isDriverWantsToCancel && payment?.status !== "REFUNDED" && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700">
                    <AlertCircle size={12} className="text-rose-500" />
                    Driver wants to cancel ride
                  </span>
                )}
                {payment?.status === "REFUNDED" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-extrabold text-emerald-700">
                    <Check size={13} /> Approved (Refund Completed)
                  </span>
                ) : isDriverRefundAwaitingPassenger ? (
                  <button
                    onClick={() => onConfirmRefund(payment._id)}
                    disabled={busy === payment._id}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 animate-pulse disabled:opacity-60 cursor-pointer"
                    title="Click to confirm you received the refund"
                  >
                    {busy === payment._id ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
                    Refunded
                  </button>
                ) : payment?.status === "REFUND_REQUESTED" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs font-bold text-amber-800">
                    <Clock3 size={13} className="animate-spin text-amber-500" />
                    Waiting for driver to refund
                  </span>
                ) : ride.charge > 0 && payment ? (
                  <>
                    {payment.status === "PAID" || myBooking.paymentStatus === "SETTLED" ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-extrabold text-emerald-700">
                          <Check size={13} /> Paid
                        </span>
                        <button
                          onClick={() => onOpenCancel(ride, myBooking, payment)}
                          disabled={busy === ride._id}
                          className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                          title="Cancel ride and request refund"
                        >
                          <X size={13} />
                          Cancel
                        </button>
                      </div>
                    ) : payment.paymentMethod ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700">
                          <Clock3 size={13} className="animate-spin text-amber-500" /> Waiting for approval
                        </span>
                        {payment.paymentMethod === "BKASH" && payment.bkashTrxId && (
                          <span className="rounded-xl bg-pink-50 border border-[#d12053]/25 px-2.5 py-1 text-xs font-mono font-bold text-[#d12053]">
                            TrxID: {payment.bkashTrxId}
                          </span>
                        )}
                        <button
                          onClick={() => onOpenPayment(myBooking, ride, payment)}
                          className="text-xs font-bold text-brand-600 hover:underline px-1 cursor-pointer"
                        >
                          Change
                        </button>
                        <button
                          onClick={() => onOpenCancel(ride, myBooking, payment)}
                          disabled={busy === ride._id}
                          className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                        >
                          <X size={13} />
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">
                          <Check size={13} /> Approved
                        </span>
                        <button
                          onClick={() => onOpenPayment(myBooking, ride, payment)}
                          className="flex items-center gap-1.5 rounded-xl bg-[#d12053] px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-[#d12053]/20 transition hover:bg-[#b01742] cursor-pointer"
                        >
                          <Wallet size={13} />
                          Pay Now ({formatTaka(ride.charge * (myBooking.seats || 1))})
                        </button>
                        <button
                          onClick={() => onOpenCancel(ride, myBooking, payment)}
                          disabled={busy === ride._id}
                          className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                        >
                          <X size={13} />
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-extrabold text-emerald-700">
                      <Check size={13} /> Confirmed (Free)
                    </span>
                    <button
                      onClick={() => onOpenCancel(ride, myBooking, payment)}
                      disabled={busy === ride._id}
                      className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                    >
                      <X size={13} />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-slate-50 pt-3">
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
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer"
          >
            <FileText size={13} />
            {expanded ? "Hide details" : "Show details"}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {expanded && (
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [success, setSuccess] = useState("");

  // Payment Option modal states
  const [paymentOptionTarget, setPaymentOptionTarget] = useState(null); // { booking, ride, payment }
  const [bkashQrTarget, setBkashQrTarget] = useState(null); // { booking, ride, payment }
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
      setError(err.response?.data?.message || "Could not request a seat.");
    } finally {
      setBusy("");
    }
  };

  const handleOpenPaymentOptions = (booking, ride, payment) => {
    setError("");
    setSuccess("");
    setPaymentOptionTarget({ booking, ride, payment });
  };

  const handleSelectBkashFromOptions = async (trxId) => {
    const paymentId = paymentOptionTarget?.payment?._id || paymentOptionTarget?.booking?.payment?._id;
    if (!paymentId) return;
    setPaymentBusy(true);
    setError("");
    try {
      await selectPaymentMethod(paymentId, "BKASH", trxId);
      setPaymentOptionTarget(null);
      setSuccess("bKash payment submitted! Driver will confirm upon verification.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit bKash payment.");
      throw err;
    } finally {
      setPaymentBusy(false);
    }
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
      throw err;
    } finally {
      setPaymentBusy(false);
    }
  };

  // Filtered rides calculation
  const filteredRides = browse.filter((ride) => {
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

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
      </div>
    </div>
  );
}
