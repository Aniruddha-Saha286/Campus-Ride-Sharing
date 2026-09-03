import React from "react";
import {
  LayoutDashboard,
  CarFront,
  Search,
  ListOrdered,
  Wallet,
  History,
  Repeat2,
  Bell,
  User,
  Settings,
  Satellite,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Users,
  ShieldAlert,
} from "lucide-react";
import SidebarItem from "./SidebarItem.jsx";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/rides/new", icon: CarFront, label: "Request Ride" },
  { to: "/find-ride", icon: Search, label: "Find Ride" },
  { to: "/my-rides", icon: ListOrdered, label: "My Rides" },
  { to: "/transactions", icon: Wallet, label: "Payments" },
  {
    icon: History,
    label: "Ride History",
    children: [
      { to: "/ride-history/driver", icon: CarFront, label: "Driver History" },
      { to: "/ride-history/passenger", icon: Users, label: "Passenger History" },
    ],
  },
  { to: "/recurring", icon: Repeat2, label: "Recurring Commute" },
  { to: "/ride-tracker", icon: Satellite, label: "Ride Tracker" },
  { to: "/my-safety-reports", icon: ShieldAlert, label: "Safety Reports" },
  { divider: true },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 transition-opacity lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:z-30
          ${collapsed ? "w-[72px]" : "w-64"}`}
      >
        <button
          type="button"
          onClick={() => {
            window.location.href = "/dashboard";
          }}
          className={`flex h-16 w-full items-center border-b border-slate-100 px-4 text-left transition hover:bg-slate-50 cursor-pointer ${collapsed ? "justify-center" : "gap-2.5"}`}
          title="Refresh Dashboard"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-xs">
            CR
          </div>
          {!collapsed && (
            <span className="text-sm font-bold text-slate-800 whitespace-nowrap">Campus Ride</span>
          )}
        </button>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item, i) =>
            item.divider ? (
              <div key={`div-${i}`} className="my-3 border-t border-slate-100" />
            ) : item.children ? (
              <SidebarItem
                key={`parent-${item.label}`}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                children={item.children}
              />
            ) : (
              <SidebarItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
                onClick={item.onClick}
              />
            )
          )}
        </nav>

        <div className="hidden border-t border-slate-100 px-3 py-3 lg:block">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
