import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { markPaymentSettled } from "../api/paymentApi";

const formatSettledAt = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function PaymentSettlement({ rideId, req, busy, onBusyChange, onSettled }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const isBusy = busy === req._id;

  const openModal = () => {
    setError("");
    setOpen(true);
  };

  const confirm = async () => {
    setError("");
    onBusyChange(req._id);
    try {
      await markPaymentSettled(rideId, req._id);
      setOpen(false);
      onSettled();
    } catch (err) {
      setError(err.response?.data?.message || "Could not settle the payment.");
      onSettled();
    } finally {
      onBusyChange("");
    }
  };

  if (req.status !== "accepted") return null;

  if (req.paymentStatus === "SETTLED") {
    return (
      <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
        <p className="flex items-center gap-1 text-xs font-bold text-emerald-700">
          <Check size={13} /> Payment Settled
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          Settled by: {req.settledBy === "RIDER" ? "Rider" : "Ride Poster"}
        </p>
        <p className="text-xs text-emerald-700">Date: {formatSettledAt(req.settledAt)}</p>
        <p className="text-xs text-emerald-700">Method: External / Offline Payment</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2.5">
        <span className="text-xs font-bold text-amber-700">Payment Pending</span>
        <button
          onClick={openModal}
          disabled={isBusy}
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
          Mark Payment as Settled
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">Confirm settlement</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-slate-500">
                Have you already received/made this payment outside the app? Confirming will mark this ride's payment as settled.
              </p>
              {error && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                  {error}
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                onClick={() => setOpen(false)}
                disabled={isBusy}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={isBusy}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
