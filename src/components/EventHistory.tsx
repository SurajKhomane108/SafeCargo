import type { SafeCargoEvent } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

function formatTimestamp(ev: SafeCargoEvent): string {
  if (ev.timeValid === false || ev.timestamp === "UNSYNCED" || !ev.timestamp) {
    if (ev.boot !== undefined || ev.uptimeSec !== undefined) {
      return `Unsynced (Boot ${ev.boot ?? "?"}, +${ev.uptimeSec ?? 0}s)`;
    }
    return "Clock Unsynchronized";
  }
  try {
    const d = new Date(ev.timestamp);
    if (!Number.isFinite(d.getTime())) return ev.timestamp;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ev.timestamp;
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
    default:
      return `${n}`;
  }
}

export function EventHistory({ events }: { events: SafeCargoEvent[] }) {
  if (!events || events.length === 0) {
    return (
      <div className="rounded-none border border-slate-300 bg-white p-4 sm:p-6">
        <h3 className="font-mono text-base font-bold uppercase tracking-tight text-slate-900">
          Incident Audit History
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Chronological record of physical cargo events.
        </p>
        <div className="mt-4 border border-dashed border-slate-300 bg-slate-50 p-6 text-center font-mono text-xs text-slate-500">
          No incident events recorded. Cargo maintained pristine transit conditions.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-none border border-slate-300 bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-mono text-base font-bold uppercase tracking-tight text-slate-900">
            Incident Audit History
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Complete sequential log · newest recorded first
          </p>
        </div>
        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5">
          {events.length} {events.length === 1 ? "Incident" : "Incidents"}
        </span>
      </div>

      <div className="space-y-2.5">
        {events.map((ev, idx) => {
          const eventNum = ev.eventId !== undefined ? ev.eventId : events.length - idx;
          return (
            <div
              key={ev.id ?? `${ev.timestamp}-${ev.type}-${idx}`}
              className="border border-slate-200 bg-slate-50/50 p-3 transition hover:border-slate-400 hover:bg-white"
            >
              {/* Event Header row */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900 bg-white border border-slate-300 px-1.5 py-0.5">
                    #{eventNum}
                  </span>
                  <StatusBadge label={ev.type} variant={ev.type} size="sm" />
                  <StatusBadge label={ev.severity} variant={ev.severity} size="sm" />
                  {ev.logState && (
                    <span className="font-mono text-[10px] text-slate-500">
                      [{ev.logState === "SENT" ? "Delivered" : ev.logState === "DROPPED" ? "Dropped" : "Tag Buffer"}]
                    </span>
                  )}
                </div>

                <div className="font-mono text-[11px] text-slate-500">
                  {formatTimestamp(ev)}
                </div>
              </div>

              {/* Event Metrics row (NO DURATION) */}
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">
                    Recorded Impact / Value
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatMeasurement(ev)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">
                    Telemetry Type
                  </span>
                  <span className="text-slate-700 font-semibold">
                    {ev.type}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">
                    Hardware Cycle
                  </span>
                  <span className="text-slate-600">
                    {ev.boot !== undefined ? `Boot #${ev.boot}` : "—"}
                    {ev.uptimeSec !== undefined ? ` (+${ev.uptimeSec}s)` : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
