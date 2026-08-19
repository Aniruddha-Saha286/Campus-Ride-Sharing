import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  Loader2,
  Clock3,
  BadgeCheck,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { getPaymentSummary } from "../api/ridePaymentApi";
import usePolling from "../hooks/usePolling";

const formatTaka = (value) =>
  `৳${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function DashboardPayments() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await getPaymentSummary();
      setSummary(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load payment summary.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  if (loading) {
    return (
      <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-card">
        <Loader2 className="animate-spin text-brand-500" size={22} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <Wallet size={15} /> My payments
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Ride charges, dues and your net balance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/dues"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
          >
            Net balances
          </Link>
          <Link
            to="/transactions"
            className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900"
          >
            All transactions <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {error}
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Recent transactions
        </p>
        {!summary?.recentTransactions || summary.recentTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center">
            <Inbox size={20} className="text-slate-300" />
            <p className="mt-2 text-xs text-slate-400">
              Payments you record will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {summary.recentTransactions.map((t) => (
              <div
                key={t._id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-[11px] font-bold text-white">
                    {(t.counterparty?.name || "?").trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-xs font-bold text-slate-800">
                      <span className="truncate">{t.counterparty?.name || "Student"}</span>
                      {t.counterparty?.idVerified && (
                        <BadgeCheck size={12} className="shrink-0 fill-brand-600 text-white" />
                      )}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock3 size={10} /> {formatDate(t.createdAt)}
                      {t.ride && (
                        <span className="truncate">
                          · {t.ride.pickup} → {t.ride.dropoff}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-xs font-bold ${
                    t.direction === "received" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {t.direction === "received" ? "+" : "−"}
                  {formatTaka(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
