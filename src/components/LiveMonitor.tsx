"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DeviceSummary,
  SafeCargoEvent,
  SafeCargoReport,
} from "@/lib/types";
import { DeviceSelector } from "./DeviceSelector";
import { StatusBadge } from "./StatusBadge";

export interface LiveMonitorProps {
  initialDeviceId?: string | null;
  onReportLoaded?: (r: SafeCargoReport, events: SafeCargoEvent[]) => void;
}

const FALLBACK_BANNER =
  "Live data is currently unavailable. NFC/offline verification can still be used.";

function mapDeviceSummary(raw: {
  id: string;
  name?: string | null;
  status?: SafeCargoReport["status"] | null;
  lastSeenAt?: string | null;
  createdAt?: string | null;
}): DeviceSummary {
  return {
    id: raw.id,
    name: raw.name ?? "",
    status: (raw.status as DeviceSummary["status"]) ?? "NORMAL",
    lastSeenAt: raw.lastSeenAt ?? null,
    createdAt: raw.createdAt ?? null,
  } as DeviceSummary;
}

function mapEvent(raw: unknown): SafeCargoEvent {
  const r = raw as {
    id?: string;
    event_type: SafeCargoEvent["type"];
    severity: SafeCargoEvent["severity"];
    measurement?: number | null;
    duration_ms?: number | null;
    details?: unknown;
    created_at: string;
  };
  return {
    id: r.id,
    type: r.event_type,
    severity: r.severity,
    measurement:
      typeof r.measurement === "number" ? r.measurement : undefined,
    durationMs:
      typeof r.duration_ms === "number" ? r.duration_ms : undefined,
    details:
      r.details && typeof r.details === "object"
        ? (r.details as Record<string, unknown>)
        : undefined,
    timestamp: r.created_at,
  };
}

