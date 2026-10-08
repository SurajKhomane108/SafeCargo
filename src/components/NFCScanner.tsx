"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decodeNDEFRecord, type DecodedNDEFRecord } from "@/lib/ndef";
import {
  isDemoPlainText,
  parseNFCReport,
  type ParseNfcReportErrorCode,
} from "@/lib/report";
import type { SafeCargoReport } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

export type NFCState =
  | "idle"
  | "checking"
  | "scanning"
  | "read_success"
  | "demo_success"
  | "error";

export type NFCErrorCode =
  | ParseNfcReportErrorCode
  | "UNSUPPORTED_BROWSER"
  | "PERMISSION_DENIED"
  | "NFC_DISABLED"
  | "TAG_NOT_DETECTED"
  | "READ_FAILURE"
  | "MALFORMED_NDEF"
  | "INVALID_PAYLOAD"
  | "NO_SAFECARGO_RECORD"
  | "UNKNOWN";

export const NFC_ERROR_MESSAGES: Record<NFCErrorCode, string> = {
  UNSUPPORTED_BROWSER:
    "Web NFC is not available in this browser. Please use Chrome on a supported Android device.",
  PERMISSION_DENIED: "NFC permission was denied.",
  NFC_DISABLED:
    "NFC is disabled on your device. Enable NFC in Settings and try again.",
  TAG_NOT_DETECTED:
    "Hold your phone closer to the SafeCargo NFC tag.",
  READ_FAILURE:
    "The NFC tag could not be read. Hold the phone directly over the ST25DV tag and try again.",
  MALFORMED_NDEF:
    "Malformed NDEF data. The NFC tag does not contain a valid SafeCargo report.",
  INVALID_PAYLOAD:
    "This NFC tag does not contain a valid SafeCargo report.",
  UNSUPPORTED_VERSION:
    "This SafeCargo report uses an unsupported data version.",
  INVALID_JSON:
    "The SafeCargo NFC payload is corrupted (invalid JSON).",
  NO_SAFECARGO_RECORD:
    "No SafeCargo report was found on this NFC tag.",
  UNKNOWN: "Unable to start NFC scanning. Make sure NFC is enabled.",
};

export interface DemoVerification {
  kind: "demo";
  serialNumber: string;
  records: DecodedNDEFRecord[];
  rawMessage: string;
  verifiedAt: string;
}

export interface NFCScannerResult {
  kind: "report";
  report: SafeCargoReport;
  serialNumber: string;
  records: DecodedNDEFRecord[];
  textPayloads: string[];
}

export interface NFCScannerProps {
  onReport?: (res: NFCScannerResult) => void;
  onDemoVerified?: (res: DemoVerification) => void;
  onError?: (code: NFCErrorCode, message: string) => void;
}

function nfcErrorCodeFromName(name?: string): NFCErrorCode {
  const n = (name ?? "").toLowerCase();
  if (n.includes("notallowederror")) return "PERMISSION_DENIED";
  if (n.includes("notsupportederror")) return "UNSUPPORTED_BROWSER";
  if (n.includes("invalidstateerror")) return "UNKNOWN";
  if (n.includes("notreadableerror")) return "NFC_DISABLED";
  return "UNKNOWN";
}

function extractTextPayloads(records: DecodedNDEFRecord[]): string[] {
  return records
    .map((r) => r.data)
    .filter((d): d is string => typeof d === "string" && d.trim().length > 0);
}

