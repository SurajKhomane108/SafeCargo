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
      ? "bg-amber-500 animate-pulse"
      : state === "read_success" || state === "demo_success"
      ? "bg-emerald-600"
      : state === "error"
      ? "bg-rose-600"
      : "bg-slate-400";

  return (
    <div className="rounded-none border border-slate-300 bg-white p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h3 className="font-mono text-base font-bold uppercase tracking-tight text-slate-900 sm:text-lg">
            NFC Scanner
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Hold your mobile device against the SafeCargo ST25DV NFC tag.
          </p>
        </div>
        <StatusBadge
          label={
            state === "demo_success"
              ? "DEMO"
              : state === "read_success"
              ? "READ COMPLETE"
              : isScanning
              ? "SEARCHING"
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

      {/* Scan CTA - Mobile Touch Target */}
      <button
        type="button"
        onClick={scanNFC}
        disabled={isScanning}
        className={`w-full rounded-none border border-slate-900 bg-slate-900 px-5 py-4 text-center font-mono text-sm font-bold uppercase tracking-widest text-white transition hover:bg-slate-800 active:bg-black disabled:cursor-not-allowed disabled:bg-slate-300 disabled:border-slate-300 disabled:text-slate-500`}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M8 3a9 9 0 000 18M16 3a9 9 0 010 18M11 6.5a5.5 5.5 0 000 11M13 6.5a5.5 5.5 0 010 11"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="square"
            />
          </svg>
          {isScanning ? "Waiting for NFC Tag…" : "Scan NFC Cargo Tag"}
        </span>
      </button>

      {/* Mobile-Friendly Steps */}
      <div className="mt-4 grid grid-cols-2 gap-2 border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600 sm:grid-cols-4">
        {[
          ["1", "Turn on NFC"],
          ["2", "Tap scan button"],
          ["3", "Tap tag to phone"],
          ["4", "View report"],
        ].map(([n, s]) => (
          <div key={n} className="flex items-center gap-1.5 font-mono">
            <span className="flex h-4 w-4 flex-none items-center justify-center bg-slate-200 text-[10px] font-bold text-slate-700">
              {n}
            </span>
            <span className="text-[11px] leading-tight text-slate-700">{s}</span>
          </div>
        ))}
      </div>

      {/* Status line */}
      <div className="mt-3.5 border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2.5">
          <div className={`h-2.5 w-2.5 flex-none rounded-none ${statusDotColor}`} />
          <p className="font-mono text-xs text-slate-700">{status}</p>
        </div>
      </div>

      {/* Error Message */}
      {errorCode && (
        <div className="mt-3.5 border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
          <p className="font-mono font-bold uppercase tracking-wider text-[11px]">
            Scan Notice · {errorCode}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed">
            {NFC_ERROR_MESSAGES[errorCode]}
          </p>
        </div>
      )}

      {/* Demo verified card */}
      {demo && state === "demo_success" && (
        <div className="mt-5 border border-purple-300 bg-purple-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-purple-700">
                Diagnostic Tag Verified
              </p>
              <h4 className="font-mono text-base font-bold text-slate-900">
                Demo ST25DV Tag Detected
              </h4>
            </div>
            <StatusBadge label="DEMO" variant="DEMO" size="sm" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <InfoBox label="NFC Serial Number" value={demo.serialNumber} />
            <InfoBox label="Records Read" value={String(demo.records.length)} />
          </div>

          <div className="mt-3 border border-slate-200 bg-white p-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Payload String
            </p>
            <p className="mt-1 font-mono text-xs text-purple-900 break-all">
              {demo.rawMessage}
            </p>
          </div>
        </div>
      )}

      {/* NFC Report Success Banner */}
      {report && state === "read_success" && (
        <div className="mt-5 border border-emerald-300 bg-emerald-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                Direct NFC Verification
              </p>
              <h4 className="font-mono text-base font-bold text-slate-900">
                Cargo Tag Verified: {report.deviceId}
              </h4>
            </div>
            <StatusBadge label="VERIFIED" variant="NORMAL" size="sm" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <InfoBox label="Tag UID" value={serialNumber || "—"} />
            <InfoBox label="Payload Records" value={String(records.length)} />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white p-2.5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}
