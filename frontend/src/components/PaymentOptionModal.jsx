import React from "react";
import {
  X,
  Wallet,
  Smartphone,
  Banknote,
  MapPin,
  Navigation,
  Clock3,
  Users,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { formatTime12Hour } from "../utils/rideStatusConstants";

const formatTaka = (value) =>
  `৳${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function PaymentOptionModal({
  isOpen,
  onClose,
  booking,
  ride,
  onSelectBkash,
  onSelectManual,
  busy,
}) {
  if (!isOpen || !ride) return null;

  const seats = booking?.seats || 1;
  const farePerSeat = ride?.chargePerSeat || ride?.charge || 0;
  const totalFare =
    booking?.payment?.totalOutstanding ||
    booking?.payment?.originalAmount ||
    farePerSeat * seats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Select Payment Option</h3>
              <p className="text-xs text-slate-500">Choose how you would like to settle your fare</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ride Summary Card */}
        <div className="p-6 space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                <MapPin size={11} /> {ride.pickup}
              </span>
              <Navigation size={12} className="text-slate-300" />
              <span className="flex items-center gap-1 rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                <MapPin size={11} /> {ride.dropoff}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-xs">
              <span className="text-slate-500 flex items-center gap-1 font-medium">
                <Clock3 size={13} className="text-brand-500" /> {formatTime12Hour(ride.departureTime)} ·{" "}
                <Users size={13} className="text-brand-500" /> {seats} seat{seats === 1 ? "" : "s"}
              </span>
              <span className="font-extrabold text-slate-900 text-sm">
                Total: <span className="text-brand-600 font-black">{formatTaka(totalFare)}</span>
              </span>
            </div>
          </div>

          {/* Payment Options Grid */}
          <div className="space-y-3">
            {/* Option 1: bKash QR */}
            <button
              type="button"
              onClick={onSelectBkash}
              disabled={busy}
              className="group relative flex w-full items-center justify-between rounded-2xl border-2 border-slate-100 bg-white p-4.5 text-left transition-all hover:border-[#d12053] hover:bg-pink-50/30 hover:shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#d12053]/10 text-[#d12053] transition-colors group-hover:bg-[#d12053] group-hover:text-white">
                  <Smartphone size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900">Pay via bKash</span>
                    <span className="rounded-full bg-[#d12053] px-2 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">
                      QR Code
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                    Scan the driver's QR code in your bKash app and enter the TrxID.
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#d12053]"
              />
            </button>

            {/* Option 2: Manual Cash */}
            <button
              type="button"
              onClick={onSelectManual}
              disabled={busy}
              className="group relative flex w-full items-center justify-between rounded-2xl border-2 border-slate-100 bg-white p-4.5 text-left transition-all hover:border-slate-400 hover:bg-slate-50/70 hover:shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-slate-800 group-hover:text-white">
                  <Banknote size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900">Manual Payment</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600 tracking-wider">
                      Cash
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                    Pay cash in-person. Driver will click "Approved" upon receiving fare.
                  </p>
                </div>
              </div>
              <ChevronRight
                size={18}
                className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700"
              />
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11px] font-medium text-slate-500">
            <ShieldCheck size={14} className="shrink-0 text-brand-600" />
            <span>
              Both options will show <strong>"Wait for approval"</strong> until the driver confirms with <strong>"Approved"</strong>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
