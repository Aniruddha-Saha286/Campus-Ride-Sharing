import React, { useState } from "react";
import {
  X,
  QrCode,
  Wallet,
  Check,
  Loader2,
  Info,
  Copy,
  Smartphone,
  User,
} from "lucide-react";

export default function DriverProcessRefundModal({ isOpen, onClose, request, onConfirm, busy }) {
  const [refundMethod, setRefundMethod] = useState("BKASH");
  const [trxId, setTrxId] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isOpen || !request) return null;

  const payment = request.payment;
  const refundAmount = payment ? payment.amountPaid || payment.originalAmount || 0 : 0;

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

  const passengerPhone = cleanPhone(request.rider?.phone);
  const passengerName = request.rider?.name || "Passenger";

  // Raw phone number payload directly recognized by bKash app scanner for Send Money
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    passengerPhone
  )}&color=d12053&bgcolor=ffffff`;

  const handleCopyPhone = () => {
    if (!passengerPhone) return;
    navigator.clipboard.writeText(passengerPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (refundMethod === "BKASH" && !trxId.trim()) {
      setError("Please enter the bKash Transaction ID (TrxID).");
      return;
    }
    setError("");
    onConfirm(payment._id, refundMethod, refundMethod === "BKASH" ? trxId.trim() : null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
          <h3 className="text-base font-bold text-slate-800">
            Process Passenger Refund
          </h3>
          <button onClick={onClose} disabled={busy} className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-rose-600">
              {error}
            </div>
          )}

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1 border border-slate-100">
            <p>Passenger: <strong className="text-slate-800">{passengerName}</strong></p>
            <p>Amount to refund: <strong className="text-emerald-700 font-bold">৳{refundAmount}</strong></p>
            {request.cancelReason && (
              <p className="text-slate-500 italic">" {request.cancelReason} "</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Refund Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRefundMethod("BKASH")}
                className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold transition border ${
                  refundMethod === "BKASH"
                    ? "border-[#d12053] bg-pink-50 text-[#d12053] shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <QrCode size={15} />
                bKash
              </button>
              <button
                type="button"
                onClick={() => setRefundMethod("MANUAL")}
                className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold transition border ${
                  refundMethod === "MANUAL"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Wallet size={15} />
                Manual Cash
              </button>
            </div>
          </div>

          {refundMethod === "BKASH" && (
            <div className="space-y-3 pt-1">
              {/* QR Code Card */}
              <div className="rounded-2xl border border-pink-200 bg-pink-50/40 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative shrink-0 rounded-xl border border-[#d12053]/20 bg-white p-2 shadow-xs">
                    <img
                      src={qrUrl}
                      alt={`bKash QR for ${passengerName}`}
                      className="h-28 w-28 object-contain rounded-lg"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="h-5 w-5 rounded-full bg-white p-0.5 shadow-xs border border-[#d12053]/30">
                        <svg viewBox="0 0 100 100" className="h-full w-full fill-[#d12053]">
                          <path d="M50 5 L85 40 L65 50 L85 95 L50 70 L25 80 L35 55 L15 40 Z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                    <p className="text-xs font-bold text-[#d12053] flex items-center justify-center sm:justify-start gap-1">
                      <QrCode size={13} /> Scan via bKash App
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Send <strong>৳{refundAmount}</strong> to {passengerName}'s bKash number.
                    </p>

                    <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-2.5 py-1 text-xs">
                      <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                        <Smartphone size={12} className="text-[#d12053]" />
                        {passengerPhone}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyPhone}
                        className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
                          copied
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {copied ? (
                          <>
                            <Check size={10} /> Copied
                          </>
                        ) : (
                          <>
                            <Copy size={10} /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  bKash Refund Transaction ID (TrxID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                  placeholder="e.g. 9J28AS89K"
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs font-bold tracking-widest text-slate-800 outline-none focus:border-[#d12053] focus:ring-2 focus:ring-pink-100"
                />
                <p className="text-[11px] text-slate-400">
                  Paste the TrxID here once payment is sent.
                </p>
              </div>
            </div>
          )}

          {refundMethod === "MANUAL" && (
            <p className="text-[11px] text-slate-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100">
              You agree to return ৳{refundAmount} in cash to {passengerName}.
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              Confirm Refund
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

