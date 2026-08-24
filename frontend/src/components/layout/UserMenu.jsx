import React, { useRef, useEffect, useState } from "react";
import { LogOut, User, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "../../auth.js";
import { useNavigate } from "react-router-dom";
import { getMyProfile } from "../../api/api";

export default function UserMenu() {
  const { handleLogout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    getMyProfile()
      .then((res) => {
        const d = res.data.data;
        setName(d.name || "");
        if (d.profilePhoto) setPhotoUrl(d.profilePhoto);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2 shadow-sm transition hover:border-brand-300 hover:bg-slate-50"
      >
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
              {initial}
            </div>
          )}
        </div>
        <div className="hidden text-left leading-tight sm:block">
          <p className="max-w-[8rem] truncate text-sm font-bold text-slate-800">{name || "Student"}</p>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-card">
          <button
            onClick={() => { setOpen(false); navigate("/profile"); }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <User size={16} className="text-slate-400" />
            Edit profile
          </button>
          <button
            onClick={() => { setOpen(false); handleLogout(); navigate("/login"); }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
