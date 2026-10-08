import type { SafeCargoReport } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

function formatNumber(v: number | null | undefined, unit = "", digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const rounded = Number.isInteger(v) ? v : Number(v.toFixed(digits));
  return `${rounded}${unit}`;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - d);
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  } catch {
    return "Unknown";
  }
}

function InfoTile({
  label,
  value,
  accent = "cyan",
}: {
  label: string;
  value: React.ReactNode;
  accent?: "cyan" | "magenta" | "purple" | "green" | "yellow" | "red";
}) {
  const accentClass =
    accent === "cyan"
      ? "from-neon-cyan/10 to-transparent border-neon-cyan/20"
      : accent === "magenta"
      ? "from-neon-magenta/10 to-transparent border-neon-magenta/20"
      : accent === "purple"
      ? "from-neon-purple/10 to-transparent border-neon-purple/20"
      : accent === "green"
      ? "from-neon-green/10 to-transparent border-neon-green/20"
      : accent === "yellow"
      ? "from-neon-yellow/10 to-transparent border-neon-yellow/20"
      : "from-neon-red/10 to-transparent border-neon-red/20";
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-b p-4 backdrop-blur-sm ${accentClass}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function EventCountPill({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: "magenta" | "orange" | "purple" | "yellow";
}) {
  const ring =
    accent === "magenta"
      ? "border-neon-magenta/40 bg-neon-magenta/5 text-neon-pink"
      : accent === "orange"
      ? "border-neon-orange/40 bg-neon-orange/5 text-neon-orange"
      : accent === "purple"
      ? "border-neon-purple/40 bg-neon-purple/5 text-neon-purple"
      : "border-neon-yellow/40 bg-neon-yellow/5 text-neon-yellow";
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center ${ring}`}>
      <span className="font-mono text-2xl font-bold leading-none">
        {count}
      </span>
      <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-90">
        {label}
      </span>
    </div>
  );
}

export function CargoReport({ report }: { report: SafeCargoReport }) {
  const sourceVariant =
    report.source === "NFC" ? "NFC" : report.source === "DEMO" ? "DEMO" : "LIVE";
  const sourceLabel =
    report.source === "NFC"
      ? "NFC / OFFLINE"
      : report.source === "DEMO"
      ? "DEMO / NFC"
      : "LIVE / CLOUD";
  const totalEvents =
    report.eventCounts.SHOCK +
    report.eventCounts.TILT +
    report.eventCounts.MOTION +
    report.eventCounts.LIGHT;

  return (
    <div className="relative overflow-hidden rounded-3xl neon-panel p-5 sm:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-neon-purple/40 to-transparent" />

      {/* Header strip — source/verification. Source-branching ONLY allowed here per AC-5 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={sourceLabel} variant={sourceVariant} pulse />
          <StatusBadge
            label={report.status}
            variant={report.status}
            size="md"
            pulse={report.status === "HIGH" || report.status === "CRITICAL"}
          />
          {report.pending !== undefined && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1 font-mono text-xs font-semibold text-neon-cyan">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan animate-pulse" />
              {report.pending} pending upload{report.pending === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Verified
          </p>
          <p className="font-mono text-xs text-slate-300">
            {formatTimestamp(report.verification.verifiedAt)}
          </p>
        </div>
      </div>

      {/* Remote Reset Pending Alert */}
      {report.resetPending && (
        <div className="mb-6 rounded-2xl border border-neon-yellow/50 bg-neon-yellow/10 p-4 text-neon-yellow shadow-[0_0_20px_rgba(250,204,21,0.2)]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-neon-yellow neon-dot-pulse" />
            <p className="font-bold text-xs uppercase tracking-wider">
              Remote Device Reset Pending
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-300">
            A remote wipe command has been issued for this device. On its next 30-second poll, the device will wipe EEPROM state, erase the NFC tag, and clear all database events.
          </p>
        </div>
      )}

      {/* Device ID block */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-neon-line/60 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neon-cyan/80">
            Cargo / Device ID
          </p>
          <h3 className="mt-1 font-mono text-3xl font-black tracking-tight text-white sm:text-4xl neon-text-glow-cyan">
            {report.deviceId}
          </h3>
          {report.deviceName && (
            <p className="mt-1 text-sm text-slate-400">{report.deviceName}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Last Activity
          </p>
          {report.timeValid === false ? (
            <div className="mt-1">
              <span className="inline-block rounded-md border border-neon-yellow/40 bg-neon-yellow/10 px-2 py-0.5 font-mono text-xs font-semibold text-neon-yellow">
                Clock Unsynchronized
              </span>
              <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                (No NTP network time)
              </p>
            </div>
          ) : (
            <div>
              <p className="mt-1 font-mono text-sm text-slate-200">
                {relativeTime(report.latestTimestamp)}
              </p>
              <p className="font-mono text-[11px] text-slate-500">
                {formatTimestamp(report.latestTimestamp)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Event counts */}
      <div className="mb-6">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Event Summary · {totalEvents} total
        </h4>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <EventCountPill label="Shock"  count={report.eventCounts.SHOCK}  accent="magenta" />
          <EventCountPill label="Tilt"   count={report.eventCounts.TILT}   accent="orange" />
          <EventCountPill label="Motion" count={report.eventCounts.MOTION} accent="purple" />
          <EventCountPill label="Light"  count={report.eventCounts.LIGHT}  accent="yellow" />
        </div>
        <div className="mt-3 rounded-xl border border-neon-line/40 bg-black/40 px-3.5 py-2.5 text-[11px] text-slate-400">
          <p>
            <strong className="text-neon-yellow">LIGHT Notice:</strong> Indicates light exposure / possible tamper. Does not constitute proof of opened cargo.
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Status levels are prototype classifications, not certified cargo-safety limits.
          </p>
        </div>
      </div>

      {/* Peak Measurements */}
      <div className="mb-6">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Peak Measurements
        </h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoTile
            label="Max G-Force"
            value={
              <span>
                {formatNumber(report.max.g, "", 2)}
                <span className="ml-1 text-sm font-semibold text-slate-400">
                  G
                </span>
              </span>
            }
            accent="magenta"
          />
          <InfoTile
            label="Max Tilt"
            value={
              <span>
                {formatNumber(report.max.tilt, "", 1)}
                <span className="ml-1 text-sm font-semibold text-slate-400">
                  °
                </span>
              </span>
            }
            accent="yellow"
          />
          <InfoTile
            label="Max Gyro"
            value={
              <span>
                {formatNumber(report.max.gyro, "", 1)}
                <span className="ml-1 text-sm font-semibold text-slate-400">
                  °/s
                </span>
              </span>
            }
            accent="cyan"
          />
        </div>
      </div>

      {/* Cloud Delivery & Storage Stats (Firmware v2.2) */}
      {(report.pending !== undefined ||
        report.sent !== undefined ||
        report.dropped !== undefined ||
        report.evicted !== undefined) && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Cloud Delivery & Storage Stats
            </h4>
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
              {report.eventsLog?.length
                ? `${report.eventsLog.length} events on tag`
                : "Firmware v2.2"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-neon-yellow/30 bg-neon-yellow/5 p-3 text-center">
              <span className="font-mono text-xl font-bold text-neon-yellow">
                {report.pending ?? 0}
              </span>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Pending Sync
              </p>
            </div>
            <div className="rounded-2xl border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-center">
              <span className="font-mono text-xl font-bold text-neon-cyan-bright">
                {report.sent ?? 0}
              </span>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Delivered
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-3 text-center">
              <span className="font-mono text-xl font-bold text-slate-300">
                {report.dropped ?? 0}
              </span>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Rejected (4xx)
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-3 text-center">
              <span className="font-mono text-xl font-bold text-slate-400">
                {report.evicted ?? 0}
              </span>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Evicted / Lost
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Latest event */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Latest Event
        </h4>
        {report.latestEvent ? (
          <div className="rounded-2xl border border-neon-line bg-neon-void/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusBadge
                  label={report.latestEvent.type}
                  variant={
                    (report.latestEvent.severity === "LOW"
                      ? "LOW"
                      : report.latestEvent.severity === "MEDIUM"
                      ? "MEDIUM"
                      : report.latestEvent.severity === "HIGH"
                      ? "HIGH"
                      : "CRITICAL") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
                  }
                  size="sm"
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  {report.latestEvent.severity} severity
                </span>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs text-slate-300">
                  {relativeTime(report.latestEvent.timestamp)}
                </p>
                <p className="font-mono text-[10px] text-slate-500">
                  {formatTimestamp(report.latestEvent.timestamp)}
                </p>
              </div>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              {report.latestEvent.eventId !== undefined && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Event ID
                  </p>
                  <p className="mt-1 font-mono text-base font-bold text-slate-200">
                    #{report.latestEvent.eventId}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Measurement
                </p>
                <p className="mt-1 font-mono text-base font-bold text-neon-cyan-bright">
                  {report.latestEvent.measurement !== undefined
                    ? report.latestEvent.measurement
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Duration
                </p>
                <p className="mt-1 font-mono text-base font-bold text-neon-purple">
                  {report.latestEvent.durationMs !== undefined
                    ? `${report.latestEvent.durationMs} ms`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Schema Version
                </p>
                <p className="mt-1 font-mono text-base font-bold text-slate-300">
                  v{report.version}
                </p>
              </div>
            </div>
            {report.latestEvent.details &&
              Object.keys(report.latestEvent.details).length > 0 && (
                <pre className="mt-4 max-h-40 overflow-auto scrollbar-thin whitespace-pre-wrap break-words rounded-xl border border-neon-line bg-black/60 p-3 font-mono text-[11px] leading-5 text-slate-400">
                  {JSON.stringify(report.latestEvent.details, null, 2)}
                </pre>
              )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neon-line bg-neon-void/40 p-5 text-center text-sm text-slate-500">
            No events recorded yet — cargo is clean.
          </div>
        )}
      </div>

      {/* Footer verification strip */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-neon-line/60 pt-4 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {report.verification.nfcSerialNumber && (
            <span className="font-mono">
              NFC SN: {report.verification.nfcSerialNumber}
            </span>
          )}
          {report.verification.tagType && (
            <span className="font-mono">
              Tag: {report.verification.tagType}
            </span>
          )}
          <span className="font-mono">
            Method: {report.verification.method}
          </span>
        </div>
        {report.sensorInfo && (
          <div className="font-mono">
            {[
              report.sensorInfo.espModel,
              report.sensorInfo.accelerometer,
              report.sensorInfo.nfcChip,
              report.sensorInfo.firmwareVersion ? `fw ${report.sensorInfo.firmwareVersion}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
