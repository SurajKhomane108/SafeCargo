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
  "Live connection unavailable. Check network or Supabase credentials.";

function mapDeviceSummary(raw: {
  id: string;
  name?: string | null;
  status?: SafeCargoReport["status"] | null;
  lastSeenAt?: string | null;
  createdAt?: string | null;
  resetPending?: boolean | null;
}): DeviceSummary {
  return {
    id: raw.id,
    name: raw.name ?? "",
    status: (raw.status as DeviceSummary["status"]) ?? "NORMAL",
    lastSeenAt: raw.lastSeenAt ?? null,
    createdAt: raw.createdAt ?? null,
    resetPending: Boolean(raw.resetPending),
  };
}

function mapEvent(raw: unknown): SafeCargoEvent {
  const r = raw as {
    id?: string;
    event_id?: number | null;
    event_type: SafeCargoEvent["type"];
    severity: SafeCargoEvent["severity"];
    measurement?: number | null;
    details?: unknown;
    created_at: string;
  };
  return {
    id: r.id,
    eventId: r.event_id ?? undefined,
    type: r.event_type,
    severity: r.severity,
    measurement:
      typeof r.measurement === "number" ? r.measurement : undefined,
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
    <div className="rounded-none border border-slate-200 bg-slate-50 p-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function LiveMonitor({
  initialDeviceId,
  onReportLoaded,
}: LiveMonitorProps) {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [initialDevicesLoaded, setInitialDevicesLoaded] = useState(false);
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

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  const selectedDevice =
    devices.find((d) => d.id === selectedId) ?? null;

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 10_000);
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
    } finally {
      setDevicesLoading(false);
      setInitialDevicesLoaded(true);
    }
  }, []);

  const loadDeviceData = useCallback(
    async (deviceId: string, opts?: { silent?: boolean }) => {
      if (!deviceId) return;
      if (!opts?.silent) {
        setLoading(true);
      }
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
          if (!opts?.silent) setLoading(false);
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
        if (!opts?.silent) {
          console.error("[SafeCargo] loadDeviceData failed:", e);
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load live data. Please try again."
          );
        }
      } finally {
        if (!opts?.silent) {
          setLoading(false);
        }
      }
    },
    [onReportLoaded]
  );

  const handleRequestReset = useCallback(async () => {
    if (!selectedId) return;
    setResetLoading(true);
    setResetFeedback(null);
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(selectedId)}/reset-request`,
        { method: "POST" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to request device reset.");
      }
      setResetFeedback(
        "Remote reset queued! Device will wipe EEPROM & local memory on next poll (within 30s)."
      );
      setShowResetConfirm(false);
      await loadDevices();
      await loadDeviceData(selectedId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reset request failed.");
    } finally {
      setResetLoading(false);
    }
  }, [selectedId, loadDevices, loadDeviceData]);

  // Initial load
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // When selected device changes, load immediately
  useEffect(() => {
    if (!selectedId) return;
    loadDeviceData(selectedId);
  }, [selectedId, loadDeviceData]);

  // Auto-polling: Check for new telemetry & events every 4 seconds without hard refreshing!
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => {
      loadDeviceData(selectedId, { silent: true });
    }, 4000);

    // Refresh immediately when tab gains focus
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        loadDeviceData(selectedId, { silent: true });
        loadDevices();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [selectedId, loadDeviceData, loadDevices]);

  const online = selectedDevice
    ? selectedDevice.lastSeenAt
      ? nowMs - new Date(selectedDevice.lastSeenAt).getTime() < 5 * 60 * 1000
      : false
    : null;

  return (
    <div className="space-y-4">
      <div className="rounded-none border border-slate-300 bg-white p-4 sm:p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-mono text-base font-bold uppercase tracking-tight text-slate-900 sm:text-lg">
              Live Fleet Monitoring
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Continuous WiFi telemetry from active cargo units. Auto-refreshes every 4s.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedDevice && (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                disabled={Boolean(selectedDevice.resetPending) || loading || resetLoading}
                className="rounded-none border border-rose-300 bg-rose-50 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
              >
                {selectedDevice.resetPending ? "Reset Queued" : "Remote Wipe"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                loadDevices();
                if (selectedId) loadDeviceData(selectedId);
              }}
              disabled={loading}
              className="rounded-none border border-slate-900 bg-slate-900 px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Syncing…" : "Refresh"}
            </button>
          </div>
        </div>

        {resetFeedback && (
          <div className="mb-3.5 border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center justify-between font-mono">
            <span>{resetFeedback}</span>
            <button
              type="button"
              onClick={() => setResetFeedback(null)}
              className="text-slate-500 hover:text-slate-800 ml-2 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {selectedDevice?.resetPending && (
          <div className="mb-3.5 border border-amber-400 bg-amber-50 p-3.5 text-amber-900 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 bg-amber-600 rounded-none animate-pulse" />
              <p className="font-bold uppercase tracking-wider">
                Remote Reset Queued (Awaiting Next Device Poll)
              </p>
            </div>
            <p className="mt-1 text-slate-700">
              Wipe command sent for <strong>{selectedDevice.id}</strong>. On its next 30-second poll, the device will clear EEPROM, erase NFC memory, reset boot count to #1, and purge database logs.
            </p>
          </div>
        )}

        {networkError && (
          <div className="mb-4 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 font-mono">
            <p className="font-bold uppercase tracking-wider">Connection Notice</p>
            <p className="mt-0.5">{error ?? FALLBACK_BANNER}</p>
          </div>
        )}

        {/* Device selector - cleanly shows loading and NO temporary empty error */}
        <DeviceSelector
          devices={devices}
          selectedId={selectedId}
          onChange={(id) => setSelectedId(id)}
          loading={devicesLoading}
          error={
            networkError
              ? null
              : initialDevicesLoaded && !devicesLoading && devices.length === 0
              ? "No devices found in database. Run the Supabase migration and seed SC-0001."
              : null
          }
        />

        {selectedDevice && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatBox label="Link State">
              <StatusBadge
                label={online ? "ONLINE" : "OFFLINE"}
                variant={online ? "ONLINE" : "OFFLINE"}
                size="sm"
                pulse={Boolean(online)}
              />
            </StatBox>
            <StatBox label="Unit Status">
              <StatusBadge
                label={selectedDevice.status ?? "NORMAL"}
                variant={selectedDevice.status ?? "NORMAL"}
                size="sm"
              />
            </StatBox>
            <StatBox label="Last Heard">
              <span className="font-mono text-xs font-semibold text-slate-800 truncate block">
                {selectedDevice.lastSeenAt
                  ? relTime(selectedDevice.lastSeenAt, nowMs)
                  : "Never"}
              </span>
            </StatBox>
          </div>
        )}

        {lastFetched && !networkError && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 font-mono text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="h-1.5 w-1.5 bg-emerald-600 rounded-none animate-pulse" />
              Live auto-sync active (4s)
            </span>
            <span>
              Updated {relTime(lastFetched, nowMs)}
            </span>
          </div>
        )}
      </div>

      {error && !networkError && (
        <div className="border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 font-mono">
          {error}
        </div>
      )}

      {/* Confirmation Modal */}
      {showResetConfirm && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md border-2 border-slate-900 bg-white p-5 shadow-lg">
            <div className="mb-3 border-b border-slate-200 pb-2">
              <h4 className="font-mono text-base font-bold uppercase tracking-wider text-rose-700">
                Confirm Remote Device Reset
              </h4>
            </div>

            <p className="text-sm text-slate-700">
              Are you sure you want to trigger a remote wipe for unit{" "}
              <strong className="font-mono text-slate-900">{selectedDevice.id}</strong>?
            </p>

            <div className="my-3.5 border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-900">Device will execute on next poll (30s):</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Wipe all stored events and local EEPROM records</li>
                <li>Erase current ST25DV NFC tag memory</li>
                <li>Reset boot count and restart event IDs at #1</li>
                <li>Delete historical events in Supabase</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetLoading}
                className="border border-slate-300 bg-white px-3.5 py-2 font-mono text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestReset}
                disabled={resetLoading}
                className="border border-rose-700 bg-rose-600 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {resetLoading ? "Queueing Wipe…" : "Confirm Remote Reset"}
              </button>
            </div>
          </div>
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
