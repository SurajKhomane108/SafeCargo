"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NFCScanner } from "@/components/NFCScanner";
import type {
  DemoVerification,
  NFCScannerResult,
} from "@/components/NFCScanner";
import { LiveMonitor } from "@/components/LiveMonitor";
import { CargoReport } from "@/components/CargoReport";
import { EventHistory } from "@/components/EventHistory";
import { StatusBadge } from "@/components/StatusBadge";
import type {
  SafeCargoEvent,
  SafeCargoReport,
  SafeCargoReportSource,
} from "@/lib/types";

type Mode = "NFC" | "LIVE";

const LIVE_UNAVAILABLE =
  "Live telemetry is currently unconfigured. NFC offline verification is fully available.";

const LIVE_UNAVAILABLE_STATIC: boolean = !(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function readInitialFromUrl(): { mode: Mode; device: string | null } {
  if (typeof window === "undefined") return { mode: "NFC", device: null };
  try {
    const url = new URL(window.location.href);
    const device = url.searchParams.get("device");
    const m = url.searchParams.get("mode");
    const mode: Mode = m === "live" ? "LIVE" : "NFC";
    return { mode, device };
  } catch {
    return { mode: "NFC", device: null };
  }
}

export default function Home() {
  const [mode, setMode] = useState<Mode>(() => readInitialFromUrl().mode);
  const initialDeviceId: string | null = readInitialFromUrl().device;
  const [hydratedTick, setHydratedTick] = useState(0);
  const [nowMs, setNowMs] = useState<number>(0);

  // NFC state
  const [nfcDemo, setNfcDemo] = useState<DemoVerification | null>(null);
  const [nfcReport, setNfcReport] = useState<SafeCargoReport | null>(null);

  // Live state
  const [liveReport, setLiveReport] = useState<SafeCargoReport | null>(null);
  const [liveEvents, setLiveEvents] = useState<SafeCargoEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    const bump = () => {
      if (cancelled) return;
      setNowMs(Date.now());
    };
    const id = setInterval(bump, 15_000);
    Promise.resolve()
      .then(bump)
      .then(() => {
        if (!cancelled) setHydratedTick((t) => t + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const activeSource: SafeCargoReportSource | "IDLE" = useMemo(() => {
    if (mode === "NFC") {
      if (nfcReport) return "NFC";
      if (nfcDemo) return "DEMO";
      return "IDLE";
    }
    if (liveReport) return "LIVE";
    return "IDLE";
  }, [mode, nfcReport, nfcDemo, liveReport]);

  const lastSeenAt: string | null = useMemo(() => {
    if (mode === "NFC") {
      if (nfcReport) return nfcReport.latestTimestamp;
      if (nfcDemo) return nfcDemo.verifiedAt;
      return null;
    }
    return liveReport ? liveReport.latestTimestamp : null;
  }, [mode, nfcReport, nfcDemo, liveReport]);

  const online: boolean | null = useMemo(() => {
    if (mode !== "LIVE" || !liveReport?.latestTimestamp) return null;
    const t = new Date(liveReport.latestTimestamp).getTime();
    if (!t) return false;
    return nowMs - t < 5 * 60 * 1000;
  }, [mode, liveReport, nowMs]);

  const handleNfcReport = useCallback((res: NFCScannerResult) => {
    setLiveReport(null);
    setLiveEvents([]);
    setNfcDemo(null);
    setNfcReport(res.report);
  }, []);

  const handleNfcDemo = useCallback((res: DemoVerification) => {
    setLiveReport(null);
    setLiveEvents([]);
    setNfcReport(null);
    setNfcDemo(res);
  }, []);

  const handleLiveReportLoaded = useCallback(
    (r: SafeCargoReport, evs: SafeCargoEvent[]) => {
      setLiveReport(r);
      setLiveEvents(evs);
    },
    []
  );

  const displayReport: SafeCargoReport | null =
    mode === "NFC" ? nfcReport : liveReport;

  // Accurately extract all events from NFC decoded log or live query
  const displayEvents: SafeCargoEvent[] = useMemo(() => {
    if (mode === "NFC") {
      if (nfcReport?.eventsLog && nfcReport.eventsLog.length > 0) {
        return nfcReport.eventsLog;
      }
      return nfcReport?.latestEvent ? [nfcReport.latestEvent] : [];
    }
    return liveEvents;
  }, [mode, nfcReport, liveEvents]);

  const liveUnavailable = hydratedTick > 0 ? LIVE_UNAVAILABLE_STATIC : false;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-3 py-4 sm:px-6 sm:py-8">
        <AppHeader
          source={activeSource}
          online={mode === "LIVE" ? online : null}
          lastSeenAt={lastSeenAt}
        />

        {/* Minimal Hero - Phone-optimized */}
        <section className="mb-5">
          <h2 className="font-mono text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Cargo Integrity Verification
          </h2>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Scan shipment tags via phone NFC sensor or inspect live cloud telemetry.
          </p>
        </section>

        {/* Mode Switcher - Large square phone-friendly tabs */}
        <div className="mb-5 grid grid-cols-2 border border-slate-300 bg-white">
          <button
            type="button"
            onClick={() => setMode("NFC")}
            className={`flex items-center justify-center gap-2 py-3.5 px-3 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider transition rounded-none ${
              mode === "NFC"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M8 3a9 9 0 000 18M16 3a9 9 0 010 18M11 6.5a5.5 5.5 0 000 11M13 6.5a5.5 5.5 0 010 11"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="square"
              />
            </svg>
            NFC Scanner
          </button>

          <button
            type="button"
            onClick={() => setMode("LIVE")}
            className={`flex items-center justify-center gap-2 py-3.5 px-3 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider transition border-l border-slate-300 rounded-none ${
              mode === "LIVE"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 12h3l2.5-5L12 14l2.5-6L20 12"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="square"
              />
              <circle cx="20" cy="20" r="2" fill="currentColor" />
            </svg>
            Live Fleet
          </button>
        </div>

        {/* NFC Mode */}
        {mode === "NFC" && (
          <section className="flex flex-1 flex-col gap-5">
            <NFCScanner
              onReport={handleNfcReport}
              onDemoVerified={handleNfcDemo}
            />

            {nfcDemo && (
              <div className="border border-purple-300 bg-white p-4 sm:p-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-mono text-base font-bold text-slate-900">
                    Diagnostic NFC Tag Read
                  </h3>
                  <StatusBadge label="DEMO TAG" variant="DEMO" size="sm" />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-mono">
                  Tag connection verified. Hardware communication is active.
                </p>
                <pre className="mt-3 overflow-auto bg-slate-50 border border-slate-200 p-3 font-mono text-xs text-slate-700">
{JSON.stringify({
  message: nfcDemo.rawMessage,
  serial: nfcDemo.serialNumber,
  recordCount: nfcDemo.records.length,
  verifiedAt: nfcDemo.verifiedAt,
}, null, 2)}
                </pre>
              </div>
            )}

            {nfcReport && (
              <>
                <CargoReport report={nfcReport} />
                <EventHistory events={displayEvents} />
              </>
            )}
          </section>
        )}

        {/* Live Mode */}
        {mode === "LIVE" && (
          <section className="flex flex-1 flex-col gap-5">
            {liveUnavailable && (
              <div className="border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 font-mono">
                <p className="font-bold">Notice: {LIVE_UNAVAILABLE}</p>
                <p className="mt-1 text-slate-700">
                  Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to stream live devices.
                </p>
              </div>
            )}

            <LiveMonitor
              initialDeviceId={initialDeviceId}
              onReportLoaded={handleLiveReportLoaded}
            />

            {displayReport && (
              <>
                <CargoReport report={displayReport} />
                <EventHistory events={displayEvents} />
              </>
            )}
          </section>
        )}

        {/* Minimal Footer */}
        <footer className="mt-10 border-t border-slate-200 pt-5 pb-6 text-center font-mono text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>SafeCargo Verification Platform</span>
            <span>·</span>
            <span>ST25DV64KC · ESP8266 · Supabase</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
