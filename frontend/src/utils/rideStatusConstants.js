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
  ongoing: { next: "completed", label: "Mark completed" },
};

export const TIMELINE_COLORS = {
  upcoming: "bg-sky-400",
  ongoing: "bg-amber-400",
  completed: "bg-emerald-400",
};
