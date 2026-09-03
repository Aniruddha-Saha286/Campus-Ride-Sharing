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
  CheckCircle2,
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

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(driverPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                <Smartphone size={18} className="text-[#d12053]" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-white">Pay via bKash</h3>
                <p className="text-[11px] font-medium text-pink-100">Send Money via bKash App</p>
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

        {/* Modal Body with 4-Step Instructions */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-4">
          <div className="space-y-2.5">
            {/* Step 1 */}
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d12053] font-bold text-white text-[10px]">
                1
              </span>
              <span className="text-slate-700 mt-0.5">
                Open your <strong className="text-[#d12053]">bKash App</strong> on your phone.
              </span>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d12053] font-bold text-white text-[10px]">
                2
              </span>
              <span className="text-slate-700 mt-0.5">
                Tap on <strong className="text-[#d12053]">"Send Money"</strong>.
              </span>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d12053] font-bold text-white text-[10px]">
                3
              </span>
              <div className="flex-1">
                <span className="text-slate-700 block mb-1.5">
                  Send <strong className="text-[#d12053]">৳{Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong> to driver's number:
                </span>
                <div className="flex items-center justify-between rounded-lg bg-white border border-rose-200 px-3 py-2">
                  <span className="font-mono font-bold text-slate-800 text-sm tracking-wider">
                    {driverPhone}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="inline-flex items-center gap-1 rounded-md bg-[#d12053] px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#b01742] transition"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Copied!" : "Copy Number"}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-xs">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d12053] font-bold text-white text-[10px]">
                4
              </span>
              <div className="flex-1">
                <span className="text-slate-700 block font-bold mb-1.5">
                  Fill in the bKash Transaction ID (TrxID) <span className="text-rose-500">*</span>:
                </span>
                <input
                  type="text"
                  value={trxId}
                  onChange={(e) => {
                    setTrxId(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="e.g. 9M7A8K9L"
                  maxLength={20}
                  className="w-full uppercase font-mono font-bold tracking-widest rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#d12053] focus:ring-2 focus:ring-rose-100"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-600 border border-rose-100">
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
              type="button"
              onClick={handleSubmit}
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
        </div>
      </div>
    </div>
  );
}
