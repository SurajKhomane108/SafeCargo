import { StatusBadge } from "./StatusBadge";
import type { SafeCargoReportSource } from "@/lib/types";

export function AppHeader({
  source,
  online,
  lastSeenAt,
}: {
  source: SafeCargoReportSource | "IDLE";
  online?: boolean | null;
  lastSeenAt?: string | null;
}) {
  const sourceLabel =
    source === "NFC"
      ? "OFFLINE NFC"
      : source === "DEMO"
      ? "NFC DEMO"
      : source === "LIVE"
      ? "LIVE MONITORING"
      : "AWAITING INPUT";
  const sourceVariant =
    source === "NFC"
      ? "NFC"
      : source === "DEMO"
      ? "DEMO"
      : source === "LIVE"
      ? "LIVE"
      : "OFFLINE";

  return (
    <header className="relative mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <div
          className="relative flex h-12 w-12 flex-none items-center justify-center rounded-2xl font-black text-neon-void"
          style={{
            background:
              "linear-gradient(135deg, #22d3ee 0%, #a855f7 60%, #ec4899 100%)",
            boxShadow:
              "0 0 24px rgba(34,211,238,0.45), 0 0 44px rgba(168,85,247,0.35)",
          }}
        >
          <span className="text-xl tracking-tight">SC</span>
          <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/20" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            <span className="neon-text-glow-cyan">Safe</span>
            <span className="neon-text-glow-magenta">Cargo</span>
          </h1>
          <p className="text-xs text-slate-400 sm:text-sm">
            Intelligent Cargo Monitoring
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={sourceLabel} variant={sourceVariant} size="md" />
        {source === "LIVE" && (
          <StatusBadge
            label={online ? "ONLINE" : "OFFLINE"}
            variant={online ? "ONLINE" : "OFFLINE"}
            size="md"
            pulse={Boolean(online)}
          />
        )}
        {source === "LIVE" && lastSeenAt && (
          <span className="rounded-full border border-neon-line bg-neon-panel/70 px-3 py-1 font-mono text-[11px] text-slate-300">
            last seen {formatRel(lastSeenAt)}
          </span>
        )}
      </div>
    </header>
  );
}

function formatRel(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return "—";
  }
}
