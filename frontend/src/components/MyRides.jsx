import React, { useState } from "react";
import {
  CarFront,
  MapPin,
  Navigation,
  Clock3,
  Users,
  Loader2,
  Check,
  X,
  Eye,
  BadgeCheck,
  Inbox,
  Search,
  Info,
} from "lucide-react";
import {
  getMyRides,
  listRides,
  requestSeat,
  respondToRequest,
  getRequestContact,
  cancelRequest,
  cancelRide,
} from "../api/rideApi";
import AcceptedContactModal from "./AcceptedContactModal.jsx";
import usePolling from "../hooks/usePolling";


const STATUS_META = {
  pending: { label: "Pending", classes: "bg-amber-50 text-amber-700" },
  accepted: { label: "Accepted", classes: "bg-emerald-50 text-emerald-700" },
  declined: { label: "Declined", classes: "bg-rose-50 text-rose-700" },
  cancelled: { label: "Cancelled", classes: "bg-slate-100 text-slate-500" },
};

export default function MyRides() {
  const [my, setMy] = useState(null);
  const [browse, setBrowse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = async () => {
    setError("");
    try {
      const [myResult, browseResult] = await Promise.allSettled([getMyRides(), listRides()]);
      if (myResult.status === "fulfilled") setMy(myResult.value.data.data);
      if (browseResult.status === "fulfilled") setBrowse(browseResult.value.data.data || []);
      if (myResult.status === "rejected" && browseResult.status === "rejected") {
        setError(myResult.reason?.response?.data?.message || "Could not load rides.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not load rides.");
    } finally {
      setLoading(false);
    }
  };

  usePolling(load);

  const respond = async (rideId, requestId, decision) => {
    setBusy(requestId);
    setError("");
    try {
      await respondToRequest(rideId, requestId, decision);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the request.");
    } finally {
      setBusy("");
    }
  };

  const requestSeatOn = async (rideId) => {
    setBusy(rideId);
    setError("");
    try {
      await requestSeat(rideId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not request a seat.");
    } finally {
      setBusy("");
    }
  };

  const reveal = async (requestId) => {
    setBusy(requestId);
    setError("");
    try {
      const res = await getRequestContact(requestId);
      setContact(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Contact details are hidden.");
    } finally {
      setBusy("");
    }
  };

  const openCancelModal = (rideId, requestId, status) => {
    setError("");
    setCancelTarget({ rideId, requestId, status });
    setCancelReason("");
  };

  const cancelRequestOn = async () => {
    if (!cancelTarget) return;
    setBusy(cancelTarget.requestId);
    setError("");
    try {
      await cancelRequest(cancelTarget.rideId, cancelTarget.requestId, cancelReason);
      setCancelTarget(null);
      setCancelReason("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel the request.");
    } finally {
      setBusy("");
    }
  };

  const cancelRideOn = async (rideId) => {
    setBusy(rideId);
    setError("");
    try {
      await cancelRide(rideId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not cancel the ride.");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={24} />
      </div>
    );
  }

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

  const nameLine = (student) => (
    <p className="flex items-center gap-1 text-sm font-bold text-slate-800">
      <span className="truncate">{student?.name || "Student"}</span>
      {student?.idVerified && (
        <BadgeCheck size={14} className="shrink-0 fill-brand-600 text-white" />
      )}
    </p>
  );

  const rideLine = (ride) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
      <span className="flex items-center gap-1 font-medium text-slate-800">
        <MapPin size={13} className="text-brand-500" /> {ride.pickup}
      </span>
      <Navigation size={13} className="text-slate-300" />
      <span className="flex items-center gap-1 font-medium text-slate-800">{ride.dropoff}</span>
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Clock3 size={12} /> {ride.departureTime}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">
          {error}
        </div>
      )}

      {my && (my.posted.length > 0 || my.requested.length > 0) && (
        <>
          {my.posted.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                <CarFront size={15} /> Rides I posted
              </h2>
              <div className="space-y-4">
                {my.posted.map((ride) => (
                  <div key={ride._id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        {rideLine(ride)}
                        <p className="mt-1 text-xs text-slate-400">
                          {ride.seatsLeft} of {ride.seats} seats left
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {ride.requests.length} request{ride.requests.length === 1 ? "" : "s"}
                        </span>
                        {ride.status === "open" && (
                          <button
                            onClick={() => cancelRideOn(ride._id)}
                            disabled={busy === ride._id}
                            className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy === ride._id ? <Loader2 className="animate-spin" size={13} /> : <X size={13} />}
                            Cancel ride
                          </button>
                        )}
                      </div>
                    </div>

                    {ride.requests.length === 0 ? (
                      <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-400">
                        No one has requested a seat yet.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {ride.requests.map((req) => {
                          const meta = STATUS_META[req.status] || STATUS_META.pending;
                          return (
                            <div
                              key={req._id}
                              className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-y-3">
                                <div className="flex items-center gap-3">
                                  {avatar(req.rider)}
                                  <div>
                                    {nameLine(req.rider)}
                                    <p className="text-xs text-slate-500">
                                      {req.rider?.department}, {req.rider?.year}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.classes}`}>
                                    {meta.label}
                                  </span>
                                  {req.status === "pending" && (
                                    <>
                                      <button
                                        onClick={() => respond(ride._id, req._id, "accepted")}
                                        disabled={busy === req._id}
                                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                                      >
                                        {busy === req._id ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
                                        Accept
                                      </button>
                                      <button
                                        onClick={() => respond(ride._id, req._id, "declined")}
                                        disabled={busy === req._id}
                                        className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                                      >
                                        <X size={13} />
                                        Decline
                                      </button>
                                    </>
                                  )}
                                  {req.status === "accepted" && (
                                    <button
                                      onClick={() => reveal(req._id)}
                                      disabled={busy === req._id}
                                      className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
                                    >
                                      {busy === req._id ? <Loader2 className="animate-spin" size={13} /> : <Eye size={13} />}
                                      Reveal contact
                                    </button>
                                  )}
                                </div>
                              </div>
                              {req.status === "cancelled" && req.cancelReason && (
                                <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                                  <Info size={13} className="mt-0.5 shrink-0" />
                                  <span>Request cancelled — {req.cancelReason}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {my.requested.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                <Users size={15} /> Rides I requested
              </h2>
              <div className="space-y-3">
                {my.requested.map((req) => {
                  const meta = STATUS_META[req.status] || STATUS_META.pending;
                  const ride = req.ride;
                  if (!ride) return null;
                  return (
                    <div key={req._id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
                      <div className="flex flex-wrap items-center justify-between gap-y-3">
                        <div className="flex items-center gap-3">
                          {avatar(ride?.poster)}
                          <div>
                            {rideLine(ride)}
                            <p className="mt-1 text-xs text-slate-400">
                              Posted by {ride?.poster?.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.classes}`}>
                            {meta.label}
                          </span>
                          {(req.status === "pending" || req.status === "accepted") && (
                            <button
                              onClick={() => openCancelModal(ride._id, req._id, req.status)}
                              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
                            >
                              <X size={13} />
                              Cancel request
                            </button>
                          )}
                          {req.status === "accepted" && (
                            <button
                              onClick={() => reveal(req._id)}
                              disabled={busy === req._id}
                              className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60"
                            >
                              {busy === req._id ? <Loader2 className="animate-spin" size={13} /> : <Eye size={13} />}
                              Reveal driver contact
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {my && my.posted.length === 0 && my.requested.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-card">
          <Inbox size={26} className="text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">No rides yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Post a ride to share your commute, or request a seat below.
          </p>
        </div>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <Search size={15} /> Open rides near campus
        </h2>
        {browse.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center shadow-card">
            <p className="text-xs text-slate-400">No open rides to join right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {browse.map((ride) => (
              <div key={ride._id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-y-3">
                  <div className="min-w-0">
                    {rideLine(ride)}
                    <div className="mt-2 flex items-center gap-2">
                      {avatar(ride.poster)}
                      <p className="text-xs text-slate-500">
                        {ride.poster?.name} · {ride.poster?.department}, {ride.poster?.year} ·{" "}
                        {ride.seatsLeft} seat{ride.seatsLeft === 1 ? "" : "s"} left
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => requestSeatOn(ride._id)}
                    disabled={busy === ride._id}
                    className="flex items-center gap-1 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                  >
                    {busy === ride._id ? <Loader2 className="animate-spin" size={13} /> : <Users size={13} />}
                    Request seat
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {contact && <AcceptedContactModal contact={contact} onClose={() => setContact(null)} />}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">Cancel request</h3>
              <button
                onClick={() => setCancelTarget(null)}
                className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5">
              {cancelTarget.status === "accepted" ? (
                <>
                  <p className="text-sm text-slate-500">
                    Let the driver know why you are cancelling. This reason will be shown to them.
                  </p>
                  <label className="mb-1 mt-4 block text-xs font-semibold text-slate-600">
                    Reason
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Plans changed, found another ride"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Cancel your request for this ride?
                </p>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={busy === cancelTarget.requestId}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Keep request
              </button>
              <button
                onClick={cancelRequestOn}
                disabled={
                  busy === cancelTarget.requestId ||
                  (cancelTarget.status === "accepted" && !cancelReason.trim())
                }
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === cancelTarget.requestId ? <Loader2 className="animate-spin" size={15} /> : <X size={15} />}
                Cancel request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
