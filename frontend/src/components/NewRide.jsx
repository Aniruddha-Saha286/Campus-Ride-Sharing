import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  Navigation,
  Loader2,
  ArrowLeft,
  Clock3,
  Users,
  Wallet,
  FileText,
  CheckCircle2,
  Info,
  Car,
  Bike,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Ban,
} from "lucide-react";
import MapPicker from "./MapPicker.jsx";
import { getMyRides } from "../api/rideApi";
import { createVehicleRide } from "../api/vehicleRideApi";
import { parse12HourTo24 } from "../utils/rideStatusConstants";
import { isInsideServiceArea } from "../utils/dhakaCoverage";
import VehicleRegistrationInput from "./VehicleRegistrationInput.jsx";
import {
  generateCanonicalDummyRegistration,
  validateRegistrationPlate,
} from "../utils/vehicleRegistration";

const formatCoords = (pos) => (pos ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : "Not set");

const TIME_12H_PRESETS = [
  { label: "08:00 AM", hour: "08", min: "00", ampm: "AM", time24: "08:00" },
  { label: "09:30 AM", hour: "09", min: "30", ampm: "AM", time24: "09:30" },
  { label: "11:00 AM", hour: "11", min: "00", ampm: "AM", time24: "11:00" },
  { label: "01:30 PM", hour: "01", min: "30", ampm: "PM", time24: "13:30" },
  { label: "03:30 PM", hour: "03", min: "30", ampm: "PM", time24: "15:30" },
  { label: "05:00 PM", hour: "05", min: "00", ampm: "PM", time24: "17:00" },
];

const FARE_PRESETS = [
  { label: "Free", value: 0 },
  { label: "৳40", value: 40 },
  { label: "৳60", value: 60 },
  { label: "৳80", value: 80 },
  { label: "৳100", value: 100 },
];

const VEHICLE_CONFIGS = {
  Motorbike: {
    category: "Two-wheeler",
    minSeats: 1,
    maxSeats: 1,
    label: "Motorbike",
    icon: Bike,
    color: "emerald",
    desc: "Two-wheeler · Strictly 1 passenger seat for university safety.",
  },
  Car: {
    category: "Four-wheeler",
    minSeats: 1,
    maxSeats: 4,
    label: "Car",
    icon: Car,
    color: "blue",
    desc: "Four-wheeler · Sedan / Hatchback (1 to 4 passenger seats).",
  },
  Jeep: {
    category: "Four-wheeler",
    minSeats: 1,
    maxSeats: 6,
    label: "Jeep / SUV",
    icon: Car,
    color: "purple",
    desc: "Four-wheeler · Sport Utility / Jeep (1 to 6 passenger seats).",
  },
  Microbus: {
    category: "Four-wheeler",
    minSeats: 1,
    maxSeats: 8,
    label: "Microbus",
    icon: Car,
    color: "amber",
    desc: "Four-wheeler · Van / Microbus (1 to 8 passenger seats).",
  },
};

