import type {
  SafeCargoEventSeverity,
  SafeCargoLogState,
  SafeCargoReportStatus,
} from "@/lib/types";

type BadgeVariant =
  | SafeCargoReportStatus
  | SafeCargoEventSeverity
  | SafeCargoLogState
  | "DEMO"
  | "NFC"
  | "LIVE"
  | "ONLINE"
  | "OFFLINE";

const STATUS_STYLES: Record<BadgeVariant, {
  text: string;
  bg: string;
  border: string;
  glow?: string;
}> = {
  NORMAL:   { text: "text-neon-green",  bg: "bg-neon-green/10",  border: "border-neon-green/40", glow: "0 0 16px rgba(34,197,94,0.45)" },
  LOW:      { text: "text-neon-cyan-bright", bg: "bg-neon-cyan/10",   border: "border-neon-cyan/40",  glow: "0 0 14px rgba(34,211,238,0.40)" },
  MEDIUM:   { text: "text-neon-yellow",bg: "bg-neon-yellow/10", border: "border-neon-yellow/40",glow: "0 0 14px rgba(250,204,21,0.40)" },
  WARNING:  { text: "text-neon-orange",bg: "bg-neon-orange/10", border: "border-neon-orange/40",glow: "0 0 16px rgba(249,115,22,0.45)" },
  HIGH:     { text: "text-neon-magenta",bg: "bg-neon-magenta/10",border: "border-neon-magenta/40",glow: "0 0 18px rgba(236,72,153,0.50)" },
  CRITICAL: { text: "text-neon-red",   bg: "bg-neon-red/10",    border: "border-neon-red/40",   glow: "0 0 20px rgba(239,68,68,0.55)" },

  DEMO:     { text: "text-neon-purple",   bg: "bg-neon-purple/10", border: "border-neon-purple/40",   glow: "0 0 16px rgba(168,85,247,0.45)" },
  NFC:      { text: "text-neon-cyan-bright",   bg: "bg-neon-cyan/10",   border: "border-neon-cyan/40",    glow: "0 0 16px rgba(34,211,238,0.50)" },
  LIVE:     { text: "text-neon-lime",   bg: "bg-neon-lime/10",   border: "border-neon-lime/40",    glow: "0 0 16px rgba(132,204,22,0.45)" },
  ONLINE:   { text: "text-neon-green",  bg: "bg-neon-green/10",  border: "border-neon-green/40",   glow: "0 0 12px rgba(34,197,94,0.40)" },
  OFFLINE:  { text: "text-slate-400",   bg: "bg-slate-600/10",   border: "border-slate-500/40" },

  PENDING:  { text: "text-neon-yellow", bg: "bg-neon-yellow/10", border: "border-neon-yellow/40", glow: "0 0 12px rgba(250,204,21,0.35)" },
  SENT:     { text: "text-neon-cyan-bright", bg: "bg-neon-cyan/10", border: "border-neon-cyan/40", glow: "0 0 12px rgba(34,211,238,0.35)" },
  DROPPED:  { text: "text-neon-red",    bg: "bg-neon-red/10",    border: "border-neon-red/40",    glow: "0 0 12px rgba(239,68,68,0.35)" },
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
    size === "sm" ? "px-2 py-0.5 text-[10px]" :
    size === "lg" ? "px-4 py-1.5 text-sm" :
    "px-3 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${s.border} ${s.bg} ${s.text} ${padding} font-semibold uppercase tracking-wider`}
      style={s.glow ? { boxShadow: s.glow } : undefined}
    >
      {pulse && (
        <span
          className="h-2 w-2 rounded-full neon-dot-pulse"
          style={{ background: "currentColor", color: "currentColor" }}
        />
      )}
      {label}
    </span>
  );
}
