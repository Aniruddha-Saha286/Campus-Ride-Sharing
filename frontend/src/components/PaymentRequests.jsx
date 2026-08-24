import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  Plus,
  X,
  Search,
  Loader2,
  BadgeCheck,
  ArrowRight,
  Users,
  HandCoins,
  Clock3,
  Inbox,
  ChevronRight,
  Scale,
} from "lucide-react";
import {
  getMyPaymentRequests,
  createPaymentRequest,
  searchPaymentStudents,
} from "../api/paymentRequestApi";
import { getDues, getPaymentSummary } from "../api/ridePaymentApi";
import usePolling from "../hooks/usePolling";

const STATUS_META = {
  PAID: { label: "Paid", classes: "bg-emerald-50 text-emerald-700" },
  PARTIALLY_PAID: { label: "Partially Paid", classes: "bg-sky-50 text-sky-700" },
  UNPAID: { label: "Unpaid", classes: "bg-amber-50 text-amber-700" },
};

const formatTaka = (value) =>
  `৳${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const avatar = (student) => {
  if (!student) return null;
  const src = student.profilePhoto || null;
  const initial = (student.name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-sm font-bold text-white">
      {src ? <img src={src} alt={student.name} className="h-full w-full object-cover" /> : initial}
    </div>
  );
};

export default function PaymentRequests() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPayer, setSelectedPayer] = useState(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [dues, setDues] = useState(null);
  const [summary, setSummary] = useState(null);

  const load = async () => {
    setError("");
    try {
      const res = await getMyPaymentRequests();
      setData(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load payment requests.");
    } finally {
      setLoading(false);
    }
  };

  const loadDues = async () => {
    try {
      const res = await getDues();
      setDues(res.data.data);
    } catch {}
  };

  const loadSummary = async () => {
    try {
      const res = await getPaymentSummary();
      setSummary(res.data.data);
    } catch {}
  };

  usePolling(load);
  usePolling(loadDues);
  usePolling(loadSummary);

  useEffect(() => {
    if (!searchQuery.trim() || selectedPayer) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchPaymentStudents(searchQuery.trim());
        setResults(res.data.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedPayer]);

  const openCreate = () => {
    setSearchQuery("");
    setResults([]);
    setSelectedPayer(null);
    setAmount("");
    setDescription("");
    setDueDate("");
    setCreateError("");
    setShowCreate(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!selectedPayer) {
      setCreateError("Please select a payer.");
      return;
    }
    setSaving(true);
    setCreateError("");
    try {
      await createPaymentRequest({
        payer: selectedPayer._id,
        amountDue: Number(amount),
        description,
        dueDate: dueDate || undefined,
      });
      setShowCreate(false);
      await load();
    } catch (err) {
      setCreateError(err.response?.data?.message || "Could not create the payment request.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  const owedToMe = data.filter((x) => x.role === "requester");
  const owedByMe = data.filter((x) => x.role === "payer");

  const requestCard = (req) => {
    const meta = STATUS_META[req.status] || STATUS_META.UNPAID;
    const remainingText =
      req.role === "requester"
        ? `Expected to receive ${formatTaka(req.summary.remaining)} more from ${req.counterpart?.name || "them"}`
        : `You need to pay ${formatTaka(req.summary.remaining)} more to ${req.counterpart?.name || "them"}`;
    return (
      <div key={req._id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-400">{req.requestCode}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.classes}`}>
                {meta.label}
              </span>
              {req.dueDate && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock3 size={12} /> Due {formatDate(req.dueDate)}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              {avatar(req.counterpart)}
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-sm font-bold text-slate-800">
                  <span className="truncate">{req.counterpart?.name || "Student"}</span>
                  {req.counterpart?.idVerified && (
                    <BadgeCheck size={14} className="shrink-0 fill-brand-600 text-white" />
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {req.counterpart?.department}, {req.counterpart?.year}
                </p>
              </div>
            </div>
            {req.description && (
              <p className="mt-2 max-w-md truncate text-xs text-slate-500">{req.description}</p>
            )}
          </div>
          <Link
            to={`/payments/${req._id}`}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900"
          >
            View details <ArrowRight size={13} />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Amount due</p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">{formatTaka(req.summary.amountDue)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Amount paid</p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">{formatTaka(req.summary.amountPaid)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Remaining</p>
            <p className="mt-0.5 text-sm font-bold text-slate-800">{formatTaka(req.summary.remaining)}</p>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
          {remainingText}
        </p>
      </div>
    );
  };

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-y-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
              <Wallet size={22} className="text-brand-600" /> Payment Requests
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Request money from verified students and track every payment in one place.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
          >
            <Plus size={15} />
            Create Payment Request
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
            {error}
          </div>
        )}

        {dues && (
          <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              <Scale size={15} /> Net balance
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-rose-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">You owe</p>
                <p className="mt-0.5 text-sm font-bold text-rose-800">{formatTaka(dues.youOweTotal)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Owed to you</p>
                <p className="mt-0.5 text-sm font-bold text-emerald-800">{formatTaka(dues.owedToYouTotal)}</p>
              </div>
              <div className="rounded-xl bg-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Net</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">{formatTaka(dues.net)}</p>
              </div>
            </div>
          </div>
        )}

        {summary?.recentTransactions && summary.recentTransactions.length > 0 && (
          <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                <Clock3 size={15} /> Recent transactions
              </h2>
              <Link
                to="/transactions"
                className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900"
              >
                View all <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {summary.recentTransactions.map((t) => (
                <div key={t._id} className="flex items-center justify-between gap-3 py-2.5">
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
                          <span className="truncate"> · {t.ride.pickup} → {t.ride.dropoff}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        t.direction === "received" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {t.direction === "received" ? "Received" : "Paid"}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        t.direction === "received" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {t.direction === "received" ? "+" : "−"}{formatTaka(t.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-card">
            <Inbox size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">No payment requests yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Create a request to ask a verified student for a payment.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {owedToMe.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                  <HandCoins size={15} /> To be paid to me
                </h2>
                <div className="space-y-4">{owedToMe.map(requestCard)}</div>
              </section>
            )}
            {owedByMe.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                  <Users size={15} /> I need to pay
                </h2>
                <div className="space-y-4">{owedByMe.map(requestCard)}</div>
              </section>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">Create payment request</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitCreate} className="space-y-4 px-5 py-5">
              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-600">Payer / recipient</span>
                {selectedPayer ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {avatar(selectedPayer)}
                      <div>
                        <p className="flex items-center gap-1 text-sm font-bold text-slate-800">
                          {selectedPayer.name}
                          {selectedPayer.idVerified && (
                            <BadgeCheck size={14} className="fill-brand-600 text-white" />
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedPayer.department}, {selectedPayer.year}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPayer(null)}
                      className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search verified students by name..."
                        className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      />
                      {searching && (
                        <Loader2
                          size={14}
                          className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                        />
                      )}
                    </div>
                    {results.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-card">
                        {results.map((s) => (
                          <button
                            type="button"
                            key={s._id}
                            onClick={() => {
                              setSelectedPayer(s);
                              setResults([]);
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50"
                          >
                            {avatar(s)}
                            <div className="min-w-0">
                              <p className="flex items-center gap-1 text-sm font-bold text-slate-800">
                                <span className="truncate">{s.name}</span>
                                {s.idVerified && (
                                  <BadgeCheck size={13} className="shrink-0 fill-brand-600 text-white" />
                                )}
                              </p>
                              <p className="text-xs text-slate-500">
                                {s.department}, {s.year} · {s.homeArea}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchQuery.trim() && !searching && results.length === 0 && (
                      <p className="mt-1 text-xs text-slate-400">No students found.</p>
                    )}
                  </div>
                )}
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Amount due (BDT)</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Description / reason</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="e.g. Shared ride fare for the trip to campus"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Due date (optional)</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>

              {createError && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                  {createError}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedPayer || !amount}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
                  {saving ? "Creating..." : "Create request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
