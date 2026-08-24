import React from "react";
import { Bell } from "lucide-react";

export default function NotificationMenu() {
  return (
    <button className="relative rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition hover:border-brand-300 hover:bg-slate-50">
      <Bell size={18} className="text-slate-500" />
    </button>
  );
}
