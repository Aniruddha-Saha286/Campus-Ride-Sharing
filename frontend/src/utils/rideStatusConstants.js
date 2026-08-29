import { Clock3, Play, CheckCircle2 } from "lucide-react";

export const TRIP_META = {
  upcoming: {
    label: "Upcoming",
    classes: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-400",
    icon: Clock3,
  },
  ongoing: {
    label: "Ongoing",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-400 animate-pulse",
    icon: Play,
  },
  completed: {
    label: "Completed",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-400",
    icon: CheckCircle2,
  },
};

export const NEXT_ACTION = {
  upcoming: { next: "ongoing", label: "Start ride" },
  ongoing: { next: "completed", label: "Ride Ended" },
};

export const TIMELINE_COLORS = {
  upcoming: "bg-sky-400",
  ongoing: "bg-amber-400",
  completed: "bg-emerald-400",
};

export const formatTime12Hour = (time24) => {
  if (!time24) return "";
  const parts = String(time24).split(":");
  if (parts.length < 2) return time24;
  let hours = parseInt(parts[0], 10);
  const minutes = String(parts[1]).padStart(2, "0");
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, "0");
  return `${formattedHours}:${minutes} ${ampm}`;
};

export const parse12HourTo24 = (hour12, minute, ampm) => {
  let h = parseInt(hour12, 10) || 12;
  const m = String(minute).padStart(2, "0");
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
};