export default function NewRide() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  const [hour12, setHour12] = useState("08");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState("AM");

  const [vehicleCategory, setVehicleCategory] = useState("Four-wheeler");
  const [vehicleType, setVehicleType] = useState("Car");
  const [registrationNumber, setRegistrationNumber] = useState(() =>
    generateCanonicalDummyRegistration()
  );
  const [isRegValid, setIsRegValid] = useState(true);
  const [regError, setRegError] = useState("");

  const [seats, setSeats] = useState(3);
  const [charge, setCharge] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeEngagement, setActiveEngagement] = useState(null);
  const [loadingActive, setLoadingActive] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await getMyRides();
        if (!isMounted) return;
        const posted = res.data?.data?.posted || [];
        const requested = res.data?.data?.requested || [];

        const activePosted = posted.find(
          (r) => r.status !== "cancelled" && r.status !== "completed" && r.tripStatus !== "completed"
        );
        if (activePosted) {
          setActiveEngagement({
            type: "POSTED_RIDE",
            ride: activePosted,
            message: `You already have an active posted ride from ${activePosted.pickup} to ${activePosted.dropoff}. You cannot post more than 1 ride at a time until your current ride is cancelled or ended.`,
          });
          return;
        }

        const activeReq = requested.find(
          (b) =>
            b.ride &&
            (b.status === "pending" || b.status === "accepted") &&
            b.ride.status !== "cancelled" &&
            b.ride.status !== "completed" &&
            b.ride.tripStatus !== "completed"
        );
        if (activeReq) {
          setActiveEngagement({
            type: activeReq.status === "pending" ? "PENDING_REQUEST" : "ACCEPTED_BOOKING",
            booking: activeReq,
            ride: activeReq.ride,
            message:
              activeReq.status === "pending"
                ? `You currently have a pending seat request for a ride from ${activeReq.ride.pickup} to ${activeReq.ride.dropoff}. Please cancel that request before posting a new ride.`
                : `You already have an active booked ride from ${activeReq.ride.pickup} to ${activeReq.ride.dropoff}. You cannot post a ride until your current ride is completed.`,
          });
          return;
        }

        setActiveEngagement(null);
      } catch (err) {
        console.warn("Could not check active rides for user:", err.message);
      } finally {
        if (isMounted) setLoadingActive(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const departureTime24 = parse12HourTo24(hour12, minute, ampm);

  const handleRegChange = (canonical, isValid) => {
    setRegistrationNumber(canonical);
    setIsRegValid(isValid);
    if (!isValid) {
      setRegError("Vehicle registration number must contain exactly 6 digits.");
    } else {
      setRegError("");
    }
  };

  const handleCategoryChange = (newCat) => {
    setVehicleCategory(newCat);
    if (newCat === "Two-wheeler") {
      setVehicleType("Motorbike");
      setSeats(1);
    } else {
      if (vehicleType === "Motorbike") {
        setVehicleType("Car");
        setSeats(3);
      }
    }
  };

  const handleTypeChange = (type) => {
    setVehicleType(type);
    const cfg = VEHICLE_CONFIGS[type];
    if (type === "Motorbike") {
      setVehicleCategory("Two-wheeler");
      setSeats(1);
    } else {
      setVehicleCategory("Four-wheeler");
      if (seats > cfg.maxSeats) {
        setSeats(cfg.maxSeats);
      } else if (seats < cfg.minSeats) {
        setSeats(cfg.minSeats);
      }
    }
  };

  const currentConfig = VEHICLE_CONFIGS[vehicleType] || VEHICLE_CONFIGS.Car;
  const maxSeatsAllowed = currentConfig.maxSeats;
  const seatNumbers = Array.from({ length: maxSeatsAllowed }, (_, i) => i + 1);

  const handleSubmit = async () => {
    if (activeEngagement) {
      setError(activeEngagement.message);
      return;
    }
    if (!pickup || !dropoff) return;

    if (
      pickup.lat != null &&
      pickup.lng != null &&
      !isInsideServiceArea(pickup.lat, pickup.lng)
    ) {
      setError("Pickup and destination must be within the Campus Ride service area (Dhaka, Gazipur and Narayanganj).");
      return;
    }

    if (
      dropoff.lat != null &&
      dropoff.lng != null &&
      !isInsideServiceArea(dropoff.lat, dropoff.lng)
    ) {
      setError("Pickup and destination must be within the Campus Ride service area (Dhaka, Gazipur and Narayanganj).");
      return;
    }

    const regTrimmed = (registrationNumber || "").trim();
    const regCheck = validateRegistrationPlate(regTrimmed);
    if (!regCheck.valid) {
      setError(regCheck.message || "Please provide a valid Bangladesh vehicle registration number.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await createVehicleRide({
        pickup: pickup.label || formatCoords(pickup),
        dropoff: dropoff.label || formatCoords(dropoff),
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        departureTime: departureTime24,
        seats: Number(seats),
        charge: charge !== "" && charge !== null ? Number(charge) : 0,
        notes: notes ? notes.trim() : "",
        vehicleCategory,
        vehicleType,
        registrationNumber: regCheck.canonical,
      });
      navigate("/my-rides");
    } catch (err) {
      setError(err.response?.data?.message || "Could not post your ride. Please check all fields.");
    } finally {
      setSaving(false);
    }
  };

  const isFormValid =
    !activeEngagement &&
    pickup &&
    dropoff &&
    (!pickup.lat || !pickup.lng || isInsideServiceArea(pickup.lat, pickup.lng)) &&
    (!dropoff.lat || !dropoff.lng || isInsideServiceArea(dropoff.lat, dropoff.lng)) &&
    departureTime24 &&
    seats >= 1 &&
    seats <= maxSeatsAllowed &&
    isRegValid &&
    Boolean(registrationNumber);

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-50/60 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3">
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition"
              >
                <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
                <span>Back to Dashboard</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Car size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                  Post a Ride
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Select pickup and destination on the map or search bar, set your ride details, and share seats with fellow students.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start rounded-xl border border-success/30 bg-success/10 px-3.5 py-2 text-xs font-semibold text-success">
            <ShieldCheck size={16} className="text-success" />
            <span>Verified Student Rides</span>
          </div>
        </div>

        {activeEngagement && (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/50 to-white p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                      {activeEngagement.type === "POSTED_RIDE"
                        ? "Active Ride Already Posted"
                        : activeEngagement.type === "PENDING_REQUEST"
                        ? "Pending Seat Request"
                        : "Active Ride In Progress"}
                    </span>
                    <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      1 Ride Limit
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {activeEngagement.ride?.pickup} <ArrowRight size={13} className="inline mx-1 text-slate-400" /> {activeEngagement.ride?.dropoff}
                    {activeEngagement.ride?.departureTime ? ` · ${activeEngagement.ride.departureTime}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 max-w-2xl">
                    {activeEngagement.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <Link
                  to="/my-rides"
                  className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-100 transition"
                >
                  Manage in My Rides
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7 xl:col-span-8">
            <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2 text-xs font-semibold text-blue-800">
              <Info size={15} className="shrink-0 text-blue-600" />
              <span>Campus Ride currently supports rides across Dhaka, Gazipur and Narayanganj.</span>
            </div>

            <MapPicker
              pickup={pickup}
              dropoff={dropoff}
              onPickupChange={(pos) => {
                setError("");
                setPickup(pos);
              }}
              onDropoffChange={(pos) => {
                setError("");
                setDropoff(pos);
              }}
              onRouteCalculated={(info) => {
                setRouteInfo(info);
              }}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div
                className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                  pickup
                    ? "border-blue-200 bg-blue-50/40 shadow-xs"
                    : "border-dashed border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs ${
                      pickup
                        ? "bg-blue-600 text-white shadow-blue-600/20"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <MapPin size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      Pickup Location
                    </p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-800">
                      {pickup?.label || "Not selected yet"}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {pickup ? formatCoords(pickup) : "Search above or click on map"}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
                  dropoff
                    ? "border-blue-200 bg-blue-50/40 shadow-xs"
                    : "border-dashed border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs ${
                      dropoff
                        ? "bg-blue-600 text-white shadow-blue-600/20"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <Navigation size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      Drop-off Location
                    </p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-800">
                      {dropoff?.label || "Not selected yet"}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {dropoff ? formatCoords(dropoff) : "Search above or click on map"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5 lg:col-span-5 xl:col-span-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl">
              <h2 className="text-base font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
                <span>Ride Details</span>
                {routeInfo && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={12} />
                    <span>Route Ready</span>
                  </span>
                )}
              </h2>

              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="border-r border-slate-200/80 pr-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Distance</p>
                    <p className="mt-0.5 text-sm font-extrabold text-slate-800">
                      {routeInfo?.distance ? `${routeInfo.distance} km` : "—"}
                    </p>
                  </div>
                  <div className="pl-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Est. Drive Time</p>
                    <p className="mt-0.5 text-sm font-extrabold text-slate-800">
                      {routeInfo?.durationText ? `~${routeInfo.durationText}` : routeInfo?.duration ? `~${routeInfo.duration} mins` : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Clock3 size={14} className="text-emerald-600" />
                      Departure Time (12-Hour)
                    </span>
                    <span className="font-bold text-emerald-600 text-xs">{hour12}:{minute} {ampm}</span>
                  </label>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <select
                        value={hour12}
                        onChange={(e) => setHour12(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-xs outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      >
                        {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="font-bold text-slate-400">:</span>

                    <div className="flex-1">
                      <select
                        value={minute}
                        onChange={(e) => setMinute(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-xs outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      >
                        {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setAmpm("AM")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${
                          ampm === "AM"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmpm("PM")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${
                          ampm === "PM"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        PM
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {TIME_12H_PRESETS.map((preset) => {
                      const isSelected = hour12 === preset.hour && minute === preset.min && ampm === preset.ampm;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setHour12(preset.hour);
                            setMinute(preset.min);
                            setAmpm(preset.ampm);
                          }}
                          className={`rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-700">
                      <Car size={15} className="text-blue-600" />
                      <span>Vehicle Specification</span>
                    </label>
                    <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                      {vehicleCategory}
                    </span>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Category
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCategoryChange("Two-wheeler")}
                        className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                          vehicleCategory === "Two-wheeler"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Bike size={16} />
                        <span>Two-wheeler</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCategoryChange("Four-wheeler")}
                        className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                          vehicleCategory === "Four-wheeler"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Car size={16} />
                        <span>Four-wheeler</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Vehicle Type
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {Object.entries(VEHICLE_CONFIGS)
                        .filter(([_, cfg]) => cfg.category === vehicleCategory)
                        .map(([typeKey, cfg]) => {
                          const isSelected = vehicleType === typeKey;
                          const IconComp = cfg.icon;
                          return (
                            <button
                              key={typeKey}
                              type="button"
                              onClick={() => handleTypeChange(typeKey)}
                              className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <IconComp size={16} className={isSelected ? "text-white" : "text-slate-500"} />
                              <span className={`mt-1 text-xs font-bold ${isSelected ? "text-white" : "text-slate-800"}`}>
                                {cfg.label}
                              </span>
                              <span className={`text-[10px] ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                                {cfg.minSeats === cfg.maxSeats
                                  ? `${cfg.maxSeats} seat`
                                  : `${cfg.minSeats}-${cfg.maxSeats} seats`}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500 italic">
                      {currentConfig.desc}
                    </p>
                  </div>

                  <div className="pt-1">
                    <VehicleRegistrationInput
                      value={registrationNumber}
                      onChange={handleRegChange}
                      error={regError}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Users size={14} className="text-blue-600" />
                      Available Seats
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {vehicleType === "Motorbike"
                        ? "1 seat locked"
                        : `${seats} seat${seats > 1 ? "s" : ""} (Max ${maxSeatsAllowed})`}
                    </span>
                  </label>

                  {vehicleType === "Motorbike" ? (
                    <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-xs font-semibold text-success">
                      <Bike size={18} className="shrink-0 text-success" />
                      <span>Motorbike provides exactly 1 passenger seat for safety.</span>
                    </div>
                  ) : (
                    <div className={`grid gap-1.5 ${maxSeatsAllowed > 6 ? "grid-cols-8" : maxSeatsAllowed > 4 ? "grid-cols-6" : "grid-cols-4"}`}>
                      {seatNumbers.map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSeats(num)}
                          className={`flex h-10 items-center justify-center rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                            seats === num
                              ? "bg-blue-600 text-white shadow-sm scale-105"
                              : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Wallet size={14} className="text-blue-600" />
                      Total Trip Fare (BDT)
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">0 = Free Ride</span>
                  </label>
                  <p className="mb-2 text-[11px] text-slate-400">
                    Total trip cost to be automatically divided equally among confirmed riders.
                  </p>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-2.5 font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={charge}
                      onChange={(e) => setCharge(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-sm font-bold text-slate-800 shadow-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  {Number(charge) > 0 && Number(seats) > 0 && (
                    <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1.5 text-[11px] text-blue-900 flex items-center justify-between">
                      <span>Auto-split: <strong>৳{charge}</strong> total</span>
                      <span>
                        ৳{Math.round((Number(charge) / Number(seats)) * 100) / 100} / person ({seats} riders)
                      </span>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {FARE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setCharge(preset.value)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                          Number(charge) === preset.value
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <FileText size={14} className="text-blue-600" />
                    Ride Notes / Meeting Point (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Waiting near campus gate..."
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-800 shadow-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs font-semibold text-danger">
                  {error}
                </div>
              )}

              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isFormValid || saving || Boolean(activeEngagement)}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none cursor-pointer"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      Posting ride...
                    </span>
                  ) : activeEngagement ? (
                    <span className="flex items-center gap-1.5 text-white">
                      <Ban size={16} />
                      <span>
                        {activeEngagement.type === "POSTED_RIDE"
                          ? "Active Ride Already Posted"
                          : activeEngagement.type === "PENDING_REQUEST"
                          ? "Seat Request Pending (Cancel first)"
                          : "Active Ride In Progress"}
                      </span>
                    </span>
                  ) : !pickup || !dropoff ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={16} />
                      <span>Select Pickup & Drop-off on Map</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span>Post Ride</span>
                      <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-4 text-slate-600 shadow-xs">
              <div className="flex items-start gap-2.5">
                <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <div className="text-xs leading-relaxed">
                  <strong className="font-bold text-slate-800">Tip:</strong> Setting a clear meeting landmark helps passengers locate you quickly.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


