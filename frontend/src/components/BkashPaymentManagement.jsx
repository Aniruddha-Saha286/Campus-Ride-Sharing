import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";

export default function BkashPaymentManagement({
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
  const [customPhone, setCustomPhone] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  if (!isOpen || !payment) return null;

  const driverObj = driver || ride?.poster;
  const amount = payment.totalOutstanding || payment.originalAmount || 0;
  const driverName = driverObj?.name || "Driver";

  // Clean to standard 11-digit Bangladeshi mobile number format (e.g. 017XXXXXXXX)
  const cleanPhone = (phone) => {
    if (!phone) return "";
    let cleaned = String(phone).replace(/\D/g, "");
    if (cleaned.startsWith("880") && cleaned.length >= 13) {
      cleaned = "0" + cleaned.slice(3);
    } else if (!cleaned.startsWith("0") && cleaned.length === 10) {
      cleaned = "0" + cleaned;
    }
    return cleaned;
  };

  const defaultPhone = cleanPhone(driverObj?.phone) || "01700000000";
  const activePhone = cleanPhone(customPhone) || defaultPhone;

  const confirmFn = onConfirm || onSubmit;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(activePhone);
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
                <h3 className="text-lg font-black tracking-tight text-white">bKash Send Money</h3>
                <p className="text-[11px] font-medium text-pink-100">Pay Fare via bKash Personal</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-full bg-white/15 p-1.5 text-white transition hover:bg-white/25 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Amount & Driver Header Badge */}
          <div className="mt-4 flex items-baseline justify-between rounded-2xl bg-black/15 px-4 py-2.5 backdrop-blur-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200">
                Fare Amount
              </span>
              <p className="text-xl font-extrabold text-white">
                ৳{Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200">
                Driver (Recipient)
              </span>
              <p className="text-xs font-bold text-white truncate max-w-[140px]">{driverName}</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-4">
          {/* Driver bKash Number Box with Big Copy Button */}
          <div className="rounded-2xl border-2 border-[#d12053]/20 bg-pink-50/40 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#d12053] flex items-center gap-1">
                <Smartphone size={13} /> Driver's bKash Number
              </p>
              <button
                type="button"
                onClick={() => setIsEditingPhone(!isEditingPhone)}
                className="text-[11px] font-bold text-brand-600 hover:underline cursor-pointer"
              >
                {isEditingPhone ? "Done" : "Change Number"}
              </button>
            </div>

            {isEditingPhone ? (
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder={defaultPhone}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#d12053]"
                />
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(false)}
                  className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                >
                  Set
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-black text-slate-900 tracking-wider">
                  {activePhone}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold shadow-xs transition cursor-pointer ${
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-[#d12053] text-white hover:bg-[#b01742]"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={14} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy Number
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Step-by-Step bKash Send Money Guide */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 space-y-2 text-xs text-slate-700">
            <p className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Info size={14} className="text-[#d12053]" /> How to Pay via bKash App:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed font-medium">
              <li>
                Open <strong>bKash App</strong> ➜ Tap <strong>সেন্ড মানি (Send Money)</strong> on the home screen.
              </li>
              <li>
                Paste number <strong className="text-slate-900 font-mono bg-white px-1.5 py-0.5 rounded-md border border-slate-200">{activePhone}</strong>.
              </li>
              <li>
                Enter amount <strong className="text-[#d12053]">৳{Number(amount).toLocaleString()}</strong> and enter your PIN.
              </li>
              <li>
                Copy the <strong>TrxID</strong> from the SMS confirmation and paste it below.
              </li>
            </ol>
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
                <Info size={11} /> You will receive the 8-10 character TrxID in SMS after completing Send Money.
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
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !trxId.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#d12053] py-2.5 text-xs font-bold text-white shadow-md shadow-[#d12053]/25 transition hover:bg-[#b01742] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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

