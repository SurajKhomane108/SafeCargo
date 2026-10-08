import type {
  SafeCargoEventSeverity,
  SafeCargoEventType,
  SafeCargoLogState,
  SafeCargoReportStatus,
} from "@/lib/types";

type BadgeVariant =
  | SafeCargoReportStatus
  | SafeCargoEventSeverity
  | SafeCargoEventType
  | SafeCargoLogState
  | "DEMO"
  | "NFC"
  | "LIVE"
  | "ONLINE"
  | "OFFLINE";

const STATUS_STYLES: Record<
  BadgeVariant,
  {
    text: string;
    bg: string;
    border: string;
    dotBg?: string;
  }
> = {
  NORMAL: {
    text: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    dotBg: "bg-emerald-600",
  },
  LOW: {
    text: "text-sky-800",
    bg: "bg-sky-50",
    border: "border-sky-300",
    dotBg: "bg-sky-600",
  },
  MEDIUM: {
    text: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-300",
    dotBg: "bg-amber-600",
  },
  WARNING: {
    text: "text-amber-900",
    bg: "bg-amber-100",
    border: "border-amber-400",
    dotBg: "bg-amber-600",
  },
  HIGH: {
    text: "text-rose-800",
    bg: "bg-rose-50",
    border: "border-rose-300",
    dotBg: "bg-rose-600",
  },
  CRITICAL: {
    text: "text-red-900",
    bg: "bg-red-100",
    border: "border-red-400",
    dotBg: "bg-red-600",
  },

  // Event Types
  SHOCK: {
    text: "text-rose-900",
    bg: "bg-rose-100",
    border: "border-rose-300",
    dotBg: "bg-rose-600",
  },
  TILT: {
    text: "text-orange-900",
    bg: "bg-orange-100",
    border: "border-orange-300",
    dotBg: "bg-orange-600",
  },
  MOTION: {
    text: "text-purple-900",
    bg: "bg-purple-100",
    border: "border-purple-300",
    dotBg: "bg-purple-600",
  },
  LIGHT: {
    text: "text-amber-900",
    bg: "bg-amber-100",
    border: "border-amber-300",
    dotBg: "bg-amber-600",
  },
  NONE: {
    text: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-300",
    dotBg: "bg-slate-400",
  },

  DEMO: {
    text: "text-purple-800",
    bg: "bg-purple-50",
    border: "border-purple-300",
    dotBg: "bg-purple-600",
  },
  NFC: {
    text: "text-blue-800",
    bg: "bg-blue-50",
    border: "border-blue-300",
    dotBg: "bg-blue-600",
  },
  LIVE: {
    text: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    dotBg: "bg-emerald-600",
  },
  ONLINE: {
    text: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    dotBg: "bg-emerald-600",
  },
  OFFLINE: {
    text: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-300",
    dotBg: "bg-slate-400",
  },

  PENDING: {
    text: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-300",
    dotBg: "bg-amber-500",
  },
  SENT: {
    text: "text-blue-800",
    bg: "bg-blue-50",
    border: "border-blue-300",
    dotBg: "bg-blue-600",
  },
  DROPPED: {
    text: "text-rose-800",
    bg: "bg-rose-50",
    border: "border-rose-300",
    dotBg: "bg-rose-600",
  },
};

export function StatusBadge({
  label,
  variant,
  size = "md",
  pulse = false,
}: {
  label: string;
  variant: BadgeVariant;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}) {
  const s = STATUS_STYLES[variant] ?? STATUS_STYLES.NORMAL;
  const padding =
    size === "sm"
      ? "px-2 py-0.5 text-[10px]"
      : size === "lg"
      ? "px-3.5 py-1.5 text-xs"
      : "px-2.5 py-1 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-none border ${s.border} ${s.bg} ${s.text} ${padding} font-mono font-bold uppercase tracking-wider`}
    >
      {pulse && (
        <span
          className={`h-1.5 w-1.5 rounded-none ${s.dotBg ?? "bg-current"} animate-pulse`}
        />
      )}
      {label}
    </span>
  );
}
