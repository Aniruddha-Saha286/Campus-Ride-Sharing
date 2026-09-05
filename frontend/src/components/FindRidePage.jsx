import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Clock3,
  Users,
  Loader2,
  Search,
  Map as MapIcon,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  BadgeCheck,
  Wallet,
  FileText,
  Star,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
} from "lucide-react";
import { listRides, requestSeat, cancelRequest } from "../api/rideApi";
import { selectPaymentMethod, confirmRefund } from "../api/ridePaymentApi";
import usePolling from "../hooks/usePolling";
import { formatTime12Hour } from "../utils/rideStatusConstants";
import PaymentOptionModal from "./PaymentOptionModal";
import VehicleTypeBadge from "./VehicleTypeBadge.jsx";
import { listVehicleRides } from "../api/vehicleRideApi";
import { Bike, Car as CarIcon } from "lucide-react";
import { formatDisplayName } from "../utils/formatters";

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

  const totalSeats = Math.max(1, Math.min(8, Number(maxSeats) || 1));

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
        <div className="absolute right-0 top-full mt-1.5 w-40 max-h-64 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-2xl z-50 space-y-0.5 transition-all duration-150 ring-1 ring-slate-900/5">
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

function RideCard({ ride, activeBooking, onRequest, busy, onOpenPayment, onOpenCancel, onConfirmRefund, onManage }) {
  const [expanded, setExpanded] = useState(false);
  const [seats, setSeats] = useState(1);

  const isDriverOfOtherRide = Boolean(
    activeBooking && activeBooking.isDriver && String(activeBooking.rideId) !== String(ride._id)
  );
  const hasOtherActiveBooking = Boolean(
    activeBooking && String(activeBooking.rideId) !== String(ride._id)
  );
  const otherBookingIsAccepted = hasOtherActiveBooking && !activeBooking.isDriver && activeBooking.status === "accepted";
  const otherBookingIsPending = hasOtherActiveBooking && !activeBooking.isDriver && activeBooking.status === "pending";

  const initial = (ride.poster?.name || "?").charAt(0).toUpperCase();
  const driverRating = ride.poster?.rating;
  const myBooking = ride.myBooking;
  const payment = myBooking?.payment;

  const posterId = String(ride.poster?._id || ride.poster || "");
  const refundRequesterId = String(payment?.refundRequestedBy || "");

  const confirmedCount =
    ride.confirmedRidersCount ||
    (ride?.requests || []).filter((r) => r.status === "accepted").length ||
    1;
  const dynamicEqualShare =
    confirmedCount > 0
      ? Math.round(((ride?.charge || 0) / confirmedCount) * 100) / 100
      : (ride?.charge || 0);
  const payableAmount =
    payment?.totalOutstanding ||
    payment?.remainingAmount ||
    payment?.originalAmount ||
    dynamicEqualShare;

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
              {ride.vehicle && (
                <VehicleTypeBadge vehicle={ride.vehicle} size="sm" />
              )}
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
                  <span className="font-bold text-slate-800">{formatTaka(ride.charge)} total</span>
                  <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 border border-brand-100/60">
                    {formatTaka(Math.round(ride.charge / (ride.seats || 4)))} – {formatTaka(ride.charge)} / person
                  </span>
                </span>
              )}
              {ride.charge === 0 && (
                <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-bold text-success border border-success/20">
                  Free
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-xs font-bold text-white shadow-2xs">
                {ride.poster?.profilePhoto
                  ? <img src={ride.poster.profilePhoto} alt={ride.poster.name} className="h-full w-full object-cover" />
                  : initial}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">{formatDisplayName(ride.poster?.name)}</span>
                {ride.poster?.idVerified && (
                  <BadgeCheck size={13} className="fill-success text-white" />
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
            {ride.isMyRide ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-success/10 border border-success/30 px-3 py-1.5 text-xs font-bold text-success">
                  <BadgeCheck size={13} className="text-success" />
                  Your Posted Ride
                </span>
                <button
                  type="button"
                  onClick={onManage}
                  className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
                >
                  Manage
                  <ChevronRight size={13} />
                </button>
              </div>
            ) : !myBooking || myBooking.status === "cancelled" ? (
              <div className="flex items-center gap-2">
                {ride.seatsLeft > 1 && !hasOtherActiveBooking && (
                  <CustomSeatSelect
                    value={seats}
                    onChange={setSeats}
                    maxSeats={ride.seatsLeft}
                  />
                )}
                <button
                  onClick={() => onRequest(ride._id, seats)}
                  disabled={Boolean(busy) || ride.seatsLeft <= 0 || hasOtherActiveBooking}
                  title={
                    isDriverOfOtherRide
                      ? "You are currently the driver of an active ride. You cannot request a seat until your ride is ended or cancelled."
                      : otherBookingIsAccepted
                      ? "You already have an active ride booked. Complete your current ride to book another."
                      : otherBookingIsPending
                      ? "You already have a pending seat request for another ride. Cancel that request before requesting another ride."
                      : undefined
                  }
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                    hasOtherActiveBooking
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60 cursor-pointer"
                  }`}
                >
                  {busy === ride._id ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : isDriverOfOtherRide ? (
                    <Ban size={13} className="text-slate-400 shrink-0" />
                  ) : otherBookingIsAccepted ? (
                    <Ban size={13} className="text-slate-400 shrink-0" />
                  ) : otherBookingIsPending ? (
                    <Ban size={13} className="text-amber-500 shrink-0" />
                  ) : (
                    <Users size={13} />
                  )}
                  {isDriverOfOtherRide
                    ? "Driver of Active Ride"
                    : otherBookingIsAccepted
                    ? "Already in Active Ride"
                    : otherBookingIsPending
                    ? "Another Request Pending"
                    : `Request ${seats > 1 ? `${seats} seats` : "seat"}`}
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
                          Pay Now ({formatTaka(payableAmount)})
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
            <MapIcon size={13} />
            View on map
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
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Fare</p>
              <p className="text-sm font-bold text-slate-800">
                {ride.charge > 0 ? `${formatTaka(ride.charge)} (split)` : "Free"}
              </p>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Departure</p>
              <p className="text-sm font-semibold text-slate-700">{formatTime12Hour(ride.departureTime)}</p>
            </div>
            {ride.vehicle && (
              <div>
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Vehicle Mode</p>
                <p className="text-sm font-semibold text-slate-800">
                  {ride.vehicle.category} ({ride.vehicle.vehicleType}) · {ride.vehicle.registrationNumber}
                </p>
              </div>
            )}
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
  const navigate = useNavigate();
  const [browse, setBrowse] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pickupQuery, setPickupQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [vehicleCategoryFilter, setVehicleCategoryFilter] = useState("all");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [success, setSuccess] = useState("");

  const [paymentOptionTarget, setPaymentOptionTarget] = useState(null);
  const [paymentBusy, setPaymentBusy] = useState(false);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundTookResponse, setRefundTookResponse] = useState(null);

  const load = async () => {
    setError("");
    try {
      const [ridesRes, vehicleRes] = await Promise.allSettled([
        listRides(),
        listVehicleRides(),
      ]);

      if (ridesRes.status === "rejected" && vehicleRes.status === "rejected") {
        const msg =
          vehicleRes.reason?.response?.data?.message ||
          ridesRes.reason?.response?.data?.message ||
          "Could not load rides.";
        setError(msg);
        setBrowse([]);
        setLoading(false);
        return;
      }

      const vRides =
        vehicleRes.status === "fulfilled" && Array.isArray(vehicleRes.value?.data?.data)
          ? vehicleRes.value.data.data
          : [];

      const legacyRides =
        ridesRes.status === "fulfilled" && Array.isArray(ridesRes.value?.data?.data)
          ? ridesRes.value.data.data
          : [];

      const legacyMap = {};
      for (const r of legacyRides || []) {
        if (r?._id) legacyMap[String(r._id)] = r;
      }

      let combinedRides = [];

      if (vRides.length > 0) {
        combinedRides = vRides.map((vr) => {
          const leg = legacyMap[String(vr._id)];
          return {
            ...vr,
            myBooking: leg?.myBooking || vr.myBooking || null,
            confirmedRidersCount: leg?.confirmedRidersCount || vr.confirmedRidersCount || 0,
            vehicle: vr.vehicle || {
              category: vr.seats === 1 ? "Two-wheeler" : "Four-wheeler",
              vehicleType: vr.seats === 1 ? "Motorbike" : (vr.seats || 4) > 6 ? "Microbus" : (vr.seats || 4) > 4 ? "Jeep" : "Car",
              registrationNumber: `34-${String(vr._id).slice(-4).padStart(4, "0")}`,
              maxSeats: vr.seats === 1 ? 1 : (vr.seats || 4) > 6 ? 8 : (vr.seats || 4) > 4 ? 6 : 4,
              allocatedSeats: vr.seats || 4,
            },
          };
        });

        const vIdMap = {};
        for (const vr of vRides) {
          if (vr?._id) vIdMap[String(vr._id)] = true;
        }
        for (const leg of legacyRides) {
          if (!vIdMap[String(leg._id)]) {
            combinedRides.push({
              ...leg,
              vehicle: leg.vehicle || {
                category: leg.seats === 1 ? "Two-wheeler" : "Four-wheeler",
                vehicleType: leg.seats === 1 ? "Motorbike" : (leg.seats || 4) > 6 ? "Microbus" : (leg.seats || 4) > 4 ? "Jeep" : "Car",
                registrationNumber: `34-${String(leg._id).slice(-4).padStart(4, "0")}`,
                maxSeats: leg.seats === 1 ? 1 : (leg.seats || 4) > 6 ? 8 : (leg.seats || 4) > 4 ? 6 : 4,
                allocatedSeats: leg.seats || 4,
              },
            });
          }
        }
      } else {
        combinedRides = legacyRides.map((ride) => ({
          ...ride,
          vehicle: ride.vehicle || {
            category: ride.seats === 1 ? "Two-wheeler" : "Four-wheeler",
            vehicleType: ride.seats === 1 ? "Motorbike" : (ride.seats || 4) > 6 ? "Microbus" : (ride.seats || 4) > 4 ? "Jeep" : "Car",
            registrationNumber: `34-${String(ride._id).slice(-4).padStart(4, "0")}`,
            maxSeats: ride.seats === 1 ? 1 : (ride.seats || 4) > 6 ? 8 : (ride.seats || 4) > 4 ? 6 : 4,
            allocatedSeats: ride.seats || 4,
          },
        }));
      }

      setBrowse(combinedRides);

      const act =
        (vehicleRes.status === "fulfilled" && vehicleRes.value?.data?.activeBooking) ||
        (ridesRes.status === "fulfilled" && ridesRes.value?.data?.activeBooking) ||
        null;
      setActiveBooking(act);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not load rides.");
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
    setRefundTookResponse(null);
  };

  const handleCancelRequest = async (overrideRefundTook = null) => {
    if (!cancelTarget) return;
    setBusy(cancelTarget.ride._id);
    setError("");
    setSuccess("");
    const took = overrideRefundTook !== null ? overrideRefundTook : refundTookResponse === "yes";
    try {
      const res = await cancelRequest(
        cancelTarget.ride._id,
        cancelTarget.booking._id,
        cancelReason,
        took
      );
      if (res.data?.fine > 0) {
        setSuccess(`Request cancelled. A late cancellation fine of ৳${res.data.fine} applies.`);
      } else {
        setSuccess(res.data?.message || "Request cancelled successfully.");
      }
      setCancelTarget(null);
      setCancelReason("");
      setRefundTookResponse(null);
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
    if (busy) return;
    setBusy(rideId);
    setError("");
    setSuccess("");
    const targetRide = browse.find((r) => String(r._id) === String(rideId));
    if (targetRide) {
      setActiveBooking({
        rideId: targetRide._id,
        pickup: targetRide.pickup,
        dropoff: targetRide.dropoff,
        departureTime: targetRide.departureTime,
        status: "pending",
        tripStatus: "upcoming",
      });
    }
    try {
      await requestSeat(rideId, seats);
      setSuccess("Seat request sent! The driver will review your request.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not request a seat.");
      await load();
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

  const filteredRides = browse.filter((ride) => {
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

    if (vehicleCategoryFilter !== "all") {
      if (ride.vehicle?.category !== vehicleCategoryFilter) return false;
    }

    if (vehicleTypeFilter !== "all") {
      if (ride.vehicle?.vehicleType !== vehicleTypeFilter) return false;
    }

    const pQ = pickupQuery.trim().toLowerCase();
    const dQ = destinationQuery.trim().toLowerCase();

    if (pQ) {
      const matchesPickup = (ride.pickup || "").toLowerCase().includes(pQ);
      if (!matchesPickup) return false;
    }

    if (dQ) {
      const matchesDropoff = (ride.dropoff || "").toLowerCase().includes(dQ);
      if (!matchesDropoff) return false;
    }

    return true;
  });

  return (
    <div className="w-full max-w-none px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Find Ride</h1>
            <p className="mt-1 text-sm text-slate-500">
              Browse available rides shared by verified students. Search by vehicle type, route, or driver.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 border border-rose-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 border border-emerald-100 flex items-center justify-between">
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess("")}
              className="text-xs font-bold text-emerald-800 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {activeBooking && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Navigation size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      {activeBooking.isDriver
                        ? "Active Posted Ride (Driver)"
                        : activeBooking.status === "accepted"
                        ? "Active Ride Booked"
                        : "Pending Ride Request"}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      1 ride limit
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {activeBooking.pickup} <ArrowRight size={13} className="inline mx-1 text-slate-400" /> {activeBooking.dropoff}
                    {activeBooking.departureTime ? ` · ${activeBooking.departureTime}` : ""}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeBooking.isDriver
                      ? "You are currently the driver of an active posted ride. You cannot request a seat on other rides until your ride is ended or cancelled."
                      : activeBooking.status === "accepted"
                      ? "You cannot book another ride until this ride is completed by the driver."
                      : "You have a pending request on this ride. Please wait for driver response or cancel it to request another ride."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/my-rides")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-2xs hover:bg-emerald-50 transition cursor-pointer"
              >
                <span>View in My Rides</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative flex items-center">
              <MapPin size={18} className="absolute left-3.5 text-slate-400" />
              <input
                type="text"
                value={pickupQuery}
                onChange={(e) => setPickupQuery(e.target.value)}
                placeholder="Search pickup area"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-12 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
              />
              {pickupQuery && (
                <button
                  type="button"
                  onClick={() => setPickupQuery("")}
                  className="absolute right-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <Navigation size={18} className="absolute left-3.5 text-slate-400" />
              <input
                type="text"
                value={destinationQuery}
                onChange={(e) => setDestinationQuery(e.target.value)}
                placeholder="Search destination"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-12 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
              />
              {destinationQuery && (
                <button
                  type="button"
                  onClick={() => setDestinationQuery("")}
                  className="absolute right-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
              Area:
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

          <div className="border-t border-slate-100 pt-3">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
                  <CarIcon size={13} className="text-blue-600" />
                  Vehicle Mode:
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setVehicleCategoryFilter("all");
                    setVehicleTypeFilter("all");
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    vehicleCategoryFilter === "all" && vehicleTypeFilter === "all"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Vehicles ({browse.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVehicleCategoryFilter("Two-wheeler");
                    setVehicleTypeFilter("all");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    vehicleCategoryFilter === "Two-wheeler" && vehicleTypeFilter === "all"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
                  }`}
                >
                  <Bike size={14} />
                  <span>
                    Two-wheeler ({browse.filter((r) => r.vehicle?.category === "Two-wheeler").length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVehicleCategoryFilter("Four-wheeler");
                    setVehicleTypeFilter("all");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    vehicleCategoryFilter === "Four-wheeler" && vehicleTypeFilter === "all"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/70"
                  }`}
                >
                  <CarIcon size={14} />
                  <span>
                    Four-wheeler ({browse.filter((r) => r.vehicle?.category === "Four-wheeler").length})
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { id: "Motorbike", label: "Motorbike (1 Seat)", cat: "Two-wheeler" },
                  { id: "Car", label: "Car (1-4)", cat: "Four-wheeler" },
                  { id: "Jeep", label: "Jeep (1-6)", cat: "Four-wheeler" },
                  { id: "Microbus", label: "Microbus (1-8)", cat: "Four-wheeler" },
                ].map((vt) => {
                  const isSelected = vehicleTypeFilter === vt.id;
                  const count = browse.filter((r) => r.vehicle?.vehicleType === vt.id).length;
                  return (
                    <button
                      key={vt.id}
                      type="button"
                      onClick={() => {
                        setVehicleCategoryFilter(vt.cat);
                        setVehicleTypeFilter(isSelected ? "all" : vt.id);
                      }}
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                        isSelected
                          ? "bg-slate-800 text-white ring-2 ring-slate-800/20"
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200/70"
                      }`}
                    >
                      {vt.label} <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" size={26} />
          </div>
        ) : browse.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center shadow-card">
            <Search size={30} className="text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">No open rides right now</p>
            <p className="mt-1 text-xs text-slate-400">Check back soon, or post your own ride from the navigation bar.</p>
          </div>
        ) : filteredRides.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
            <Search size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">No rides match this route.</p>
            <p className="mt-1 text-xs text-slate-500">
              Try changing the pickup, destination, or filters.
            </p>
            <button
              onClick={() => {
                setPickupQuery("");
                setDestinationQuery("");
                setActiveFilter("all");
                setVehicleCategoryFilter("all");
                setVehicleTypeFilter("all");
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
              {(pickupQuery || destinationQuery || activeFilter !== "all" || vehicleCategoryFilter !== "all" || vehicleTypeFilter !== "all") && (
                <button
                  onClick={() => {
                    setPickupQuery("");
                    setDestinationQuery("");
                    setActiveFilter("all");
                    setVehicleCategoryFilter("all");
                    setVehicleTypeFilter("all");
                  }}
                  className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>

            {filteredRides.map((ride) => (
              <RideCard
                key={ride._id}
                ride={ride}
                activeBooking={activeBooking}
                onRequest={handleRequest}
                busy={busy}
                onOpenPayment={handleOpenPaymentOptions}
                onOpenCancel={openCancelModal}
                onConfirmRefund={handleConfirmRefund}
                onManage={() => navigate("/my-rides")}
              />
            ))}
          </div>
        )}

        {cancelTarget && (() => {
          const isPaid = Boolean(
            cancelTarget.payment?.status === "PAID" ||
            (cancelTarget.payment?.amountPaid && cancelTarget.payment.amountPaid > 0) ||
            cancelTarget.booking?.paymentStatus === "SETTLED"
          );
          const paidAmount =
            cancelTarget.payment?.amountPaid ||
            cancelTarget.payment?.originalAmount ||
            (cancelTarget.ride?.charge * (cancelTarget.booking?.seats || 1));

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 transition-opacity duration-200">
              <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
                  <h3 className="text-base font-bold text-slate-800">
                    Cancel Seat Request
                  </h3>
                  <button
                    onClick={() => {
                      setCancelTarget(null);
                      setRefundTookResponse(null);
                    }}
                    disabled={busy}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  {isPaid ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs space-y-3">
                      <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                        <AlertTriangle size={17} className="text-amber-600 shrink-0" />
                        <span>Payment Refund Confirmation</span>
                      </div>
                      <p className="text-slate-700">
                        You have already paid <strong>{formatTaka(paidAmount)}</strong> for this ride.
                      </p>
                      <div className="rounded-xl bg-white border border-amber-200 p-3.5 shadow-xs space-y-2.5">
                        <p className="font-bold text-slate-900 text-sm">
                          Have you received the refund?
                        </p>
                        <p className="text-slate-500 text-xs leading-relaxed">
                          Did you already receive your refund money from the driver (via Cash or bKash)?
                        </p>
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setRefundTookResponse("yes")}
                            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              refundTookResponse === "yes"
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-200"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <Check size={14} /> Yes, refund received
                          </button>
                          <button
                            type="button"
                            onClick={() => setRefundTookResponse("no")}
                            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              refundTookResponse === "no"
                                ? "bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-200"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <X size={14} /> No, not yet
                          </button>
                        </div>
                        {refundTookResponse === "yes" && (
                          <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 pt-1">
                            <Check size={12} className="shrink-0" /> Ride will be cancelled immediately and marked as refunded.
                          </p>
                        )}
                        {refundTookResponse === "no" && (
                          <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1 pt-1">
                            <Clock3 size={12} className="shrink-0" /> A refund request of {formatTaka(paidAmount)} will be sent to the driver.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Are you sure you want to cancel your seat request for this ride?
                    </p>
                  )}

                  {cancelTarget.booking.status === "accepted" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Reason for cancellation {isPaid ? <span className="text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-500">*</span>}
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
                      onClick={() => {
                        setCancelTarget(null);
                        setRefundTookResponse(null);
                      }}
                      disabled={busy}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                    >
                      Keep Booking
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelRequest()}
                      disabled={
                        busy ||
                        (cancelTarget.booking.status === "accepted" && !isPaid && !cancelReason.trim()) ||
                        (isPaid && !refundTookResponse)
                      }
                      className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-60 cursor-pointer ${
                        isPaid && refundTookResponse === "yes"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-rose-600 hover:bg-rose-700"
                      }`}
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                      {isPaid
                        ? !refundTookResponse
                          ? "Select Yes / No above"
                          : refundTookResponse === "yes"
                            ? "Confirm Cancel (Refund Received)"
                            : "Cancel & Ask Driver for Refund"
                        : "Cancel ride"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <PaymentOptionModal
          isOpen={!!paymentOptionTarget}
          onClose={() => setPaymentOptionTarget(null)}
          booking={paymentOptionTarget?.booking}
          ride={paymentOptionTarget?.ride}
          payment={paymentOptionTarget?.payment}
          onSelectBkash={handleSelectBkashFromOptions}
          onSelectManual={handleSelectManualFromOptions}
          busy={paymentBusy}
        />
      </div>
    </div>
  );
}
