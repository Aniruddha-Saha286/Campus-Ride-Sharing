import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Car, Loader2, ShieldCheck } from "lucide-react";
import { loginWithGoogle } from "../api/api";
import { useAuth } from "../auth";

export default function Login() {
  const navigate = useNavigate();
  const { handleLogin } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSuccess = async ({ credential }) => {
    setError("");
    setBusy(true);
    try {
      const { data } = await loginWithGoogle(credential);
      handleLogin(data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message || "Sign-in failed. Please try again.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-card">
        <Car className="text-white" size={28} />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
        Campus Ride Sharing
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        Share rides safely with verified students from your campus.
      </p>

      <div className="mt-8 w-full rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
        {busy ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-slate-500">
            <Loader2 className="animate-spin text-brand-500" size={18} />
            Verifying your account...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-full flex justify-center">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => setError("Google sign-in failed. Please try again.")}
                shape="pill"
                text="signin_with"
                theme="outline"
                size="large"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-center text-sm font-medium text-rose-500">
            {error}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-start gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-400" />
        <span>
          Only students with a university GSuite email (@g.bracu.ac.bd /
          @bracu.ac.bd) can sign in.
        </span>
      </div>

      <Link
        to="/admin/login"
        className="mt-6 text-xs font-semibold text-slate-400 transition hover:text-slate-600"
      >
        If you are admin .. Please sign in here..
      </Link>
    </div>
  );
}
