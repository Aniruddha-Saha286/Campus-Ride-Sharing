import React, { useState, useEffect } from "react";
import {
  Users,
  Wallet,
  BadgeCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  TrendingDown,
  Sparkles,
  Pencil,
  Check,
  Coins,
  Sliders,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  getRideSplit,
  updateTotalTripCost,
  confirmRiderShare,
} from "../api/autoCostSplitApi";
import {
  getAdjustableSplit,
  setCustomShares,
  resetToEqualSplit,
} from "../api/adjustableCostSplitApi";

const formatTaka = (val) =>
  `৳${Number(val || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function AutoCostSplitModal({ rideId, onClose, onUpdated }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [newCostInput, setNewCostInput] = useState("");
  const [updating, setUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Adjustable Custom Shares State
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [customInputs, setCustomInputs] = useState({});
  const [customReason, setCustomReason] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);

  const fetchSplit = async () => {
    try {
      setLoading(true);
      setError("");
      // Fetch adjustable split data which includes custom override statuses
      const [autoRes, adjRes] = await Promise.all([
        getRideSplit(rideId).catch(() => null),
        getAdjustableSplit(rideId).catch(() => null),
      ]);

      const baseData = autoRes?.data?.data || adjRes?.data?.data;
      if (!baseData) throw new Error("Could not load cost split data");

      // Merge custom share flags if present
      if (adjRes?.data?.data?.riders) {
        const adjMap = new Map(
          adjRes.data.data.riders.map((r) => [String(r.rider?._id || r.rider), r])
        );
        baseData.confirmedRiders = baseData.confirmedRiders.map((item) => {
          const adj = adjMap.get(String(item.rider?._id || item.rider));
          return {
            ...item,
            splitShare: adj ? adj.splitShare : item.splitShare,
            isCustom: adj ? adj.isCustom : false,
            customNote: adj ? adj.customNote : "",
          };
        });
        baseData.splitMode = adjRes.data.data.splitMode || baseData.splitMode;
      }

      setData(baseData);
      setNewCostInput(String(baseData.totalTripCost || 0));

      // Pre-fill custom inputs
      const initialInputs = {};
      baseData.confirmedRiders?.forEach((r) => {
        initialInputs[String(r.rider?._id || r.rider)] = String(r.splitShare || 0);
      });
      setCustomInputs(initialInputs);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load cost split details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rideId) {
      fetchSplit();
    }
  }, [rideId]);

  const handleUpdateCost = async (e) => {
    e.preventDefault();
    const cost = Number(newCostInput);
    if (isNaN(cost) || cost < 0) {
      setError("Please enter a valid non-negative cost amount.");
      return;
    }
    try {
      setUpdating(true);
      setError("");
      setSuccessMsg("");
      const res = await updateTotalTripCost(rideId, cost);
      setSuccessMsg(res.data.message || "Total trip cost updated.");
      setIsEditingCost(false);
      await fetchSplit();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update total cost.");
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveCustomShares = async (e) => {
    e.preventDefault();
    const sharesPayload = Object.entries(customInputs).map(([riderId, amt]) => ({
      riderId,
      amount: Number(amt) || 0,
    }));

    if (sharesPayload.length === 0) {
      setError("No confirmed riders to adjust.");
      return;
    }

    try {
      setSavingCustom(true);
      setError("");
      setSuccessMsg("");
      const res = await setCustomShares(rideId, sharesPayload, customReason);
      setSuccessMsg(res.data.message || "Custom shares set successfully.");
      setIsAdjusting(false);
      await fetchSplit();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to override custom shares.");
    } finally {
      setSavingCustom(false);
    }
  };

  const handleResetToEqual = async () => {
    try {
      setSavingCustom(true);
      setError("");
      setSuccessMsg("");
      const res = await resetToEqualSplit(rideId);
      setSuccessMsg(res.data.message || "Reset to default equal split.");
      setIsAdjusting(false);
      await fetchSplit();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset split.");
    } finally {
      setSavingCustom(false);
    }
  };

  const handleConfirmShare = async () => {
    try {
      setConfirming(true);
      setError("");
      const res = await confirmRiderShare(rideId);
      setSuccessMsg(res.data.message || "Share confirmed.");
      await fetchSplit();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to confirm share.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Coins size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cost Sharing</h3>
              <p className="text-xs text-slate-500 font-medium">
                Auto equal split by default · Driver adjustable shares
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="mt-3 text-xs text-slate-400 font-medium">Calculating cost breakdown...</p>
            </div>
          ) : error && !data ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <>
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {successMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Ride Route Preview */}
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block mb-0.5">Route</span>
                  <p className="font-semibold text-slate-800">
                    {data.pickup?.split(",")[0]} <ArrowRight size={12} className="inline mx-1 text-slate-400" /> {data.dropoff?.split(",")[0]}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block mb-0.5">Departure</span>
                  <span className="font-semibold text-slate-700">{data.departureTime}</span>
                </div>
              </div>

              {/* Total Trip Cost & Mode Status */}
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/90 to-indigo-50/50 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                      <Sparkles size={13} /> Total Trip Cost
                    </span>
                    {!isEditingCost ? (
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">
                          {formatTaka(data.totalTripCost)}
                        </span>
                        {data.isDriver && (
                          <button
                            onClick={() => setIsEditingCost(true)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100/60"
                            title="Edit trip total cost"
                          >
                            <Pencil size={12} /> Edit
                          </button>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleUpdateCost} className="mt-2 flex items-center gap-2">
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">৳</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={newCostInput}
                            onChange={(e) => setNewCostInput(e.target.value)}
                            className="w-28 rounded-lg border border-blue-300 bg-white py-1.5 pl-6 pr-2 text-sm font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                            autoFocus
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={updating}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        >
                          {updating ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingCost(false);
                            setNewCostInput(String(data.totalTripCost));
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Split Mode Indicator */}
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                      Split Mode
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider mt-1 ${
                      data.splitMode === "CUSTOM"
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-blue-100 text-blue-800 border border-blue-200"
                    }`}>
                      {data.splitMode === "CUSTOM" ? "Adjusted / Custom" : "Equal Split (Default)"}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      {data.confirmedRidersCount} confirmed rider{data.confirmedRidersCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                {/* Savings Pill */}
                {data.splitMode === "EQUAL" && data.confirmedRidersCount > 1 && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/80 backdrop-blur-xs px-3.5 py-2 border border-blue-100/80 text-xs text-blue-800 font-semibold shadow-2xs">
                    <TrendingDown size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      Each rider saves <strong>{formatTaka(data.savingsPerRider)}</strong> ({data.savingsPercent}% savings) with equal cost division!
                    </span>
                  </div>
                )}
              </div>

              {/* Confirmed Riders Section */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Users size={14} className="text-blue-600" /> Confirmed Riders ({data.confirmedRidersCount})
                  </h4>

                  {/* Driver Adjustable Split Control Button */}
                  {data.isDriver && data.confirmedRiders?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {data.splitMode === "CUSTOM" && (
                        <button
                          type="button"
                          onClick={handleResetToEqual}
                          disabled={savingCustom}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-600 transition"
                          title="Reset to default equal split"
                        >
                          <RotateCcw size={11} /> Reset Equal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsAdjusting((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                      >
                        <Sliders size={12} className="text-blue-600" />
                        {isAdjusting ? "Close Adjuster" : "Override Shares"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Driver Manual Override Form */}
                {isAdjusting && data.isDriver && (
                  <form onSubmit={handleSaveCustomShares} className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Pencil size={13} /> Custom Share Override
                      </p>
                      <span className="text-[10px] text-amber-700">Set individual amounts</span>
                    </div>

                    <div className="space-y-2">
                      {data.confirmedRiders.map((item) => {
                        const rId = String(item.rider?._id || item.rider);
                        return (
                          <div key={rId} className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-amber-100">
                            <span className="text-xs font-bold text-slate-800 truncate max-w-[180px]">
                              {item.rider?.name || "Rider"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-400">৳</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={customInputs[rId] ?? item.splitShare}
                                onChange={(e) =>
                                  setCustomInputs({ ...customInputs, [rId]: e.target.value })
                                }
                                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs font-bold text-slate-800 text-right focus:border-blue-500 focus:outline-hidden"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200/50">
                      <button
                        type="button"
                        onClick={() => setIsAdjusting(false)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingCustom}
                        className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {savingCustom ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Save Custom Shares
                      </button>
                    </div>
                  </form>
                )}

                {/* Confirmed Riders List Cards */}
                {data.confirmedRiders?.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                    <p className="font-semibold text-slate-600">No confirmed riders yet</p>
                    <p className="mt-1">
                      When passenger requests are accepted, trip cost is automatically divided equally by default.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 overflow-hidden bg-white shadow-2xs">
                    {data.confirmedRiders.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 transition hover:bg-slate-50/60">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs uppercase overflow-hidden">
                            {item.rider?.profilePhoto ? (
                              <img
                                src={item.rider.profilePhoto}
                                alt={item.rider.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              item.rider?.name?.[0] || "R"
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-800">
                                {item.rider?.name || "Confirmed Student"}
                              </span>
                              {item.rider?.idVerified && (
                                <BadgeCheck
                                  size={14}
                                  className="text-blue-600 shrink-0"
                                  title="Verified University ID"
                                />
                              )}
                              {item.isCustom && (
                                <span className="rounded-sm bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                                  Custom
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {item.rider?.department || "Student"} {item.rider?.year ? `• ${item.rider.year}` : ""}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900 block">
                            {formatTaka(item.splitShare)}
                          </span>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            item.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                              : "bg-amber-50 text-amber-700 border border-amber-200/50"
                          }`}>
                            {item.status || "PENDING"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dynamic Split Progression Tiers */}
              {data.splitMode === "EQUAL" && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <TrendingDown size={14} className="text-emerald-600" /> Default Equal Division Tiers
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {data.tiers?.map((tier) => (
                      <div
                        key={tier.riderCount}
                        className={`rounded-xl p-2.5 text-center border transition ${
                          tier.isCurrentTier
                            ? "border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-500"
                            : "border-slate-100 bg-slate-50/50 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase text-slate-400">
                          {tier.riderCount} Rider{tier.riderCount > 1 ? "s" : ""}
                        </div>
                        <div className={`text-xs font-black mt-0.5 ${
                          tier.isCurrentTier ? "text-blue-700" : "text-slate-800"
                        }`}>
                          {formatTaka(tier.costPerRider)}
                        </div>
                        <div className="text-[9px] font-semibold text-emerald-600 mt-0.5">
                          {tier.savingsPercent > 0 ? `-${tier.savingsPercent}%` : "100%"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Passenger Confirmation Card */}
              {data.isConfirmedRider && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Your Share: {formatTaka(data.myShare)}
                      {data.myShareIsCustom && (
                        <span className="ml-2 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          Customized by Driver
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {data.myShareIsCustom
                        ? "The driver customized your share for this ride."
                        : "Divided equally among confirmed riders."}
                    </p>
                  </div>
                  <button
                    onClick={handleConfirmShare}
                    disabled={confirming}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {confirming ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <>
                        <Check size={13} /> Confirm Share
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Small badge button to place on any Ride card to view / manage Auto Cost Split
 */
export function AutoCostSplitBadge({ ride, onOpen }) {
  if (!ride || !ride._id) return null;
  const charge = Number(ride.charge || 0);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(ride._id);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100/80 hover:border-blue-300"
      title="View Cost Split & Custom Shares"
    >
      <Coins size={13} className="text-blue-600" />
      <span>Cost Split</span>
      {charge > 0 && <span className="text-[10px] text-blue-600 font-bold">({formatTaka(charge)})</span>}
    </button>
  );
}

export const AdjustableCostSplitModal = AutoCostSplitModal;
export const AdjustableCostSplitBadge = AutoCostSplitBadge;
