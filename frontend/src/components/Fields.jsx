import React from "react";

export function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-rose-500">{message}</p>;
}

const inputClass = (hasError) =>
  `w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
    hasError ? "border-rose-300" : "border-slate-200"
  }`;

function Field({ label, error, className, children }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          {label}
        </label>
      )}
      {children}
      <FieldError message={error} />
    </div>
  );
}

export function TextInput({ label, error, className, ...props }) {
  return (
    <Field label={label} error={error} className={className}>
      <input {...props} className={inputClass(Boolean(error))} />
    </Field>
  );
}

export function DateInput({ label, error, className, ...props }) {
  return (
    <Field label={label} error={error} className={className}>
      <input type="date" {...props} className={inputClass(Boolean(error))} />
    </Field>
  );
}

export function SelectInput({ label, error, className, children, ...props }) {
  return (
    <Field label={label} error={error} className={className}>
      <select {...props} className={`${inputClass(Boolean(error))} bg-white`}>
        {children}
      </select>
    </Field>
  );
}

export function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Icon size={18} strokeWidth={2.25} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-4 pl-12">{children}</div>
    </div>
  );
}