export function NFCScanner({
  onReport,
  onDemoVerified,
  onError,
}: NFCScannerProps) {
  const readerRef = useRef<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<NFCState>("idle");
  const [status, setStatus] = useState<string>(
    "Ready to scan an NFC SafeCargo tag."
  );
  const [errorCode, setErrorCode] = useState<NFCErrorCode | null>(null);
  const [serialNumber, setSerialNumber] = useState<string>("");
  const [records, setRecords] = useState<DecodedNDEFRecord[]>([]);

  const [demo, setDemo] = useState<DemoVerification | null>(null);
  const [report, setReport] = useState<SafeCargoReport | null>(null);

  const resetState = useCallback(() => {
    setErrorCode(null);
    setDemo(null);
    setReport(null);
    setSerialNumber("");
    setRecords([]);
  }, []);

  const raiseError = useCallback(
    (code: NFCErrorCode) => {
      const msg = NFC_ERROR_MESSAGES[code];
      setErrorCode(code);
      setState("error");
      setStatus(msg);
      onError?.(code, msg);
    },
    [onError]
  );

  const stopScan = useCallback(() => {
    try {
      abortRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    abortRef.current = null;
    try {
      const reader = readerRef.current as { abort?: () => void } | null;
      reader?.abort?.();
    } catch {
      /* ignore */
    }
    readerRef.current = null;
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  const scanNFC = useCallback(async () => {
    setState("checking");
    setStatus("Checking NFC availability…");
    resetState();

    if (typeof window === "undefined" || !("NDEFReader" in window)) {
      raiseError("UNSUPPORTED_BROWSER");
      return;
    }

    const NDEFReaderClass = (window as unknown as { NDEFReader: new () => unknown })
      .NDEFReader;

    try {
      const ndef = new NDEFReaderClass() as {
        scan: (options?: { signal?: AbortSignal }) => Promise<void>;
        addEventListener: (
          type: "reading" | "readingerror",
          handler: (event: unknown) => void,
          opts?: { once?: boolean }
        ) => void;
        removeEventListener: (
          type: "reading" | "readingerror",
          handler: (event: unknown) => void
        ) => void;
        abort?: () => void;
      };
      readerRef.current = ndef;
      const controller = new AbortController();
      abortRef.current = controller;

      let finished = false;
      const finishOnce = () => {
        if (finished) return;
        finished = true;
        stopScan();
      };

      const handleError = () => {
        finishOnce();
        raiseError("READ_FAILURE");
      };

      const handleReading = async (event: unknown) => {
        try {
          finishOnce();
          setState("read_success");
          setStatus("NFC tag detected. Reading data…");

          const ev = event as {
            serialNumber?: string;
            message?: { records?: unknown[] };
          };
          const rawRecords = (ev.message?.records as unknown[]) ?? [];
          const sn = ev.serialNumber?.toString().trim() || "Not provided";
          setSerialNumber(sn);

          const decoded: DecodedNDEFRecord[] = [];
          for (const record of rawRecords) {
            try {
              const r = record as {
                recordType?: string;
                mediaType?: string;
                id?: string;
                encoding?: string;
                data?: unknown;
              };
              decoded.push(
                await decodeNDEFRecord({
                  recordType: String(r.recordType ?? "unknown"),
                  mediaType: r.mediaType || undefined,
                  id: r.id || undefined,
                  encoding: r.encoding || undefined,
                  data: r.data,
                })
              );
            } catch {
              decoded.push({
                recordType: "unknown",
                data: "[Unable to decode record]",
              });
            }
          }
          setRecords(decoded);

          const texts = extractTextPayloads(decoded);
          const demoMatch = texts.find((t) => isDemoPlainText(t));

          if (demoMatch) {
            const demoResult: DemoVerification = {
              kind: "demo",
              serialNumber: sn,
              records: decoded,
              rawMessage: demoMatch,
              verifiedAt: new Date().toISOString(),
            };
            setDemo(demoResult);
            setState("demo_success");
            setStatus("Demo NFC tag successfully verified.");
            onDemoVerified?.(demoResult);
            return;
          }

          let lastErr: NFCErrorCode | null = null;
          for (const text of texts) {
            let trimmed = text.trim();
            if (!trimmed) continue;

            // Extract JSON object if bounded by braces
            const firstBrace = trimmed.indexOf("{");
            const lastBrace = trimmed.lastIndexOf("}");
            if (firstBrace >= 0 && lastBrace > firstBrace) {
              trimmed = trimmed.slice(firstBrace, lastBrace + 1);
            } else if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
              continue;
            }

            const res = parseNFCReport(trimmed, {
              nfcSerialNumber: sn !== "Not provided" ? sn : undefined,
            });
            if (res.ok) {
              setReport(res.report);
              setState("read_success");
              setStatus("NFC report successfully verified.");
              onReport?.({
                kind: "report",
                report: res.report,
                serialNumber: sn,
                records: decoded,
                textPayloads: texts,
              });
              return;
            }
            if (res.code === "UNSUPPORTED_VERSION") {
              lastErr = "UNSUPPORTED_VERSION";
            } else if (res.code === "INVALID_JSON") {
              lastErr = lastErr ?? "MALFORMED_NDEF";
            } else {
              lastErr = lastErr ?? "INVALID_PAYLOAD";
            }
          }

          if (lastErr) {
            raiseError(lastErr);
            return;
          }
          if (texts.length === 0 && decoded.length === 0) {
            raiseError("MALFORMED_NDEF");
            return;
          }
          raiseError("NO_SAFECARGO_RECORD");
        } catch (err) {
          console.error("[SafeCargo] reading handler failed:", err);
          finishOnce();
          raiseError("UNKNOWN");
        }
      };

      ndef.addEventListener("readingerror", handleError);
      ndef.addEventListener("reading", handleReading, { once: true });

      setState("scanning");
      await ndef.scan({ signal: controller.signal });
      setStatus(
        "Scanner active. Hold your phone close to the SafeCargo NFC tag."
      );
    } catch (err: unknown) {
      stopScan();
      const e = err as { name?: string; message?: string } | null;
      const code = nfcErrorCodeFromName(e?.name);
      if (code === "UNKNOWN" && e?.message) {
        const m = e.message.toLowerCase();
        if (m.includes("nfc") && m.includes("disabl")) {
          raiseError("NFC_DISABLED");
          return;
        }
      }
      raiseError(code);
    }
  }, [raiseError, resetState, stopScan, onDemoVerified, onReport]);

  const isScanning = state === "scanning" || state === "checking";
  const statusDotColor =
    state === "scanning" || state === "checking"
      ? "bg-neon-yellow neon-dot-pulse"
      : state === "read_success" || state === "demo_success"
      ? "bg-neon-green"
      : state === "error"
      ? "bg-neon-red"
      : "bg-slate-500";

  return (
    <div className="relative overflow-hidden rounded-3xl neon-panel p-5 sm:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent" />

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-bold text-white sm:text-2xl">
              NFC Report Scanner
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Enable NFC on your phone and hold it close to the SafeCargo
              ST25DV tag.
            </p>
          </div>
          <StatusBadge
            label={
              state === "demo_success"
                ? "DEMO MODE"
                : state === "read_success"
                ? "VERIFIED"
                : isScanning
                ? "SCANNING"
                : state === "error"
                ? "ERROR"
                : "READY"
            }
            variant={
              state === "demo_success"
                ? "DEMO"
                : state === "read_success"
                ? "NFC"
                : isScanning
                ? "MEDIUM"
                : state === "error"
                ? "CRITICAL"
                : "LOW"
            }
            size="sm"
            pulse={isScanning}
          />
        </div>
      </div>

      {/* Scan CTA */}
      <button
        type="button"
        onClick={scanNFC}
        disabled={isScanning}
        className={`neon-btn-cyan relative w-full overflow-hidden rounded-2xl px-6 py-5 text-lg font-extrabold tracking-widest uppercase ${
          isScanning ? "scan-line" : ""
        }`}
      >
        <span className="relative z-10 inline-flex items-center justify-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M8 3a9 9 0 000 18M16 3a9 9 0 010 18M11 6.5a5.5 5.5 0 000 11M13 6.5a5.5 5.5 0 010 11"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
          {isScanning ? "Scanning NFC…" : "Scan NFC Report"}
        </span>
      </button>

      {/* Instructions */}
      <div className="mt-5 grid gap-2 border border-dashed border-neon-line/70 rounded-2xl p-4 text-[13px] text-slate-300 sm:grid-cols-4 sm:gap-3">
        {[
          ["1", "Enable NFC on your phone."],
          ["2", "Tap the button above."],
          ["3", "Hold near the ST25DV tag."],
          ["4", "Wait for verification."],
        ].map(([n, s]) => (
          <div key={n} className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-neon-cyan/50 text-[11px] font-bold text-neon-cyan-bright">
              {n}
            </span>
            <span className="leading-5">{s}</span>
          </div>
        ))}
      </div>

      {/* Status line */}
      <div className="mt-5 rounded-xl border border-neon-line bg-neon-void/70 p-4">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 flex-none rounded-full ${statusDotColor}`} />
          <p className="text-sm leading-6 text-slate-200">{status}</p>
        </div>
      </div>

      {/* Error */}
      {errorCode && (
        <div className="mt-5 rounded-2xl border border-neon-red/40 bg-neon-red/5 p-4 shadow-[0_0_30px_-10px_rgba(239,68,68,0.45)]">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-red/90">
              Error · {errorCode}
            </span>
          </div>
          <p className="text-sm leading-6 text-neon-red-200/90 text-neon-red/90">
            {NFC_ERROR_MESSAGES[errorCode]}
          </p>
        </div>
      )}

      {/* Demo verified card */}
      {demo && state === "demo_success" && (
        <div className="mt-6 rounded-3xl neon-border-purple p-5 sm:p-6 bg-neon-void/40">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-neon-purple">
                Demo Verification
              </p>
              <h4 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl neon-text-glow-magenta">
                Demo NFC Verified
              </h4>
            </div>
            <StatusBadge label="DEMO" variant="DEMO" size="md" pulse />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox label="NFC Serial Number" value={demo.serialNumber} />
            <InfoBox
              label="Records Detected"
              value={String(demo.records.length)}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-neon-line bg-black/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Tag Message
            </p>
            <p className="mt-2 font-mono text-sm text-neon-purple-200 text-neon-purple">
              {demo.rawMessage}
            </p>
          </div>

          <p className="mt-4 text-xs leading-6 text-slate-400">
            This tag contains a demo string. It confirms NFC → ST25DV → Chrome
            → SafeCargo is working. It is{" "}
            <span className="font-semibold text-slate-300">not</span> a real
            cargo monitoring report.
          </p>
        </div>
      )}

      {/* NFC Report inline success + raw records */}
      {report && state === "read_success" && (
        <div className="mt-6 rounded-3xl neon-border-cyan p-5 sm:p-6 bg-neon-void/40">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-neon-cyan-bright">
                NFC Verification
              </p>
              <h4 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl neon-text-glow-cyan">
                NFC Report Verified
              </h4>
            </div>
            <StatusBadge label="NFC VERIFIED" variant="NFC" size="md" pulse />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox label="NFC Serial Number" value={serialNumber || "—"} />
            <InfoBox
              label="NDEF Records"
              value={String(records.length)}
            />
          </div>
        </div>
      )}

      {/* Records inspector (always show after success) */}
      {(demo || report) && records.length > 0 && (
        <div className="mt-6 rounded-3xl border border-neon-line bg-neon-void/50 p-5 sm:p-6">
          <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-300">
            Raw NDEF Records
          </h4>
          <div className="space-y-3">
            {records.map((r, i) => (
              <div
                key={i}
                className="rounded-2xl border border-neon-line bg-black/50 p-4"
              >
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-neon-panel px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                    Record {i + 1}
                  </span>
                  <span className="rounded-full bg-neon-cyan/10 border border-neon-cyan/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neon-cyan-bright">
                    {r.recordType}
                  </span>
                  {r.mediaType && (
                    <span className="rounded-full bg-neon-purple/10 border border-neon-purple/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neon-purple">
                      {r.mediaType}
                    </span>
                  )}
                  {r.lang && (
                    <span className="rounded-full bg-neon-green/10 border border-neon-green/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neon-green">
                      lang {r.lang}
                    </span>
                  )}
                </div>
                <pre className="max-h-56 overflow-auto scrollbar-thin whitespace-pre-wrap break-words rounded-xl border border-neon-line bg-neon-black/80 p-3 font-mono text-xs leading-6 text-slate-200">
                  {r.data}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neon-line bg-neon-black/60 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-all font-mono text-sm text-slate-200">
        {value}
      </p>
    </div>
  );
}
