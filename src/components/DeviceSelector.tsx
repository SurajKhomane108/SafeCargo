"use client";

import { useId, useMemo } from "react";
import type { DeviceSummary } from "@/lib/types";

export function DeviceSelector({
  devices,
  selectedId,
  onChange,
  loading,
  error,
}: {
  devices: DeviceSummary[];
  selectedId: string | null;
  onChange: (id: string) => void;
  loading?: boolean;
  error?: string | null;
}) {
  const hasList = devices.length > 0;
  const selectorId = useId();

  const sorted = useMemo(
    () =>
      [...devices].sort((a, b) => {
        const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
        const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
        if (bt !== at) return bt - at;
        return a.id.localeCompare(b.id);
      }),
    [devices]
  );

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={selectorId}
        className="block font-mono text-[11px] font-bold uppercase tracking-wider text-slate-600"
      >
        Select Monitored Device
      </label>

      {error && !loading && (
        <div className="border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 font-mono">
          {error}
        </div>
      )}

      <div className="relative">
        <select
          id={selectorId}
          value={selectedId ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading || !hasList}
          className="w-full appearance-none rounded-none border border-slate-300 bg-white px-3.5 py-3 pr-10 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-800 focus:ring-1 focus:ring-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          {loading && <option>Connecting to device fleet…</option>}
          {!loading && !hasList && <option>No active devices found</option>}
          {sorted.map((d) => (
            <option key={d.id} value={d.id}>
              {d.id}
              {d.name ? ` — ${d.name}` : ""}
              {d.lastSeenAt
                ? ` (seen ${new Date(d.lastSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
                : " (offline)"}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
