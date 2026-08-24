import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

function CollapsibleItem({ icon: Icon, label, children, collapsed }) {
  const location = useLocation();
  const isActive = children.some(
    (child) =>
      location.pathname === child.to ||
      location.pathname + location.search === child.to
  );
  const [open, setOpen] = React.useState(isActive);

  React.useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {children.map((child) => (
          <NavLink
            key={child.to}
            to={child.to}
            className={({ isActive }) =>
              `group flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200
              ${
                isActive
                  ? "bg-brand-50 text-brand-700 shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`
            }
            title={child.label}
          >
            <child.icon size={20} className="shrink-0" />
          </NavLink>
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200
          ${
            isActive
              ? "bg-brand-50 text-brand-700 shadow-sm"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          }`}
      >
        <Icon size={20} className="shrink-0 transition-colors duration-200" />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? `${children.length * 42 + 8}px` : "0px" }}
      >
        <div className="ml-3 border-l border-slate-100 pl-3 pt-1 pb-1 space-y-0.5">
          {children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200
                ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`
              }
            >
              <child.icon size={15} className="shrink-0" />
              <span className="truncate">{child.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SidebarItem({ to, icon: Icon, label, collapsed, onClick, children }) {
  if (children) {
    return (
      <CollapsibleItem
        icon={Icon}
        label={label}
        children={children}
        collapsed={collapsed}
      />
    );
  }

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200
          text-slate-500 hover:bg-slate-100 hover:text-slate-800
          ${collapsed ? "justify-center" : ""}`}
        title={collapsed ? label : undefined}
      >
        <Icon size={20} className="shrink-0 transition-colors duration-200" />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200
        ${
          isActive
            ? "bg-brand-50 text-brand-700 shadow-sm"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        }
        ${collapsed ? "justify-center" : ""}`
      }
      title={collapsed ? label : undefined}
      end={to === "/dashboard"}
    >
      <Icon size={20} className="shrink-0 transition-colors duration-200" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}
