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
  "Live data is currently unavailable. NFC/offline verification can still be used.";

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
    const mode: Mode = m === "live" ? "LIVE" : m === "nfc" ? "NFC" : "NFC";
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
  const displayEvents: SafeCargoEvent[] = useMemo(() => {
    if (mode === "NFC") {
      return nfcReport?.latestEvent ? [nfcReport.latestEvent] : [];
    }
    return liveEvents;
  }, [mode, nfcReport, liveEvents]);

  const liveUnavailable = hydratedTick > 0 ? LIVE_UNAVAILABLE_STATIC : false;

  return (
    <main className="relative min-h-screen text-white">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 sm:px-8">
        <AppHeader
          source={activeSource}
          online={mode === "LIVE" ? online : null}
          lastSeenAt={lastSeenAt}
        />

        {/* Hero */}
        <section className="mb-8 max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan-bright sm:text-sm">
            CARGO SECURITY REPORT
          </p>
          <h2 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            <span className="neon-text-glow-cyan">Verify your cargo</span>
            <br className="hidden sm:block" />
            <span className="sm:pl-20 neon-text-glow-magenta">
              with one tap.
            </span>
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-400 sm:text-lg">
            Read the locally stored SafeCargo monitoring report directly
            from the NFC tag attached to your shipment, or stream the live
            state from any device in your fleet.
          </p>
        </section>

        {/* Mode switch */}
        <div className="mb-6 flex w-full max-w-md rounded-2xl border border-neon-line bg-neon-void/70 p-1 backdrop-blur-md">
          {(["NFC", "LIVE"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`relative flex-1 rounded-xl px-4 py-3 text-sm font-bold uppercase tracking-[0.22em] transition ${
                  active
                    ? m === "NFC"
                      ? "bg-gradient-to-r from-neon-cyan/30 to-neon-purple/25 text-white shadow-[0_0_24px_-8px_rgba(34,211,238,0.6)] ring-1 ring-neon-cyan/50"
                      : "bg-gradient-to-r from-neon-lime/20 to-neon-green/25 text-white shadow-[0_0_24px_-8px_rgba(34,197,94,0.6)] ring-1 ring-neon-green/50"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {m === "NFC" ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M8 3a9 9 0 000 18M16 3a9 9 0 010 18M11 6.5a5.5 5.5 0 000 11M13 6.5a5.5 5.5 0 010 11"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                    NFC TAP
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 12h3l2.5-5L12 14l2.5-6L20 12"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="20" cy="20" r="2" fill="currentColor" />
                    </svg>
                    LIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* NFC path */}
        {mode === "NFC" && (
          <section className="flex flex-1 flex-col gap-6">
            <NFCScanner
              onReport={handleNfcReport}
              onDemoVerified={handleNfcDemo}
            />

            {nfcDemo && (
              <div className="rounded-3xl neon-border-purple bg-neon-void/40 p-5 sm:p-7">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">
                    This is a demo NFC tag
                  </h3>
                  <StatusBadge label="DEMO" variant="DEMO" size="md" pulse />
                </div>
                <p className="text-sm leading-7 text-slate-300">
                  Your ST25DV → Galaxy S20 FE → Chrome → SafeCargo pipeline is
                  working. Once the firmware writes the structured report
                  payload, the full Cargo Report panel below will render with
                  real sensor data.
                </p>
                <pre className="mt-5 max-h-44 overflow-auto scrollbar-thin whitespace-pre-wrap break-words rounded-2xl border border-neon-line bg-black/60 p-4 font-mono text-xs leading-6 text-neon-purple">
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
                {nfcReport.latestEvent && (
                  <EventHistory events={[nfcReport.latestEvent]} />
                )}
              </>
            )}
          </section>
        )}

        {/* Live path */}
        {mode === "LIVE" && (
          <section className="flex flex-1 flex-col gap-6">
            {liveUnavailable && (
              <div className="rounded-2xl border border-neon-yellow/40 bg-neon-yellow/5 p-4 text-sm text-neon-yellow/90 shadow-[0_0_30px_-10px_rgba(250,204,21,0.4)]">
                <p className="font-semibold">⚠ {LIVE_UNAVAILABLE}</p>
                <p className="mt-1 opacity-90">
                  Configure{" "}
                  <code className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[12px] text-neon-yellow">
                    NEXT_PUBLIC_SUPABASE_URL
                  </code>{" "}
                  and{" "}
                  <code className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[12px] text-neon-yellow">
                    NEXT_PUBLIC_SUPABASE_ANON_KEY
                  </code>{" "}
                  in your environment to enable Live mode.
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

        <footer className="mt-14 border-t border-neon-line/70 pt-6 pb-4 text-center text-xs text-slate-500">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono">
            <span>SafeCargo</span>
            <span className="opacity-40">•</span>
            <span>Secure Offline Cargo Verification</span>
            <span className="opacity-40">•</span>
            <span>ST25DV64KC · ESP8266 · Supabase · Next.js</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
