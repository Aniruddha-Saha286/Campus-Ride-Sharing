import React from "react";
import { useNavigate } from "react-router-dom";
import { Ban, ShieldCheck } from "lucide-react";

export default function Banned() {
  const navigate = useNavigate();
  const reason =
    localStorage.getItem("bannedReason") || "Your account has been banned";

  const handleContinue = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("bannedReason");
    navigate("/login");
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 shadow-card">
        <Ban className="text-white" size={28} />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
        Account banned
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">{reason}</p>
      <div className="mt-5 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-left text-xs text-rose-600">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <span>
          You can no longer sign in or use Campus Ride Sharing. If you believe
          this is a mistake, contact the campus administrator.
        </span>
      </div>
      <button
        onClick={handleContinue}
        className="mt-6 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
      >
        Sign in with another account
      </button>
    </div>
  );
}
