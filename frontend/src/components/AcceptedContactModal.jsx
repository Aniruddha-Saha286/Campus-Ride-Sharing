import React from "react";
import { X, Phone, MapPin, ShieldAlert, BadgeCheck } from "lucide-react";

const Row = ({ label, value, Icon }) => (
  <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">
      <Icon size={15} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value || "—"}</p>
    </div>
  </div>
);

export default function AcceptedContactModal({ contact, onClose }) {
  if (!contact) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">Contact details</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 px-5 py-5">
          <div className="flex items-center gap-2">
            <p className="text-lg font-extrabold text-slate-900">{contact.name}</p>
            <BadgeCheck size={16} className="fill-brand-600 text-white" />
          </div>
          <Row label="Phone" value={contact.phone} Icon={Phone} />
          <Row label="Home area" value={contact.homeArea} Icon={MapPin} />
          {contact.emergencyContact &&
            (contact.emergencyContact.name || contact.emergencyContact.phone) && (
              <Row
                label="Emergency contact"
                value={`${contact.emergencyContact.name || ""}${
                  contact.emergencyContact.relation ? ` (${contact.emergencyContact.relation})` : ""
                }${contact.emergencyContact.phone ? ` — ${contact.emergencyContact.phone}` : ""}`}
                Icon={ShieldAlert}
              />
            )}
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
            Shared because your seat request was accepted. Please use it only for coordinating rides.
          </p>
        </div>
      </div>
    </div>
  );
}
