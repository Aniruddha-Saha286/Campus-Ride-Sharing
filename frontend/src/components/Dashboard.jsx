import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  User,
  LogOut,
  Loader2,
  BadgeCheck,
  CarFront,
} from "lucide-react";
import { getMyProfile } from "../api/api";
import { useAuth } from "../auth";
import MyRides from "./MyRides.jsx";
import CommuterMatches from "./CommuterMatches.jsx";
import RecurringRides from "./RecurringRides.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const { handleLogout } = useAuth();
  const menuRef = useRef(null);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [idVerified, setIdVerified] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [verificationNote, setVerificationNote] = useState(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getMyProfile();
        const data = res.data.data;
        setName(data.name || "");
        setIdVerified(data.idVerified === true);
        setVerificationStatus(data.idVerificationStatus || null);
        setVerificationNote(data.idVerificationNote || null);
        if (data.profilePhoto) {
          setPhotoUrl(data.profilePhoto);
        }
      } catch (err) {
        if (err.response?.status === 404) setMissing(true);
        else if (err.response?.status === 401) handleLogout();
      } finally {
        setLoading(false);
      }
    })();
  }, [handleLogout]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  if (missing) return <Navigate to="/profile" replace />;

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="w-full max-w-none px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-y-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Your ride-sharing activity will appear here.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/rides/new")}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
            >
              <CarFront size={15} />
              Plan a ride
            </button>

            <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((value) => !value)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm transition hover:border-brand-300 hover:bg-slate-50"
            >
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-base font-bold text-white">
                    {initial}
                  </div>
                )}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="flex max-w-[12rem] items-center gap-1 truncate text-sm font-bold text-slate-800">
                  <span className="truncate">{name}</span>
                  {idVerified && (
                    <BadgeCheck
                      size={15}
                      className="shrink-0 fill-brand-600 text-white"
                      aria-label="Verified student"
                    />
                  )}
                </p>
                <p className="text-xs text-slate-400">Student</p>
              </div>
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>

            {open && (
              <div className="absolute right-0 top-full z-10 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-card">
                <button
                  onClick={() => {
                    setOpen(false);
                    navigate("/profile");
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <User size={16} className="text-slate-400" />
                  Edit profile
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    handleLogout();
                    navigate("/login");
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            )}
          </div>
          </div>
        </div>

        {verificationStatus && verificationStatus !== "approved" && (
          <div className={`mb-6 rounded-xl border px-5 py-4 ${
            verificationStatus === "rejected"
              ? "border-rose-200 bg-rose-50"
              : "border-amber-200 bg-amber-50"
          }`}>
            <p className={`text-sm font-semibold ${
              verificationStatus === "rejected" ? "text-rose-700" : "text-amber-700"
            }`}>
              {verificationStatus === "rejected"
                ? "\u274C ID verification rejected"
                : "\u23F3 ID card pending verification"}
            </p>
            <p className={`mt-1 text-sm ${
              verificationStatus === "rejected" ? "text-rose-600" : "text-amber-600"
            }`}>
              {verificationStatus === "rejected"
                ? verificationNote
                  ? `Reason: ${verificationNote}. Please re-upload your ID card from the profile page.`
                  : "Please re-upload your ID card from the profile page."
                : "An admin will review your ID card soon. Rides, matches, and contacts are locked until then."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <MyRides />
            <RecurringRides />
          </div>
          <div className="min-w-0">
            <CommuterMatches />
          </div>
        </div>
      </div>
    </div>
  );
}
