import { Bike, Car } from "lucide-react";

export default function VehicleTypeBadge({ vehicle, showPlate = true, size = "md" }) {
  if (!vehicle) return null;

  const isTwoWheeler =
    vehicle.category === "Two-wheeler" || vehicle.vehicleCategory === "Two-wheeler";
  const type = vehicle.vehicleType || (isTwoWheeler ? "Motorbike" : "Car");
  const regNo = vehicle.registrationNumber || "Dhaka Metro-Ga 34-5034";
  const maxSeats = vehicle.maxSeats || (type === "Motorbike" ? 1 : type === "Microbus" ? 8 : type === "Jeep" ? 6 : 4);

  let badgeColor = "bg-teal-50 text-teal-700 border-teal-200/80";
  let iconColor = "text-teal-600";
  let IconComponent = Car;

  if (type === "Motorbike") {
    badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
    iconColor = "text-emerald-600";
    IconComponent = Bike;
  } else if (type === "Jeep") {
    badgeColor = "bg-purple-50 text-purple-700 border-purple-200/80";
    iconColor = "text-purple-600";
    IconComponent = Car;
  } else if (type === "Microbus") {
    badgeColor = "bg-amber-50 text-amber-800 border-amber-200/80";
    iconColor = "text-amber-600";
    IconComponent = Car;
  }

  const isSmall = size === "sm";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-bold shadow-2xs ${badgeColor} ${
          isSmall ? "text-[10px]" : "text-xs"
        }`}
        title={`${isTwoWheeler ? "Two-wheeler" : "Four-wheeler"} · ${type} (Up to ${maxSeats} seats)`}
      >
        <IconComponent size={isSmall ? 11 : 13} className={`shrink-0 ${iconColor}`} />
        <span>{type}</span>
        <span className="opacity-60 text-[10px]">
          ({isTwoWheeler ? "2-Wheeler" : "4-Wheeler"})
        </span>
      </span>

      {showPlate && regNo && (
        <span
          className={`inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100/90 font-mono font-black tracking-wider text-slate-700 px-2 py-0.5 shadow-2xs ${
            isSmall ? "text-[9px]" : "text-[11px]"
          }`}
          title="Vehicle Registration Number"
        >
          <span className="text-[9px] font-sans font-bold uppercase text-slate-400">REG</span>
          <span className="text-slate-800">{regNo}</span>
        </span>
      )}
    </div>
  );
}
