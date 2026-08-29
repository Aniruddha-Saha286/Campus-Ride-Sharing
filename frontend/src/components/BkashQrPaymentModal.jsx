import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  QrCode,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";

export default function BkashQrPaymentModal({
  isOpen,
  onClose,
  payment,
  driver,
  ride,
  onConfirm,
  onSubmit,
  busy,
}) {
  const [trxId, setTrxId] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !payment) return null;

  const driverObj = driver || ride?.poster;
  const amount = payment.totalOutstanding || payment.originalAmount || 0;
  const rawDriverPhone = driverObj?.phone || "01712345678";
  const driverName = driverObj?.name || "Driver";

  const confirmFn = onConfirm || onSubmit;

  // Clean to standard 11-digit Bangladeshi mobile number format recognized by bKash app scanner
  const cleanPhone = (phone) => {
    if (!phone) return "01700000000";
    let cleaned = String(phone).replace(/\D/g, "");
    if (cleaned.startsWith("880") && cleaned.length >= 13) {
      cleaned = "0" + cleaned.slice(3);
    } else if (!cleaned.startsWith("0") && cleaned.length === 10) {
      cleaned = "0" + cleaned;
    }
    return cleaned;
  };

  const driverPhone = cleanPhone(rawDriverPhone);

  // Raw phone number in QR payload is directly recognized by bKash App's built-in QR scanner for Send Money
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    driverPhone
  )}&color=d12053&bgcolor=ffffff`;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(driverPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanTrx = trxId.trim().toUpperCase();
    if (!cleanTrx) {
      setError("Please enter the bKash Transaction ID (TrxID).");
      return;
    }
    setError("");
    try {
      if (typeof confirmFn === "function") {
        await confirmFn(cleanTrx);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not submit bKash payment.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
        {/* bKash Header */}
        <div className="bg-[#d12053] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 shadow-xs">
                {/* bKash Bird Icon SVG */}
                <svg viewBox="0 0 100 100" className="h-full w-full fill-[#d12053]">
                  <path d="M50 5 L85 40 L65 50 L85 95 L50 70 L25 80 L35 55 L15 40 Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-white">bKash QR Payment</h3>
                <p className="text-[11px] font-medium text-pink-100">Scan & Pay via bKash App</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-full bg-white/15 p-1.5 text-white transition hover:bg-white/25"
            >
              <X size={18} />
            </button>
          </div>

          {/* Amount Badge */}
          <div className="mt-4 flex items-baseline justify-between rounded-2xl bg-black/15 px-4 py-2.5 backdrop-blur-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200">
                Amount to Pay
              </span>
              <p className="text-xl font-extrabold text-white">
                ৳{Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200">
                Receiver
              </span>
              <p className="text-xs font-bold text-white truncate max-w-[140px]">{driverName}</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d12053]/30 bg-pink-50/40 p-4 text-center">
            <div className="relative overflow-hidden rounded-xl border border-[#d12053]/20 bg-white p-2 shadow-xs">
              <img
                src={qrImageUrl}
                alt="bKash Payment QR Code"
                className="h-44 w-44 object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-8 w-8 rounded-full bg-white p-1 shadow-md border border-[#d12053]/20">
                  <svg viewBox="0 0 100 100" className="h-full w-full fill-[#d12053]">
                    <path d="M50 5 L85 40 L65 50 L85 95 L50 70 L25 80 L35 55 L15 40 Z" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-xs font-bold text-[#d12053] flex items-center gap-1">
              <QrCode size={14} /> Scan with bKash App
            </p>
          </div>

          {/* Driver bKash Number Box */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Or Send Money Manually to Driver's bKash
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-[#d12053]" />
                <span className="font-mono text-sm font-bold text-slate-800 tracking-wider">
                  {driverPhone}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPhone}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {copied ? (
                  <>
                    <Check size={12} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy Number
                  </>
                )}
              </button>
            </div>
          </div>

          {/* TrxID Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Enter bKash Transaction ID (TrxID) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={trxId}
                onChange={(e) => {
                  setTrxId(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="e.g. BL89K7X12P"
                maxLength={20}
                className="w-full uppercase font-mono rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold tracking-widest text-slate-900 outline-none transition focus:border-[#d12053] focus:bg-white focus:ring-4 focus:ring-[#d12053]/10"
              />
              <p className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
                <Info size={11} /> You will receive the TrxID in SMS after completing the payment.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-600">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !trxId.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#d12053] py-2.5 text-xs font-bold text-white shadow-md shadow-[#d12053]/25 transition hover:bg-[#b01742] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} /> Confirm Payment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
