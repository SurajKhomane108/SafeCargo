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

function MetricBox({
  label,
  value,
  sublabel,
  accent = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  accent?: "neutral" | "warning" | "danger" | "success";
}) {
  const accentBorder =
    accent === "danger"
      ? "border-rose-300 bg-rose-50/50"
      : accent === "warning"
      ? "border-amber-300 bg-amber-50/50"
      : accent === "success"
      ? "border-emerald-300 bg-emerald-50/50"
      : "border-slate-200 bg-slate-50/50";

  return (
    <div className={`border p-3 ${accentBorder} rounded-none`}>
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="mt-1 font-mono text-lg font-bold text-slate-900 sm:text-xl">
        {value}
      </div>
      {sublabel && (
        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
          {sublabel}
        </p>
      )}
    </div>
  );
}

export function CargoReport({ report }: { report: SafeCargoReport }) {
  const sourceVariant =
    report.source === "NFC" ? "NFC" : report.source === "DEMO" ? "DEMO" : "LIVE";
  const sourceLabel =
    report.source === "NFC"
      ? "NFC VERIFIED (OFFLINE)"
      : report.source === "DEMO"
      ? "DEMO TAG"
      : "LIVE CLOUD TELEMETRY";

  const totalEvents =
    report.eventCounts.SHOCK +
    report.eventCounts.TILT +
    report.eventCounts.MOTION +
    report.eventCounts.LIGHT;

  const hasBreach =
    report.status === "CRITICAL" ||
    report.status === "HIGH" ||
    report.status === "WARNING";

  return (
    <section className="rounded-none border-2 border-slate-900 bg-white shadow-sm">
      {/* Official Document Banner */}
      <div className="border-b border-slate-900 bg-slate-900 px-4 py-3 text-white sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black uppercase tracking-widest bg-white text-slate-900 px-1.5 py-0.5">
              OFFICIAL REPORT
            </span>
            <span className="font-mono text-xs text-slate-300">
              REF #{report.deviceId}-{report.version}
            </span>
          </div>
          <div className="font-mono text-xs text-slate-300">
            {formatTimestamp(report.verification.verifiedAt)}
          </div>
        </div>
      </div>

      {/* Report Header Strip */}
      <div className="border-b border-slate-200 p-4 sm:p-6 bg-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-mono text-xl font-bold uppercase tracking-tight text-slate-900 sm:text-2xl">
              Cargo Integrity & Telemetry Report
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Chain-of-Custody Certification & Physical Sensor Event Log
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={sourceLabel} variant={sourceVariant} size="sm" />
            <StatusBadge
              label={`STATUS: ${report.status}`}
              variant={report.status}
              size="md"
            />
          </div>
        </div>

        {/* Remote Reset Pending Warning if active */}
        {report.resetPending && (
          <div className="mt-4 border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 font-mono">
            <p className="font-bold uppercase tracking-wider">
              Notice: Remote Device Reset Pending
            </p>
            <p className="mt-0.5 text-slate-700">
              A wipe command is queued for this unit. Memory and logs will clear on its next connection.
            </p>
          </div>
        )}

        {/* Key Identifiers Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4 font-mono text-xs">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
              Device Identifier
            </span>
            <span className="font-bold text-slate-900 text-sm">
              {report.deviceId}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
              Time Accuracy
            </span>
            <span className={report.timeValid === false ? "font-bold text-amber-700" : "font-semibold text-slate-800"}>
              {report.timeValid === false ? "Unsynced (RTC Offline)" : "Synchronized (NTP)"}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
              Total Recorded Events
            </span>
            <span className="font-bold text-slate-900">
              {totalEvents} incidents
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
              Last Known Activity
            </span>
            <span className="text-slate-800 font-semibold truncate block">
              {report.latestTimestamp ? relativeTime(report.latestTimestamp) : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Sensor Maxima & Peak Exposure Limits */}
      <div className="border-b border-slate-200 p-4 sm:p-6 bg-white">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
          1. Peak Telemetry Exposures (Observed Maxima)
        </h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MetricBox
            label="Peak Shock Force"
            value={`${formatNumber(report.max.g, "", 2)} G`}
            sublabel="Threshold: 2.0 G"
            accent={report.max.g && report.max.g > 2.5 ? "danger" : report.max.g && report.max.g > 1.8 ? "warning" : "neutral"}
          />
          <MetricBox
            label="Max Tilt Deviation"
            value={`${formatNumber(report.max.tilt, "", 1)}°`}
            sublabel="Threshold: 35.0°"
            accent={report.max.tilt && report.max.tilt > 45 ? "danger" : report.max.tilt && report.max.tilt > 30 ? "warning" : "neutral"}
          />
          <MetricBox
            label="Peak Angular Velocity"
            value={`${formatNumber(report.max.gyro, "", 1)} °/s`}
            sublabel="Threshold: 150 °/s"
            accent={report.max.gyro && report.max.gyro > 200 ? "warning" : "neutral"}
          />
          <MetricBox
            label="Optical Tamper / LDR"
            value={report.eventCounts.LIGHT > 0 ? "EXPOSURE ALERT" : "SEAL INTACT"}
            sublabel={`${report.eventCounts.LIGHT} light incidents`}
            accent={report.eventCounts.LIGHT > 0 ? "warning" : "success"}
          />
        </div>
      </div>

      {/* Incident Count Breakdown Table */}
      <div className="border-b border-slate-200 p-4 sm:p-6 bg-white">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
          2. Incident Classification Breakdown ({totalEvents} Total)
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono">
          <div className="border border-slate-200 p-3 text-center bg-slate-50/50">
            <span className="block text-2xl font-bold text-slate-900">{report.eventCounts.SHOCK}</span>
            <span className="text-[11px] font-semibold text-slate-600 uppercase">Impact / Shock</span>
          </div>
          <div className="border border-slate-200 p-3 text-center bg-slate-50/50">
            <span className="block text-2xl font-bold text-slate-900">{report.eventCounts.TILT}</span>
            <span className="text-[11px] font-semibold text-slate-600 uppercase">Tilt / Inversion</span>
          </div>
          <div className="border border-slate-200 p-3 text-center bg-slate-50/50">
            <span className="block text-2xl font-bold text-slate-900">{report.eventCounts.MOTION}</span>
            <span className="text-[11px] font-semibold text-slate-600 uppercase">Excess Motion</span>
          </div>
          <div className="border border-slate-200 p-3 text-center bg-slate-50/50">
            <span className="block text-2xl font-bold text-slate-900">{report.eventCounts.LIGHT}</span>
            <span className="text-[11px] font-semibold text-slate-600 uppercase">Light / Tamper</span>
          </div>
        </div>
      </div>

      {/* Buffer & Transmission Telemetry */}
      {(report.pending !== undefined ||
        report.sent !== undefined ||
        report.dropped !== undefined ||
        report.evicted !== undefined) && (
        <div className="border-b border-slate-200 p-4 sm:p-6 bg-slate-50/60">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            3. On-Device Buffer & Delivery Audit
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-xs">
            <div className="border border-slate-200 bg-white p-2.5">
              <span className="text-[10px] text-slate-500 uppercase block">Pending Sync</span>
              <span className="font-bold text-amber-800 text-base">{report.pending ?? 0}</span>
            </div>
            <div className="border border-slate-200 bg-white p-2.5">
              <span className="text-[10px] text-slate-500 uppercase block">Cloud Delivered</span>
              <span className="font-bold text-emerald-800 text-base">{report.sent ?? 0}</span>
            </div>
            <div className="border border-slate-200 bg-white p-2.5">
              <span className="text-[10px] text-slate-500 uppercase block">Dropped (4xx)</span>
              <span className="font-bold text-slate-700 text-base">{report.dropped ?? 0}</span>
            </div>
            <div className="border border-slate-200 bg-white p-2.5">
              <span className="text-[10px] text-slate-500 uppercase block">Ring Evicted</span>
              <span className="font-bold text-slate-700 text-base">{report.evicted ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Latest Incident Record (DURATION FIELD REMOVED) */}
      <div className="border-b border-slate-200 p-4 sm:p-6 bg-white">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
          4. Most Recent Incident Record
        </h3>
        {report.latestEvent ? (
          <div className="border border-slate-300 bg-slate-50 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <StatusBadge
                  label={report.latestEvent.type}
                  variant={report.latestEvent.type}
                  size="sm"
                />
                <StatusBadge
                  label={report.latestEvent.severity}
                  variant={report.latestEvent.severity}
                  size="sm"
                />
                {report.latestEvent.eventId !== undefined && (
                  <span className="font-mono text-xs font-bold text-slate-700">
                    Event #{report.latestEvent.eventId}
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-slate-500">
                {formatTimestamp(report.latestEvent.timestamp)}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 font-mono text-xs">
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Measurement</span>
                <span className="font-bold text-slate-900 text-sm">
                  {report.latestEvent.measurement !== undefined
                    ? `${report.latestEvent.measurement} ${
                        report.latestEvent.type === "SHOCK"
                          ? "G"
                          : report.latestEvent.type === "TILT"
                          ? "°"
                          : report.latestEvent.type === "MOTION"
                          ? "°/s"
                          : "LDR"
                      }`
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Recorded At</span>
                <span className="text-slate-800">
                  {relativeTime(report.latestEvent.timestamp)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Payload Schema</span>
                <span className="text-slate-800">v{report.version} verified</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-slate-200 bg-slate-50 p-4 text-center font-mono text-xs text-slate-500">
            No incident events recorded. Cargo maintained pristine transit conditions.
          </div>
        )}
      </div>

      {/* Hardware & Cryptographic Tag Authentication */}
      <div className="bg-slate-50 p-4 sm:p-5 font-mono text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
          <div className="flex flex-wrap items-center gap-3">
            {report.verification.nfcSerialNumber && (
              <span>
                <strong className="text-slate-900">Tag UID:</strong> {report.verification.nfcSerialNumber}
              </span>
            )}
            {report.verification.tagType && (
              <span>
                <strong className="text-slate-900">Tag Model:</strong> {report.verification.tagType}
              </span>
            )}
            <span>
              <strong className="text-slate-900">Method:</strong> {report.verification.method}
            </span>
          </div>
          {report.sensorInfo && (
            <div>
              {[
                report.sensorInfo.espModel ? `MCU: ${report.sensorInfo.espModel}` : null,
                report.sensorInfo.accelerometer ? `Sensor: ${report.sensorInfo.accelerometer}` : null,
                report.sensorInfo.firmwareVersion ? `FW: ${report.sensorInfo.firmwareVersion}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
