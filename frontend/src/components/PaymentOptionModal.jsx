import React, { useState } from "react";
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
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  Loader2,
  AlertCircle,
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
  const [view, setView] = useState("CHOOSE"); // "CHOOSE" | "BKASH" | "MANUAL"
  const [trxId, setTrxId] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !ride) return null;

  const seats = booking?.seats || 1;
  const farePerSeat = ride?.chargePerSeat || ride?.charge || 0;
  const totalFare =
    booking?.payment?.totalOutstanding ||
    booking?.payment?.originalAmount ||
    farePerSeat * seats;

  const driver = ride.poster;
  const rawDriverPhone = driver?.phone || "017XXXXXXXX";

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(rawDriverPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleModalClose = () => {
    setView("CHOOSE");
    setTrxId("");
    setError("");
    onClose();
  };

  const handleConfirmBkash = async (e) => {
    e?.preventDefault();
    const clean = trxId.trim().toUpperCase();
    if (!clean) {
      setError("Please enter the bKash Transaction ID (TrxID).");
      return;
    }
    setError("");
    try {
      await onSelectBkash(clean);
      handleModalClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to submit bKash payment.");
    }
  };

  const handleConfirmManual = async () => {
    setError("");
    try {
      await onSelectManual();
      handleModalClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to confirm manual payment.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-2.5">
            {view !== "CHOOSE" && (
              <button
                type="button"
                onClick={() => {
                  setView("CHOOSE");
                  setError("");
                }}
                className="mr-1 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title="Back to options"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                view === "BKASH"
                  ? "bg-rose-50 text-rose-600"
                  : view === "MANUAL"
                  ? "bg-slate-100 text-slate-800"
                  : "bg-brand-50 text-brand-600"
              }`}
            >
              {view === "BKASH" ? (
                <Smartphone size={20} />
              ) : view === "MANUAL" ? (
                <Banknote size={20} />
              ) : (
                <Wallet size={20} />
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {view === "BKASH"
                  ? "Pay via bKash"
                  : view === "MANUAL"
                  ? "Pay Manually (Cash)"
                  : "Select Payment Option"}
              </h3>
              <p className="text-xs text-slate-500">
                {view === "BKASH"
                  ? "Send money and submit your Transaction ID"
                  : view === "MANUAL"
                  ? "Pay cash in person to your driver"
                  : "Choose how you would like to settle your fare"}
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            disabled={busy}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ride Fare Summary Bar */}
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

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-600 border border-rose-100">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* VIEW 1: CHOOSE METHOD */}
          {view === "CHOOSE" && (
            <div className="space-y-3">
              {/* Option 1: bKash */}
              <button
                type="button"
                onClick={() => setView("BKASH")}
                disabled={busy}
                className="group relative flex w-full items-center justify-between rounded-2xl border-2 border-slate-100 bg-white p-4.5 text-left transition-all hover:border-[#d12053] hover:bg-pink-50/30 hover:shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#d12053]/10 text-[#d12053] transition-colors group-hover:bg-[#d12053] group-hover:text-white">
                    <Smartphone size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900">Pay via bKash</span>
                      <span className="rounded-full bg-[#d12053] px-2 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">
                        Send Money
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                      Send money in bKash app and enter the Transaction ID.
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
                onClick={() => setView("MANUAL")}
                disabled={busy}
                className="group relative flex w-full items-center justify-between rounded-2xl border-2 border-slate-100 bg-white p-4.5 text-left transition-all hover:border-slate-400 hover:bg-slate-50/70 hover:shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-slate-800 group-hover:text-white">
                    <Banknote size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900">Pay Manually</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600 tracking-wider">
                        Cash
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                      Pay cash in-person to your driver.
                    </p>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700"
                />
              </button>
            </div>
          )}

          {/* VIEW 2: BKASH SEND MONEY INSTRUCTIONS + TRXID */}
          {view === "BKASH" && (
            <form onSubmit={handleConfirmBkash} className="space-y-4">
              <div className="space-y-2.5">
                {/* Step 1 */}
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 font-bold text-white text-[10px]">
                    1
                  </span>
                  <span className="text-slate-700 mt-0.5">
                    Open your <strong className="text-rose-600">bKash App</strong> on your phone.
                  </span>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 font-bold text-white text-[10px]">
                    2
                  </span>
                  <span className="text-slate-700 mt-0.5">
                    Tap on <strong className="text-rose-600">"Send Money"</strong>.
                  </span>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 font-bold text-white text-[10px]">
                    3
                  </span>
                  <div className="flex-1">
                    <span className="text-slate-700 block mb-1.5">
                      Send <strong className="text-rose-600 font-bold">{formatTaka(totalFare)}</strong> to driver's number:
                    </span>
                    <div className="flex items-center justify-between rounded-lg bg-white border border-rose-200 px-3 py-2">
                      <span className="font-mono font-bold text-slate-800 text-sm tracking-wider">
                        {rawDriverPhone}
                      </span>
                      {driver?.phone && (
                        <button
                          type="button"
                          onClick={handleCopyPhone}
                          className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
                        >
                          {copied ? <Check size={12} /> : <Copy size={12} />}
                          {copied ? "Copied!" : "Copy Number"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 font-bold text-white text-[10px]">
                    4
                  </span>
                  <div className="flex-1">
                    <label className="text-slate-700 block font-bold mb-1.5">
                      Fill in the bKash Transaction ID (TrxID) <span className="text-rose-500">*</span>:
                    </label>
                    <input
                      type="text"
                      value={trxId}
                      onChange={(e) => {
                        setTrxId(e.target.value.toUpperCase());
                        setError("");
                      }}
                      placeholder="e.g. 9M7A8K9L"
                      maxLength={20}
                      className="w-full uppercase font-mono font-bold tracking-widest rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setView("CHOOSE")}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={busy || !trxId.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Confirm Payment
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: PAY MANUALLY (NO TrxID REQUIRED) */}
          {view === "MANUAL" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Banknote size={18} className="text-emerald-600" />
                  <span>Manual In-Person Cash Settlement</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You agree to pay <strong>{formatTaka(totalFare)}</strong> in cash directly to your driver when boarding or upon reaching your destination.
                </p>
                <div className="rounded-xl bg-white border border-slate-200 p-3 text-xs text-slate-500">
                  <p className="font-semibold text-slate-700">How it works:</p>
                  <p className="mt-1">
                    1. Click <strong>Confirm Manual Payment</strong> below.
                  </p>
                  <p>
                    2. Status will show <strong>"Pending"</strong>.
                  </p>
                  <p>
                    3. Once the driver receives cash and clicks <strong>"Paid"</strong>, it will show <strong>"Paid"</strong> for both of you.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setView("CHOOSE")}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmManual}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Confirm Manual Payment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
