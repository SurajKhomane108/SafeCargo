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
      ? "LIVE TELEMETRY"
      : "STANDBY";
  const sourceVariant =
    source === "NFC"
      ? "NFC"
      : source === "DEMO"
      ? "DEMO"
      : source === "LIVE"
      ? "LIVE"
      : "OFFLINE";

  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-none bg-slate-900 text-white font-mono text-sm font-bold tracking-tight">
          SC
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl font-mono uppercase">
              SafeCargo
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 border border-slate-200 px-1.5 py-0.5">
              v1.0
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Chain-of-Custody & Cargo Integrity Platform
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
        <StatusBadge label={sourceLabel} variant={sourceVariant} size="sm" />
        {source === "LIVE" && (
          <StatusBadge
            label={online ? "ONLINE" : "OFFLINE"}
            variant={online ? "ONLINE" : "OFFLINE"}
            size="sm"
            pulse={Boolean(online)}
          />
        )}
        {source === "LIVE" && lastSeenAt && (
          <span className="border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600">
            seen {formatRel(lastSeenAt)}
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
