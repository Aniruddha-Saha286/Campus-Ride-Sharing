import React, { useState, useMemo } from "react";
import {
  ReceiptText,
  Search,
  Loader2,
  BadgeCheck,
  FileDown,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Inbox,
  RotateCcw,
  ArrowUpDown,
} from "lucide-react";
import {
  getTransactionHistory,
  getTransactionReceipt,
  deleteTransaction,
} from "../api/ridePaymentApi";
import { downloadTransactionHistoryPdf, downloadTransactionReceiptPdf } from "../utils/ridePaymentPdf";
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

const methodLabel = (method) => (method === "BKASH" ? "bKash" : "Manual");

const mergeTransactions = (txns) => {
  const fineMap = new Map();
  txns.forEach((t) => {
    if (t.kind === "FINE" && t.counterparty?._id) {
      fineMap.set(t.counterparty._id, t);
    }
  });
  const merged = [];
  const usedFineIds = new Set();
  txns.forEach((t) => {
    if (t.kind === "REFUND" && t.counterparty?._id && fineMap.has(t.counterparty._id)) {
      const fine = fineMap.get(t.counterparty._id);
      if (!usedFineIds.has(fine._id)) {
        usedFineIds.add(fine._id);
        merged.push({
          _id: t._id,
          _ids: [t._id, fine._id],
          transactionId: t.transactionId,
          kind: "REFUND_FINE",
          direction: t.direction,
          role: t.role,
          amount: (t.amount || 0) + (fine.amount || 0),
          refundAmount: t.amount,
          fineAmount: fine.amount,
          method: t.method,
          counterparty: t.counterparty,
          ride: t.ride,
          createdAt: t.createdAt,
          isMerged: true,
        });
        return;
      }
    }
    if (t.kind !== "FINE" || !usedFineIds.has(t._id)) {
      merged.push(t);
    }
  });
  return merged;
};

