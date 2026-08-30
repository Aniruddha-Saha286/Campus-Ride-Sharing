import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Clock3,
  Search,
  Loader2,
  BadgeCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  Inbox,
  ArrowUpDown,
  FileDown,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Wallet,
  MapPin,
  CarFront,
  Users,
} from "lucide-react";
import { getTransactionHistory, getTransactionReceipt } from "../api/ridePaymentApi";
import { downloadTransactionReceiptPdf } from "../utils/ridePaymentPdf";
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

export default function RecentTransactions() {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({ received: 0, paid: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [directionTab, setDirectionTab] = useState("all"); // 'all' | 'received' | 'paid'
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [downloadingId, setDownloadingId] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await getTransactionHistory();
      const raw = res.data?.data?.transactions || [];
      const merged = mergeTransactions(raw);
      setData(merged);
      setTotals(res.data?.data?.totals || { received: 0, paid: 0, net: 0 });
    } catch (err) {
      setError(err.response?.data?.message || "Could not load recent transactions.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  const handleDownloadReceipt = async (t) => {
    setDownloadingId(t._id);
    try {
      const res = await getTransactionReceipt(t._id);
      const receiptData = res.data.data;
      await downloadTransactionReceiptPdf(receiptData);
    } catch (err) {
      alert(err.response?.data?.message || "Could not download receipt.");
    } finally {
      setDownloadingId("");
    }
  };

  const counts = useMemo(() => {
    let received = 0;
    let paid = 0;
    data.forEach((t) => {
      if (t.direction === "received") received++;
      else if (t.direction === "paid") paid++;
    });
    return { all: data.length, received, paid };
  }, [data]);

  const filteredAndSorted = useMemo(() => {
    let list = data;

    // Filter direction
    if (directionTab === "received") {
      list = list.filter((t) => t.direction === "received");
    } else if (directionTab === "paid") {
      list = list.filter((t) => t.direction === "paid");
    }

    // Filter search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((t) => {
        const name = (t.counterparty?.name || "").toLowerCase();
        const txnId = (t.transactionId || "").toLowerCase();
        const pickup = (t.ride?.pickup || "").toLowerCase();
        const dropoff = (t.ride?.dropoff || "").toLowerCase();
        return name.includes(q) || txnId.includes(q) || pickup.includes(q) || dropoff.includes(q);
      });
    }

    // Sort
    return [...list].sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      if (sortBy === "latest") return bDate - aDate;
      if (sortBy === "oldest") return aDate - bDate;
      if (sortBy === "amount_desc") return (b.amount || 0) - (a.amount || 0);
      if (sortBy === "amount_asc") return (a.amount || 0) - (b.amount || 0);
      return 0;
    });
  }, [data, directionTab, searchQuery, sortBy]);

  const avatar = (student) => {
    if (!student) return null;
    const src = student.profilePhoto || null;
    const initial = (student.name || "?").trim().charAt(0).toUpperCase();
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-bold text-white shadow-2xs">
        {src ? <img src={src} alt={student.name} className="h-full w-full object-cover" /> : initial}
      </div>
    );
  };

  return (
    <div className="w-full max-w-none px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                <Clock3 size={18} />
              </span>
              Recent Transactions
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Live record of all incoming and outgoing payments with receipts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/transactions"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-300"
            >
              Full Transaction History <ChevronRight size={13} />
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Total Received
              </span>
              <ArrowDownToLine size={16} className="text-emerald-600" />
            </div>
            <p className="mt-1 text-xl font-black text-emerald-900">{formatTaka(totals.received)}</p>
          </div>

          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                Total Paid
              </span>
              <ArrowUpFromLine size={16} className="text-rose-600" />
            </div>
            <p className="mt-1 text-xl font-black text-rose-900">{formatTaka(totals.paid)}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Net Balance Flow
              </span>
              <Wallet size={16} className="text-brand-600" />
            </div>
            <p
              className={`mt-1 text-xl font-black ${
                totals.net >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {totals.net >= 0 ? `+${formatTaka(totals.net)}` : formatTaka(totals.net)}
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          {/* Main Search Input */}
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recent transactions by student name, route, or transaction ID..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-10 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Filter Tabs & Sort Dropdown */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDirectionTab("all")}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  directionTab === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Transactions ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setDirectionTab("received")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  directionTab === "received"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <ArrowDownToLine size={13} />
                Received ({counts.received})
              </button>
              <button
                type="button"
                onClick={() => setDirectionTab("paid")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  directionTab === "paid"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <ArrowUpFromLine size={13} />
                Paid ({counts.paid})
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sort:</span>
              <div className="relative flex items-center">
                <ArrowUpDown size={13} className="pointer-events-none absolute left-3 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-bold text-slate-700 shadow-2xs outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
                >
                  <option value="latest">Latest Date First</option>
                  <option value="oldest">Oldest Date First</option>
                  <option value="amount_desc">Amount (High to Low)</option>
                  <option value="amount_asc">Amount (Low to High)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="animate-spin text-brand-600" size={28} />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
              <Inbox size={24} />
            </div>
            <p className="mt-3 text-sm font-bold text-slate-700">No transactions recorded yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Approved ride fares and completed payments will be logged here.
            </p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-card">
            <Search size={24} className="text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">No matching transactions found</p>
            <p className="mt-1 text-xs text-slate-400">
              {searchQuery ? `No records matched "${searchQuery}".` : "Try adjusting your filter criteria."}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDirectionTab("all");
              }}
              className="mt-3 text-xs font-bold text-brand-600 hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAndSorted.map((t) => {
              const isReceived = t.direction === "received";
              return (
                <div
                  key={t._id}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Left: Counterpart & Details */}
                    <div className="flex items-center gap-3 min-w-0">
                      {avatar(t.counterparty)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm truncate">
                            {t.counterparty?.name || "Student"}
                          </span>
                          {t.counterparty?.idVerified && (
                            <BadgeCheck size={14} className="shrink-0 fill-brand-600 text-white" />
                          )}
                          <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            {t.transactionId}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock3 size={11} />
                            {formatDate(t.createdAt)}
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-slate-600">
                            Via {methodLabel(t.method)}
                          </span>
                          {t.ride && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1 text-slate-600 truncate max-w-xs">
                                <MapPin size={11} className="text-brand-500 shrink-0" />
                                {t.ride.pickup} → {t.ride.dropoff}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Direction, Amount & Receipt */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isReceived
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-rose-50 text-rose-700 border border-rose-200/60"
                            }`}
                          >
                            {isReceived ? "Received" : "Paid"}
                          </span>
                        </div>
                        <p
                          className={`mt-0.5 text-base font-black tracking-tight ${
                            isReceived ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isReceived ? "+" : "−"}{formatTaka(t.amount)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(t)}
                        disabled={downloadingId === t._id}
                        className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                        title="Download Receipt (PDF)"
                      >
                        {downloadingId === t._id ? (
                          <Loader2 size={15} className="animate-spin text-brand-600" />
                        ) : (
                          <FileDown size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
