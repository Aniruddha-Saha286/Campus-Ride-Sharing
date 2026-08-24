import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getMyProfile } from "../api/api";
import { useAuth } from "../auth";
import MyRides from "./MyRides.jsx";
import CommuterMatches from "./CommuterMatches.jsx";
import CurrentRideWidget from "./CurrentRideWidget.jsx";
import DashboardPayments from "./DashboardPayments.jsx";

export default function Dashboard() {
  const { handleLogout } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [verificationNote, setVerificationNote] = useState(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getMyProfile();
        const data = res.data.data;
        setVerificationStatus(data.idVerificationStatus || null);
        setVerificationNote(data.idVerificationNote || null);
      } catch (err) {
        if (err.response?.status === 404) setMissing(true);
        else if (err.response?.status === 401) handleLogout();
      } finally {
        setLoading(false);
      }
    })();
  }, [handleLogout]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  if (missing) return <Navigate to="/profile" replace />;

  return (
    <div className="w-full max-w-none px-6 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your ride-sharing activity will appear here.
          </p>
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

        <CurrentRideWidget />
        <DashboardPayments />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <MyRides />
          </div>
          <div className="min-w-0">
            <CommuterMatches />
          </div>
        </div>
      </div>
    </div>
  );
}
