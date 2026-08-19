import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Scale,
  Loader2,
  BadgeCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Inbox,
  HandCoins,
} from "lucide-react";
import { getDues } from "../api/ridePaymentApi";
import usePolling from "../hooks/usePolling";

const formatTaka = (value) =>
  `৳${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function NetBalances() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await getDues();
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load balances.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  const personRow = (d) => (
    <div key={d.counterparty._id} className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white">
          {d.counterparty.profilePhoto ? (
            <img src={d.counterparty.profilePhoto} alt={d.counterparty.name} className="h-full w-full object-cover" />
          ) : (
            (d.counterparty.name || "?").trim().charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-sm font-bold text-slate-800">
            <span className="truncate">{d.counterparty.name}</span>
            {d.counterparty.idVerified && (
              <BadgeCheck size={14} className="shrink-0 fill-brand-600 text-white" />
            )}
          </p>
          <p className="text-xs text-slate-500">
            {d.counterparty.department}, {d.counterparty.year}
          </p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-bold text-slate-800">{formatTaka(d.amount)}</span>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
          <Scale size={22} className="text-brand-600" /> Net balances
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          What you owe and are owed after matching your dues against theirs.
        </p>

        {error && (
          <div className="mt-5 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-rose-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">You owe</p>
            <p className="mt-0.5 text-sm font-bold text-rose-800">{formatTaka(data?.youOweTotal)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Owed to you</p>
            <p className="mt-0.5 text-sm font-bold text-emerald-800">{formatTaka(data?.owedToYouTotal)}</p>
          </div>
          <div className="rounded-xl bg-slate-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Net</p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">{formatTaka(data?.net)}</p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              <ArrowUpFromLine size={15} /> You owe
            </h2>
            {data?.youOwe?.length ? (
              <div className="mt-2 divide-y divide-slate-100">{data.youOwe.map(personRow)}</div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-xs text-slate-400">
                <Inbox size={16} /> Nothing owed after netting.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              <ArrowDownToLine size={15} /> Owed to you
            </h2>
            {data?.owedToYou?.length ? (
              <div className="mt-2 divide-y divide-slate-100">{data.owedToYou.map(personRow)}</div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-xs text-slate-400">
                <HandCoins size={16} /> Nothing owed to you right now.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
