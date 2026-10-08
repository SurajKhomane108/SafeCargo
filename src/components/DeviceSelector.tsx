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
    <div className="space-y-3">
      <label
        htmlFor={selectorId}
        className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400"
      >
        Device
      </label>

      {error && (
        <div className="rounded-xl border border-neon-red/40 bg-neon-red/5 p-3 text-sm text-neon-red/90">
          {error}
        </div>
      )}

      <div className="relative">
        <select
          id={selectorId}
          value={selectedId ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading || !hasList}
          className="w-full appearance-none rounded-2xl border border-neon-cyan/30 bg-neon-void/80 px-4 py-3.5 pr-11 font-mono text-sm text-white shadow-[0_0_20px_-10px_rgba(34,211,238,0.4)] backdrop-blur-md outline-none transition focus:border-neon-cyan/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <option>Loading devices…</option>}
          {!loading && !hasList && <option>No devices available</option>}
          {sorted.map((d) => (
            <option key={d.id} value={d.id} className="bg-neon-black">
              {d.id}
              {d.name ? ` · ${d.name}` : ""}
              {d.lastSeenAt
                ? ` · last seen ${new Date(d.lastSeenAt).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" })}`
                : " · never"}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-neon-cyan">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7 10l5 5 5-5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
