import React, { useState } from "react";
import {
  X,
  AlertTriangle,
  QrCode,
  Wallet,
  Check,
  Loader2,
  Info,
  Copy,
  Smartphone,
  User,
} from "lucide-react";

export default function DriverCancelRefundModal({ isOpen, onClose, ride, onConfirm, busy }) {
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("BKASH");
  const [trxId, setTrxId] = useState("");
  const [error, setError] = useState("");
  const [copiedPhone, setCopiedPhone] = useState(null);

  if (!isOpen || !ride) return null;

  const paidRequests = (ride.requests || []).filter(
    (r) => r.payment && (r.payment.amountPaid > 0 || r.payment.status === "PAID" || r.paymentStatus === "SETTLED")
  );
  const totalPaid = paidRequests.reduce((sum, r) => sum + (r.payment?.amountPaid || r.payment?.originalAmount || 0), 0);
  const hasPaidPassengers = paidRequests.length > 0;

  const handleCopy = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2500);
  };

  const handleCancelSubmit = (e) => {
    e.preventDefault();
    if (hasPaidPassengers && !reason.trim()) {
      setError("Please provide a reason for cancellation.");
      return;
    }
    if (hasPaidPassengers && refundMethod === "BKASH" && !trxId.trim()) {
      setError("Please enter the bKash Transaction ID (TrxID) for the refund.");
      return;
    }

    setError("");
    onConfirm({
      cancelReason: reason.trim() || "Cancelled by driver",
      refundMethod: hasPaidPassengers ? refundMethod : null,
      refundTransactionId: hasPaidPassengers && refundMethod === "BKASH" ? trxId.trim() : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <AlertTriangle size={18} className="text-rose-600" />
            Cancel Ride Offer
          </h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCancelSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-rose-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Cancellation {hasPaidPassengers ? <span className="text-rose-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={hasPaidPassengers ? "e.g. Car mechanical issue, class cancelled, emergency..." : "Optional reason (no paid passengers)..."}
              rows={hasPaidPassengers ? 3 : 2}
              required={hasPaidPassengers}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {hasPaidPassengers
                ? "This reason will be visible to all refunded passengers."
                : "No payments have been made. You can cancel directly."}
            </p>
          </div>

          {/* Refund Section if passengers have paid */}
          {hasPaidPassengers ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    Refund Required for {paidRequests.length} Passenger{paidRequests.length > 1 ? "s" : ""}
                  </h4>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Total amount to refund: <strong>৳{totalPaid}</strong>. Please refund via bKash or Manual Cash.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
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
                  bKash Refund
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

              {refundMethod === "BKASH" && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-[#d12053] uppercase tracking-wider flex items-center gap-1.5">
                      <QrCode size={14} /> Passenger bKash QR Code & Details
                    </p>

                    {paidRequests.map((req, idx) => {
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

                      const passengerPhone = cleanPhone(req.rider?.phone);
                      const passengerName = req.rider?.name || `Passenger ${idx + 1}`;
                      const amount = req.payment?.amountPaid || req.payment?.originalAmount || 0;
                      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        passengerPhone
                      )}&color=d12053&bgcolor=ffffff`;

                      return (
                        <div
                          key={req._id || idx}
                          className="rounded-2xl border border-pink-200 bg-white p-4 shadow-xs space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-pink-100 pb-2">
                            <div className="flex items-center gap-2">
                              <User size={15} className="text-[#d12053]" />
                              <span className="text-xs font-bold text-slate-800">{passengerName}</span>
                            </div>
                            <span className="text-xs font-extrabold text-[#d12053] bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-200">
                              Refund: ৳{amount}
                            </span>
                          </div>

                          {/* QR Code and Instructions */}
                          <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="relative shrink-0 rounded-xl border border-[#d12053]/20 bg-pink-50/40 p-2 shadow-xs">
                              <img
                                src={qrUrl}
                                alt={`bKash QR for ${passengerName}`}
                                className="h-32 w-32 object-contain rounded-lg"
                              />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="h-6 w-6 rounded-full bg-white p-0.5 shadow-sm border border-[#d12053]/30">
                                  <svg viewBox="0 0 100 100" className="h-full w-full fill-[#d12053]">
                                    <path d="M50 5 L85 40 L65 50 L85 95 L50 70 L25 80 L35 55 L15 40 Z" />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                              <p className="text-[11px] font-semibold text-slate-600">
                                Scan using your <strong>bKash App</strong> to send <strong>৳{amount}</strong> refund directly.
                              </p>

                              <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs">
                                <span className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                                  <Smartphone size={13} className="text-[#d12053]" />
                                  {passengerPhone}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(passengerPhone)}
                                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                                    copiedPhone === passengerPhone
                                      ? "bg-emerald-600 text-white"
                                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                                  }`}
                                >
                                  {copiedPhone === passengerPhone ? (
                                    <>
                                      <Check size={11} /> Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={11} /> Copy
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Enter bKash Refund Transaction ID (TrxID) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                      placeholder="e.g. BL92A8ZK91"
                      className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs font-bold tracking-widest text-slate-800 outline-none focus:border-[#d12053] focus:ring-2 focus:ring-pink-100"
                    />
                    <p className="text-[11px] text-slate-400">
                      Status will show <strong>Pending</strong> until the passenger confirms receiving the refund.
                    </p>
                  </div>
                </div>
              )}

              {refundMethod === "MANUAL" && (
                <p className="text-[11px] text-slate-600 bg-white/70 p-2.5 rounded-xl border border-amber-100">
                  You agree to refund <strong>৳{totalPaid}</strong> in cash. Status will show <strong>Pending</strong> until the passenger confirms.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 border border-slate-100">
              No payments have been made for this ride. The ride will be cancelled immediately.
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Keep Ride
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={14} /> : <X size={14} />}
              Confirm Cancellation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

