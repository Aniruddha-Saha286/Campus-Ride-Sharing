import React, { useState, useEffect, useId } from "react";
import {
  PRIMARY_REGISTRATION_AREAS,
  REGISTRATION_CATEGORIES,
  parseRegistrationPlate,
  formatRegistrationPlate,
} from "../utils/vehicleRegistration";

export default function VehicleRegistrationInput({
  value,
  onChange,
  error,
  disabled = false,
  label = "Vehicle Registration Number",
  required = true,
}) {
  const idPrefix = useId();

  const getInitialState = (initialVal) => {
    if (initialVal) {
      const parsed = parseRegistrationPlate(initialVal);
      if (parsed) {
        return {
          area: parsed.area,
          type: parsed.isMetro ? "Metro" : "Non-Metro",
          category: parsed.category,
          digits: parsed.digits,
        };
      }
      const rawDigits = String(initialVal).replace(/\D/g, "").slice(0, 6);
      if (rawDigits) {
        return {
          area: "Dhaka",
          type: "Metro",
          category: "Ga",
          digits: rawDigits,
        };
      }
    }
    return {
      area: "Dhaka",
      type: "Metro",
      category: "Ga",
      digits: "",
    };
  };

  const [area, setArea] = useState(() => getInitialState(value).area);
  const [type, setType] = useState(() => getInitialState(value).type);
  const [category, setCategory] = useState(() => getInitialState(value).category);
  const [digits, setDigits] = useState(() => getInitialState(value).digits);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!value) return;
    const parsed = parseRegistrationPlate(value);
    if (parsed) {
      setArea(parsed.area);
      setType(parsed.isMetro ? "Metro" : "Non-Metro");
      setCategory(parsed.category);
      setDigits(parsed.digits);
    }
  }, [value]);

  const updateState = (newArea, newType, newCat, newDigits) => {
    const cleanDigits = String(newDigits || "").replace(/\D/g, "").slice(0, 6);
    const isMetro = newType === "Metro";
    let validationErr = "";
    let isValid = false;

    if (!newArea) {
      validationErr = "Select a registration area.";
    } else if (!newCat) {
      validationErr = "Select a registration category.";
    } else if (cleanDigits.length < 6) {
      validationErr = "Vehicle registration number must contain exactly 6 digits.";
    } else {
      isValid = true;
    }

    setLocalError(validationErr);

    const canonical = isValid
      ? formatRegistrationPlate({
          area: newArea,
          isMetro,
          category: newCat,
          digits: cleanDigits,
        })
      : "";

    if (onChange) {
      onChange(canonical, isValid, {
        area: newArea,
        isMetro,
        category: newCat,
        digits: cleanDigits,
      });
    }
  };

  const handleAreaChange = (e) => {
    const nextArea = e.target.value;
    setArea(nextArea);
    updateState(nextArea, type, category, digits);
  };

  const handleTypeChange = (e) => {
    const nextType = e.target.value;
    setType(nextType);
    updateState(area, nextType, category, digits);
  };

  const handleCategoryChange = (e) => {
    const nextCat = e.target.value;
    setCategory(nextCat);
    updateState(area, type, nextCat, digits);
  };

  const handleDigitsChange = (e) => {
    const raw = e.target.value;
    const cleanDigits = raw.replace(/\D/g, "").slice(0, 6);
    setDigits(cleanDigits);
    updateState(area, type, category, cleanDigits);
  };

  const cleanDigits = digits.replace(/\D/g, "").slice(0, 6);
  const prefix = cleanDigits.slice(0, 2);
  const suffix = cleanDigits.slice(2, 6);
  const formattedDigitsPreview = prefix && suffix ? `${prefix}-${suffix}` : cleanDigits;
  const metroStr = type === "Metro" ? " Metro" : "";
  const previewStr =
    cleanDigits.length === 6
      ? `${area}${metroStr}-${category} ${formattedDigitsPreview}`
      : `${area}${metroStr}-${category} ${cleanDigits ? `${cleanDigits}...` : "______"}`;

  const displayedError = error || localError;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={`${idPrefix}-number`}
          className="text-xs font-bold uppercase tracking-wider text-slate-600"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <span className="text-[11px] font-medium text-slate-400">
          6 numeric digits (XX-XXXX)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label
            htmlFor={`${idPrefix}-area`}
            className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Registration Area
          </label>
          <select
            id={`${idPrefix}-area`}
            value={area}
            disabled={disabled}
            onChange={handleAreaChange}
            className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {PRIMARY_REGISTRATION_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-type`}
            className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Type
          </label>
          <select
            id={`${idPrefix}-type`}
            value={type}
            disabled={disabled}
            onChange={handleTypeChange}
            className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="Metro">Metro</option>
            <option value="Non-Metro">Non-Metro</option>
          </select>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-category`}
            className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Category
          </label>
          <select
            id={`${idPrefix}-category`}
            value={category}
            disabled={disabled}
            onChange={handleCategoryChange}
            className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {REGISTRATION_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-number`}
            className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Number
          </label>
          <input
            id={`${idPrefix}-number`}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={digits}
            disabled={disabled}
            onChange={handleDigitsChange}
            placeholder="123456"
            className={`w-full rounded-xl border px-3 py-2 text-xs font-mono font-bold tracking-widest text-slate-800 placeholder:text-slate-300 outline-none transition disabled:bg-slate-100 ${
              displayedError
                ? "border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-2 focus:ring-rose-200"
                : "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            }`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs">
        <span className="text-[11px] font-medium text-slate-500">
          Registration preview
        </span>
        <span
          className={`font-mono font-bold tracking-wider ${
            cleanDigits.length === 6 ? "text-slate-800" : "text-slate-400"
          }`}
        >
          {previewStr}
        </span>
      </div>

      {displayedError && (
        <p className="text-[11px] font-medium text-rose-600">
          {displayedError}
        </p>
      )}
    </div>
  );
}
