"use client";

import { useRef, useState } from "react";

type NFCRecord = {
  recordType: string;
  mediaType?: string;
  data: string;
};

type NFCResult = {
  serialNumber: string;
  records: NFCRecord[];
};

export default function Home() {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState(
    "Ready to scan an NFC SafeCargo tag."
  );
  const [result, setResult] = useState<NFCResult | null>(null);
  const [error, setError] = useState("");

  const readerRef = useRef<any>(null);

  async function scanNFC() {
    setError("");
    setResult(null);

    if (!("NDEFReader" in window)) {
      setError(
        "Web NFC is not available in this browser. Use Chrome on your Android phone with NFC enabled."
      );
      setStatus("NFC unavailable");
      return;
    }

    try {
      setScanning(true);
      setStatus("Starting NFC scanner...");

      const NDEFReaderClass = (window as any).NDEFReader;
      const ndef = new NDEFReaderClass();

      readerRef.current = ndef;

      ndef.addEventListener("readingerror", () => {
        setError(
          "The NFC tag could not be read. Hold the phone directly over the ST25DV tag and try again."
        );
        setStatus("NFC read failed");
        setScanning(false);
      });

      ndef.addEventListener(
        "reading",
        async (event: any) => {
          try {
            setStatus("NFC tag detected. Reading data...");

            const records: NFCRecord[] = [];

            for (const record of event.message.records) {
              const data = await decodeNDEFRecord(record);

              records.push({
                recordType: record.recordType,
                mediaType: record.mediaType || "",
                data,
              });
            }

            setResult({
              serialNumber: event.serialNumber || "Not provided",
              records,
            });

            setStatus("NFC report successfully read.");
            setScanning(false);
          } catch (err) {
            console.error(err);

            setError("The NFC data was detected but could not be decoded.");
            setStatus("NFC decoding failed");
            setScanning(false);
          }
        },
        { once: true }
      );

      await ndef.scan();

      setStatus(
        "Scanner active. Hold your phone close to the SafeCargo NFC tag."
      );
    } catch (err: any) {
      console.error(err);

      setScanning(false);

      if (err?.name === "NotAllowedError") {
        setError(
          "NFC permission was denied. Allow NFC access and try again."
        );
      } else if (err?.name === "NotSupportedError") {
        setError(
          "This browser or device does not support Web NFC."
        );
      } else if (err?.name === "InvalidStateError") {
        setError(
          "An NFC scan is already running. Try again after the current scan finishes."
        );
      } else {
        setError(
          err?.message ||
            "Unable to start NFC scanning. Make sure NFC is enabled."
        );
      }

      setStatus("Unable to start NFC scanner");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 sm:px-8">

        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500 font-bold text-slate-950">
                SC
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  SafeCargo
                </h1>

                <p className="text-xs text-slate-400">
                  Intelligent Cargo Monitoring
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
            Offline NFC Mode
          </div>
        </header>

        {/* Main */}
        <section className="flex flex-1 flex-col">

          <div className="mb-8 max-w-2xl">
            <p className="mb-3 text-sm font-medium text-cyan-400">
              CARGO SECURITY REPORT
            </p>

            <h2 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Verify your cargo
              <br />
              with one tap.
            </h2>

            <p className="mt-5 text-base leading-7 text-slate-400">
              Read the locally stored SafeCargo monitoring report directly
              from the NFC tag attached to your shipment.
            </p>
          </div>

          {/* Scanner Card */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl sm:p-8">

            <div className="mb-6">
              <h3 className="text-xl font-semibold">
                NFC Report Scanner
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                Enable NFC on your phone and hold it close to the
                SafeCargo ST25DV tag.
              </p>
            </div>

            <button
              onClick={scanNFC}
              disabled={scanning}
              className="w-full rounded-2xl bg-cyan-500 px-6 py-4 text-base font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {scanning ? "Scanning NFC..." : "Scan NFC Report"}
            </button>

            {/* Status */}
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full ${
                    scanning
                      ? "animate-pulse bg-yellow-400"
                      : result
                      ? "bg-green-400"
                      : error
                      ? "bg-red-400"
                      : "bg-slate-500"
                  }`}
                />

                <p className="text-sm text-slate-300">
                  {status}
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-5 rounded-xl border border-red-900 bg-red-950/40 p-4">
                <p className="text-sm leading-6 text-red-300">
                  {error}
                </p>
              </div>
            )}

          </div>

          {/* Result */}
          {result && (
            <div className="mt-8 space-y-5">

              <div className="rounded-3xl border border-green-900 bg-green-950/30 p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-green-400">
                      Verification
                    </p>

                    <h3 className="mt-1 text-2xl font-bold">
                      NFC Report Verified
                    </h3>
                  </div>

                  <div className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                    SUCCESS
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">

                  <InfoBox
                    label="NFC Serial Number"
                    value={result.serialNumber}
                  />

                  <InfoBox
                    label="Records Detected"
                    value={String(result.records.length)}
                  />

                </div>
              </div>

              {/* Records */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                <h3 className="mb-5 text-lg font-semibold">
                  NFC Data
                </h3>

                <div className="space-y-4">
                  {result.records.map((record, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                    >
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                          Record {index + 1}
                        </span>

                        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-400">
                          {record.recordType}
                        </span>

                        {record.mediaType && (
                          <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs text-purple-400">
                            {record.mediaType}
                          </span>
                        )}
                      </div>

                      <pre className="whitespace-pre-wrap break-words rounded-xl bg-black p-4 font-mono text-sm leading-6 text-slate-300">
                        {record.data}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>

              {/* Future report */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                <h3 className="mb-2 text-lg font-semibold">
                  SafeCargo Report
                </h3>

                <p className="mb-5 text-sm text-slate-400">
                  This section will display the complete cargo monitoring
                  report once the final SafeCargo data format is connected.
                </p>

                <div className="grid gap-4 sm:grid-cols-3">
                  <ReportPlaceholder
                    title="Cargo Status"
                    value="NFC VERIFIED"
                  />

                  <ReportPlaceholder
                    title="Motion Events"
                    value="Pending"
                  />

                  <ReportPlaceholder
                    title="Light Events"
                    value="Pending"
                  />
                </div>
              </div>

            </div>
          )}

        </section>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          SafeCargo • Secure Offline Cargo Verification
        </footer>

      </div>
    </main>
  );
}


/* ---------------------------------------------------------
   NDEF DECODER
--------------------------------------------------------- */

async function decodeNDEFRecord(record: any): Promise<string> {
  try {
    if (record.recordType === "text") {
      const decoder = new TextDecoder(record.encoding || "utf-8");

      const bytes = new Uint8Array(record.data);

      if (bytes.length === 0) {
        return "";
      }

      const languageCodeLength = bytes[0] & 0x3f;

      return decoder.decode(
        bytes.slice(languageCodeLength + 1)
      );
    }

    if (record.recordType === "url") {
      const decoder = new TextDecoder();

      return decoder.decode(record.data);
    }

    if (record.recordType === "mime") {
      const decoder = new TextDecoder();

      return decoder.decode(record.data);
    }

    if (record.recordType === "absolute-url") {
      const decoder = new TextDecoder();

      return decoder.decode(record.data);
    }

    if (record.recordType === "empty") {
      return "[Empty NDEF record]";
    }

    const decoder = new TextDecoder();

    return decoder.decode(record.data);
  } catch {
    return "[Unable to decode record]";
  }
}


/* ---------------------------------------------------------
   UI COMPONENTS
--------------------------------------------------------- */

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-all font-mono text-sm text-slate-200">
        {value}
      </p>
    </div>
  );
}


function ReportPlaceholder({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs text-slate-500">
        {title}
      </p>

      <p className="mt-2 font-semibold text-slate-200">
        {value}
      </p>
    </div>
  );
}