function relTime(iso: string, nowMs: number): string {
  try {
    const t = new Date(iso).getTime();
    const s = Math.max(0, Math.floor((nowMs - t) / 1000));
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

function StatBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neon-line bg-neon-void/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function LiveMonitor({
  initialDeviceId,
  onReportLoaded,
}: LiveMonitorProps) {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDeviceId ?? null
  );
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SafeCargoReport | null>(null);
  const [events, setEvents] = useState<SafeCargoEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const selectedDevice =
    devices.find((d) => d.id === selectedId) ?? null;

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices", { cache: "no-store" });
      if (res.status === 503) {
        setNetworkError(true);
        setError(FALLBACK_BANNER);
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { devices: unknown[] };
      const list: DeviceSummary[] = (data.devices ?? []).map((raw) =>
        mapDeviceSummary(
          raw as {
            id: string;
            name?: string | null;
            status?: SafeCargoReport["status"] | null;
            lastSeenAt?: string | null;
            createdAt?: string | null;
          }
        )
      );
      setDevices(list);
      setNetworkError(false);
      setSelectedId((prev) => {
        if (prev && list.some((d) => d.id === prev)) return prev;
        const pick = list.find((d) => d.id === "SC-0001") ?? list[0] ?? null;
        return pick ? pick.id : null;
      });
    } catch (e) {
      console.error("[SafeCargo] loadDevices failed:", e);
      setNetworkError(true);
      setError(e instanceof Error ? e.message : FALLBACK_BANNER);
    }
  }, []);

  const loadDeviceData = useCallback(
    async (deviceId: string) => {
      if (!deviceId) return;
      setLoading(true);
      setError(null);
      try {
        const [reportRes, eventsRes] = await Promise.all([
          fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
            cache: "no-store",
          }),
          fetch(
            `/api/devices/${encodeURIComponent(deviceId)}/events?limit=50`,
            { cache: "no-store" }
          ),
        ]);

        if (reportRes.status === 503 || eventsRes.status === 503) {
          setNetworkError(true);
          setError(FALLBACK_BANNER);
          setLoading(false);
          return;
        }

        if (!reportRes.ok) {
          const j = (await reportRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(j.error ?? `HTTP ${reportRes.status}`);
        }
        const reportData = (await reportRes.json()) as SafeCargoReport;

        let evs: SafeCargoEvent[] = [];
        if (eventsRes.ok) {
          const evdata = (await eventsRes.json()) as { events: unknown[] };
          evs = (evdata.events ?? []).map(mapEvent);
        }

        setReport(reportData);
        setEvents(evs);
        setNetworkError(false);
        setLastFetched(new Date().toISOString());
        onReportLoaded?.(reportData, evs);
      } catch (e) {
        console.error("[SafeCargo] loadDeviceData failed:", e);
        setError(
          e instanceof Error
            ? e.message
            : "Unable to load live data. Please try again."
        );
      } finally {
        setLoading(false);
      }
    },
    [onReportLoaded]
  );

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      Promise.resolve()
        .then(() => loadDevices())
        .catch(() => {});
    };
    run();
    const interval = setInterval(run, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadDevices]);

  useEffect(() => {
    if (!selectedId) return;
    Promise.resolve()
      .then(() => loadDeviceData(selectedId))
      .catch(() => {});
  }, [selectedId, loadDeviceData]);

  const online = selectedDevice
    ? selectedDevice.lastSeenAt
      ? nowMs - new Date(selectedDevice.lastSeenAt).getTime() < 5 * 60 * 1000
      : false
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl neon-panel p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white sm:text-2xl">
              Live Monitoring
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Real-time data from the SafeCargo device fleet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              Promise.resolve()
                .then(() => loadDevices())
                .catch(() => {});
              if (selectedId) {
                Promise.resolve()
                  .then(() => loadDeviceData(selectedId))
                  .catch(() => {});
              }
            }}
            disabled={loading}
            className="rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-neon-cyan-bright transition hover:bg-neon-cyan/20 disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {networkError && (
          <div className="mb-5 rounded-2xl border border-neon-yellow/40 bg-neon-yellow/5 p-4 text-sm text-neon-yellow/90 shadow-[0_0_30px_-10px_rgba(250,204,21,0.4)]">
            <p className="font-semibold">⚠ Live connection unavailable</p>
            <p className="mt-1 opacity-90">{error ?? FALLBACK_BANNER}</p>
          </div>
        )}

        <DeviceSelector
          devices={devices}
          selectedId={selectedId}
          onChange={(id) => setSelectedId(id)}
          loading={loading && devices.length === 0}
          error={
            networkError
              ? null
              : devices.length === 0
              ? "No devices found in database. Run the SafeCargo Supabase migration and seed SC-0001."
              : null
          }
        />

        {selectedDevice && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatBox label="Connection">
              <StatusBadge
                label={online ? "Online" : "Offline"}
                variant={online ? "ONLINE" : "OFFLINE"}
                size="sm"
                pulse={Boolean(online)}
              />
            </StatBox>
            <StatBox label="Status">
              <StatusBadge
                label={selectedDevice.status ?? "NORMAL"}
                variant={selectedDevice.status ?? "NORMAL"}
                size="sm"
              />
            </StatBox>
            <StatBox label="Updated">
              <span className="font-mono text-sm text-slate-200">
                {selectedDevice.lastSeenAt
                  ? relTime(selectedDevice.lastSeenAt, nowMs)
                  : "Never"}
              </span>
            </StatBox>
          </div>
        )}

        {lastFetched && !networkError && (
          <p className="mt-4 text-right font-mono text-[11px] text-slate-500">
            fetched {relTime(lastFetched, nowMs)} ·{" "}
            {new Date(lastFetched).toLocaleTimeString()}
          </p>
        )}
      </div>

      {error && !networkError && (
        <div className="rounded-2xl border border-neon-red/40 bg-neon-red/5 p-4 text-sm text-neon-red/90">
          {error}
        </div>
      )}

      <HiddenBridge report={report} events={events} />
    </div>
  );
}

function HiddenBridge({
  report,
  events,
}: {
  report: SafeCargoReport | null;
  events: SafeCargoEvent[];
}) {
  return (
    <div
      data-live-has-report={report ? "1" : "0"}
      data-live-event-count={String(events.length)}
      className="hidden"
      aria-hidden
    />
  );
}
