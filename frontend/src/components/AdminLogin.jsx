import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { adminLogin } from "../api/api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await adminLogin(email, password);
      localStorage.setItem("adminToken", data.token);
      navigate("/admin");
    } catch (err) {
      setError(
        err.response?.data?.message || "Admin sign-in failed. Please try again.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 shadow-card">
        <ShieldCheck className="text-white" size={28} />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
        Admin Verification Panel
      </h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        Review uploaded university ID cards and approve verified students.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 w-full rounded-2xl border border-slate-100 bg-white p-6 shadow-card"
      >
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Admin email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          autoComplete="username"
          required
          className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
        <label className="mb-1 mt-4 block text-xs font-semibold text-slate-600">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />

        {error && (
          <p className="mt-3 text-sm font-medium text-rose-500">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && <Loader2 className="animate-spin" size={16} />}
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <Link
        to="/login"
        className="mt-5 text-sm font-semibold text-slate-500 transition hover:text-brand-700"
      >
        ← Back to student sign in
      </Link>
    </div>
  );
}