export default function TransactionHistory() {
  const [rawData, setRawData] = useState([]);
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({ received: 0, paid: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    direction: "",
    method: "",
    from: "",
    to: "",
    search: "",
  });
  const [roleTab, setRoleTab] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [busy, setBusy] = useState("");

  const query = () => {
    const params = {};
    if (filters.direction) params.direction = filters.direction;
    if (filters.method) params.method = filters.method;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.search.trim()) params.search = filters.search.trim();
    return params;
  };

  const load = async () => {
    setError("");
    try {
      const res = await getTransactionHistory(query());
      const raw = res.data.data || [];
      setRawData(raw);
      setData(mergeTransactions(raw));
      setTotals(res.data.totals || { received: 0, paid: 0, net: 0 });
    } catch (err) {
      setError(err.response?.data?.message || "Could not load transactions.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  const filteredData = useMemo(() => {
    let list = data;
    if (roleTab !== "all") list = list.filter((t) => t.role === roleTab);
    return [...list].sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      if (sortBy === "latest") return bDate - aDate;
      if (sortBy === "oldest") return aDate - bDate;
      if (sortBy === "amount_desc") return (b.amount || 0) - (a.amount || 0);
      if (sortBy === "amount_asc") return (a.amount || 0) - (b.amount || 0);
      return 0;
    });
  }, [data, roleTab, sortBy]);

  const allTotals = useMemo(() => {
    let received = 0;
    let paid = 0;
    data.forEach((t) => {
      if (t.direction === "received") received += t.amount || 0;
      else if (t.direction === "paid") paid += t.amount || 0;
    });
    return { received, paid, net: received - paid };
  }, [data]);

  const roleCounts = useMemo(() => {
    let driver = 0;
    let passenger = 0;
    data.forEach((t) => {
      if (t.role === "driver") driver++;
      else if (t.role === "passenger") passenger++;
    });
    return { driver, passenger, all: data.length };
  }, [data]);

  const setField = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () =>
    setFilters({ direction: "", method: "", from: "", to: "", search: "" });

  const remove = async (id) => {
    setBusy(id);
    setError("");
    try {
      await deleteTransaction(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove the transaction.");
    } finally {
      setBusy("");
    }
  };

  const downloadPdf = () => {
    downloadTransactionHistoryPdf({ data: filteredData, totals: allTotals });
  };

  const downloadReceipt = async (t) => {
    if (t.isMerged && t._ids) {
      setBusy(t._id);
      setError("");
      try {
        const results = await Promise.all(t._ids.map((id) => getTransactionReceipt(id)));
        const receipts = results.map((r) => r.data.data);
        downloadTransactionReceiptPdf({ ...receipts[0], merged: true, receipts });
      } catch (err) {
        setError(err.response?.data?.message || "Could not fetch the receipt.");
      } finally {
        setBusy("");
      }
      return;
    }
    const id = t._id;
    setBusy(id);
    setError("");
    try {
      const res = await getTransactionReceipt(id);
      downloadTransactionReceiptPdf(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not fetch the receipt.");
    } finally {
      setBusy("");
    }
  };

  const filterButton = (label, value, activeValue) => (
    <button
      onClick={() => setField("direction", activeValue)}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        filters.direction === activeValue
          ? "bg-slate-800 text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
      }`}
    >
      {label}
    </button>
  );

  const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-y-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
              <ReceiptText size={22} className="text-brand-600" /> Transaction History
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Every payment you recorded for ride charges and manual dues.
            </p>
          </div>
          <button
            onClick={downloadPdf}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-60"
          >
            <FileDown size={15} />
            Download PDF
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        <div className="mb-5 flex gap-2">
          {[
            { key: "all", label: "All Transactions", count: roleCounts.all },
            { key: "driver", label: "As Driver", count: roleCounts.driver },
            { key: "passenger", label: "As Passenger", count: roleCounts.passenger },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRoleTab(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                roleTab === tab.key
                  ? "bg-slate-800 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                roleTab === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="mb-5 space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            {filterButton("All", "all", "")}
            {filterButton("Received", "received", "received")}
            {filterButton("Paid", "paid", "paid")}
            <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
            <button
              onClick={() => setField("method", filters.method === "bkash" ? "" : "bkash")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filters.method === "bkash"
                  ? "bg-rose-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
              }`}
            >
              bKash
            </button>
            <button
              onClick={() => setField("method", filters.method === "manual" ? "" : "manual")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filters.method === "manual"
                  ? "bg-sky-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
              }`}
            >
              Manual
            </button>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative flex items-center">
                <ArrowUpDown size={12} className="pointer-events-none absolute left-2.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort transactions"
                  className="rounded-full border border-slate-200 bg-white py-1.5 pl-7 pr-6 text-xs font-bold text-slate-700 shadow-2xs outline-none transition hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 cursor-pointer"
                >
                  <option value="latest">Latest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="amount_desc">Amount (High to Low)</option>
                  <option value="amount_asc">Amount (Low to High)</option>
                </select>
              </div>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition hover:text-slate-600 cursor-pointer"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search}
                onChange={(e) => setField("search", e.target.value)}
                placeholder="Search counterparty name..."
                className={`${input} pl-8`}
              />
            </div>
            <div className="flex flex-col gap-2 lg:col-span-1 lg:flex-row">
              <input type="date" value={filters.from} onChange={(e) => setField("from", e.target.value)} className={input} />
              <input type="date" value={filters.to} onChange={(e) => setField("to", e.target.value)} className={input} />
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-emerald-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Total received</p>
            <p className="mt-0.5 text-sm font-bold text-emerald-800">{formatTaka(allTotals.received)}</p>
          </div>
          <div className="rounded-xl bg-rose-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Total paid</p>
            <p className="mt-0.5 text-sm font-bold text-rose-800">{formatTaka(allTotals.paid)}</p>
          </div>
          <div className="rounded-xl bg-slate-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Net balance</p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">{formatTaka(allTotals.net)}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="animate-spin text-brand-500" size={26} />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-card">
            <Inbox size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">No transactions found</p>
            <p className="mt-1 text-xs text-slate-400">
              {roleTab === "driver" && "No driver transactions yet."}
              {roleTab === "passenger" && "No passenger transactions yet."}
              {roleTab === "all" && "Try adjusting your filters, or record a payment from a ride."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Date & time</th>
                    <th className="px-4 py-3 font-semibold">Transaction</th>
                    <th className="px-4 py-3 font-semibold">Counterparty</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((t) => (
                    <tr key={t.isMerged ? `merged-${t._id}` : t._id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-bold text-slate-700">
                          {t.isMerged ? `${t.transactionId} + fine` : t.transactionId}
                        </p>
                        {t.ride && (
                          <p className="mt-0.5 max-w-[10rem] truncate text-[11px] text-slate-400">
                            {t.ride.pickup} → {t.ride.dropoff}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1 text-xs font-bold text-slate-800">
                          <span className="truncate">{t.counterparty?.name || "—"}</span>
                          {t.counterparty?.idVerified && (
                            <BadgeCheck size={12} className="shrink-0 fill-brand-600 text-white" />
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {t.counterparty?.department || ""} {t.counterparty?.year || ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            t.isMerged
                              ? "bg-orange-50 text-orange-700"
                              : t.kind === "FINE"
                                ? "bg-orange-50 text-orange-700"
                                : t.direction === "received"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {t.direction === "received" ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />}
                          {t.isMerged ? "Refund + Fine" : t.kind === "FINE" ? "Fine" : t.direction === "received" ? "Received" : "Paid"}
                        </span>
                        {t.isMerged && (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Refund {formatTaka(t.refundAmount)} + Fine {formatTaka(t.fineAmount)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600">{methodLabel(t.method)}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-slate-800">{formatTaka(t.amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => downloadReceipt(t)}
                            disabled={busy === t._id}
                            title="Download receipt"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                          >
                            {busy === t._id ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />}
                          </button>
                          {!t.isMerged && (
                            <button
                              onClick={() => remove(t._id)}
                              title="Hide from my history"
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
