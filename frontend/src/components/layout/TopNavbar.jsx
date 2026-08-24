import React, { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import UserMenu from "./UserMenu.jsx";
import NotificationMenu from "./NotificationMenu.jsx";

export default function TopNavbar({ onMenuClick, collapsed }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const leftPx = isDesktop ? (collapsed ? 72 : 256) : 0;

  return (
    <header
      className="fixed top-0 right-0 z-40 flex h-16 items-center justify-between border-b border-slate-100 bg-white px-4 transition-[left] duration-300 lg:px-6"
      style={{ left: leftPx }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            CR
          </div>
          <span className="text-sm font-bold text-slate-800">Campus Ride</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationMenu />
        <UserMenu />
      </div>
    </header>
  );
}
