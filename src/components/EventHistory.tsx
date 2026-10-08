import type { SafeCargoEvent } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

function formatTimestamp(iso: string): string {
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

function formatMeasurement(ev: SafeCargoEvent): string {
  const raw =
    ev.measurement ??
    (ev.type === "SHOCK"
      ? ev.accelerationG
      : ev.type === "TILT"
      ? ev.tiltDeg
      : ev.type === "MOTION"
      ? ev.gyroDps
      : ev.type === "LIGHT"
      ? ev.ldrValue
      : undefined);

  if (raw === undefined || raw === null) return "—";
  const n = Number.isInteger(raw) ? raw : Number(raw.toFixed(2));
  switch (ev.type) {
    case "SHOCK":
      return `${n} G`;
    case "TILT":
      return `${n}°`;
    case "MOTION":
      return `${n}°/s`;
    case "LIGHT":
      return `${n} LDR`;
  }
}

function measurementAccent(type: SafeCargoEvent["type"]): string {
  switch (type) {
    case "SHOCK":
      return "text-neon-magenta";
    case "TILT":
      return "text-neon-orange";
    case "MOTION":
      return "text-neon-purple";
    case "LIGHT":
      return "text-neon-yellow";
  }
}

export function EventHistory({ events }: { events: SafeCargoEvent[] }) {
  if (!events || events.length === 0) {
    return (
      <div className="rounded-3xl neon-panel p-6">
        <h3 className="mb-1 text-lg font-bold text-white">Event History</h3>
        <p className="mb-4 text-sm text-slate-400">
          Chronological timeline of cargo events.
        </p>
        <div className="rounded-2xl border border-dashed border-neon-line bg-neon-void/40 p-8 text-center text-sm text-slate-500">
          No events yet. Your cargo is in good shape.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl neon-panel p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-white">Event History</h3>
          <p className="text-sm text-slate-400">
            {events.length} event{events.length === 1 ? "" : "s"} · newest first
          </p>
        </div>
      </div>

      <ol className="relative space-y-3 border-l border-neon-line/80 pl-6">
        {events.map((ev, idx) => (
          <li key={ev.id ?? `${ev.timestamp}-${ev.type}-${idx}`} className="relative">
            <span
              className="absolute -left-[33px] top-3 flex h-4 w-4 items-center justify-center rounded-full border-2 border-neon-void"
              style={{
                background:
                  ev.severity === "CRITICAL"
                    ? "#ef4444"
                    : ev.severity === "HIGH"
                    ? "#ec4899"
                    : ev.severity === "MEDIUM"
                    ? "#facc15"
                    : "#22d3ee",
                boxShadow: "0 0 10px currentColor",
                color:
                  ev.severity === "CRITICAL"
                    ? "#ef4444"
                    : ev.severity === "HIGH"
                    ? "#ec4899"
                    : ev.severity === "MEDIUM"
                    ? "#facc15"
                    : "#22d3ee",
              }}
            />
            <div className="rounded-2xl border border-neon-line bg-neon-void/50 p-4 backdrop-blur-sm transition hover:border-neon-cyan/40">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={ev.type}
                    variant={
                      ev.severity === "LOW"
                        ? "LOW"
                        : ev.severity === "MEDIUM"
                        ? "MEDIUM"
                        : ev.severity === "HIGH"
                        ? "HIGH"
                        : "CRITICAL"
                    }
                    size="sm"
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {ev.severity}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {ev.timeValid === false
                    ? "Unsynchronized Clock"
                    : formatTimestamp(ev.timestamp)}
                </span>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Measurement
                  </p>
                  <p
                    className={`mt-1 font-mono text-base font-bold ${measurementAccent(
                      ev.type
                    )}`}
                  >
                    {formatMeasurement(ev)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Duration
                  </p>
                  <p className="mt-1 font-mono text-base font-bold text-slate-200">
                    {ev.durationMs !== undefined && ev.durationMs !== null
                      ? `${ev.durationMs} ms`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    {ev.eventId !== undefined ? "Event ID" : "Index"}
                  </p>
                  <p className="mt-1 font-mono text-base font-bold text-slate-300">
                    {ev.eventId !== undefined ? `#${ev.eventId}` : `#${events.length - idx}`}
                  </p>
                </div>
              </div>
              {ev.details &&
                typeof ev.details === "object" &&
                Object.keys(ev.details).length > 0 && (
                  <pre className="mt-3 max-h-32 overflow-auto scrollbar-thin whitespace-pre-wrap break-words rounded-xl border border-neon-line bg-black/60 p-3 font-mono text-[11px] leading-5 text-slate-400">
                    {JSON.stringify(ev.details, null, 2)}
                  </pre>
                )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
