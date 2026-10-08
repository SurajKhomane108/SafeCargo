import type {
  SafeCargoEvent,
  SafeCargoEventCounts,
  SafeCargoEventSeverity,
  SafeCargoEventType,
  SafeCargoLogState,
  SafeCargoMaxMeasurements,
  SafeCargoReport,
  SafeCargoReportStatus,
} from "./types";
import {
  SAFECARGO_PAYLOAD_VERSION,
  safeCargoNfcPayloadAnyVersionSchema,
  safeCargoNfcPayloadV1Schema,
} from "./validations";

export type ParseNfcReportErrorCode =
  | "INVALID_JSON"
  | "UNSUPPORTED_VERSION"
  | "INVALID_PAYLOAD";

export type ParseNfcReportResult =
  | { ok: true; report: SafeCargoReport }
  | { ok: false; error: string; code: ParseNfcReportErrorCode };

export const DEMO_PLAIN_TEXT =
  "SafeCargo NFC Test - ESP8266 communication successful!";

export function isDemoPlainText(text: string): boolean {
  return text.trim() === DEMO_PLAIN_TEXT;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseNfcLogType(raw: unknown): SafeCargoEventType {
  if (typeof raw === "string") {
    const s = raw.toUpperCase().trim();
    if (s === "S" || s === "SHOCK") return "SHOCK";
    if (s === "T" || s === "TILT") return "TILT";
    if (s === "M" || s === "MOTION") return "MOTION";
    if (s === "L" || s === "LIGHT") return "LIGHT";
  }
  return "SHOCK";
}

function parseNfcLogSeverity(raw: unknown): SafeCargoEventSeverity {
  if (typeof raw === "number") {
    switch (raw) {
      case 0: return "NORMAL";
      case 1: return "LOW";
      case 2: return "MEDIUM";
      case 3: return "WARNING";
      case 4: return "HIGH";
      case 5: return "CRITICAL";
      default: return "MEDIUM";
    }
  }
  if (typeof raw === "string") {
    const s = raw.toUpperCase().trim();
    if (
      s === "NORMAL" ||
      s === "LOW" ||
      s === "MEDIUM" ||
      s === "WARNING" ||
      s === "HIGH" ||
      s === "CRITICAL"
    ) {
      return s as SafeCargoEventSeverity;
    }
  }
  return "MEDIUM";
}

function parseNfcLogState(raw: unknown): SafeCargoLogState {
  if (typeof raw === "string") {
    const s = raw.toUpperCase().trim();
    if (s === "S" || s === "SENT") return "SENT";
    if (s === "D" || s === "DROPPED") return "DROPPED";
    if (s === "P" || s === "PENDING") return "PENDING";
  }
  return "PENDING";
}

export function decodeNfcLog(
  rawLog?: unknown[][] | unknown[] | null,
  rawFmt?: string[] | null
): SafeCargoEvent[] {
  if (!Array.isArray(rawLog) || rawLog.length === 0) return [];

  // Default layout if rawFmt is not provided:
  // ["id","type","sev","epoch","tq","g","tilt","gyro","ldr","st","boot","up"]
  const fmt = Array.isArray(rawFmt) && rawFmt.length > 0 ? rawFmt : null;
  const getIndex = (name: string, fallback: number) => {
    if (!fmt) return fallback;
    const idx = fmt.indexOf(name);
    return idx >= 0 ? idx : fallback;
  };

  const idIdx = getIndex("id", 0);
  const typeIdx = getIndex("type", 1);
  const sevIdx = getIndex("sev", 2);
  const epochIdx = getIndex("epoch", 3);
  const tqIdx = getIndex("tq", 4);
  const gIdx = getIndex("g", 5);
  const tiltIdx = getIndex("tilt", 6);
  const gyroIdx = getIndex("gyro", 7);
  const ldrIdx = getIndex("ldr", 8);
  const stIdx = getIndex("st", 9);
  const bootIdx = getIndex("boot", 10);
  const upIdx = getIndex("up", 11);

  const events: SafeCargoEvent[] = [];

  for (const item of rawLog) {
    if (!Array.isArray(item) || item.length === 0) continue;
    const entry = item as unknown[];

    const rawId = entry[idIdx];
    const eventId =
      typeof rawId === "number" ? rawId : parseInt(String(rawId), 10);
    if (!Number.isFinite(eventId) || eventId === 0) continue;

    const type = parseNfcLogType(entry[typeIdx]);
    const severity = parseNfcLogSeverity(entry[sevIdx]);
    const logState = parseNfcLogState(entry[stIdx]);

    const rawEpoch = Number(entry[epochIdx]);
    const rawTq = Number(entry[tqIdx]);
    const hasValidEpoch = Number.isFinite(rawEpoch) && rawEpoch > 1500000000;

    const timestamp = hasValidEpoch
      ? new Date(rawEpoch * 1000).toISOString()
      : "UNSYNCED";
    const timeValid = hasValidEpoch && rawTq > 0;
    const timeEstimated = rawTq === 2;

    const accelerationG =
      typeof entry[gIdx] === "number" ? (entry[gIdx] as number) : undefined;
    const tiltDeg =
      typeof entry[tiltIdx] === "number" ? (entry[tiltIdx] as number) : undefined;
    const gyroDps =
      typeof entry[gyroIdx] === "number" ? (entry[gyroIdx] as number) : undefined;
    const ldrValue =
      typeof entry[ldrIdx] === "number"
        ? Math.round(entry[ldrIdx] as number)
        : undefined;

    const boot =
      typeof entry[bootIdx] === "number" ? (entry[bootIdx] as number) : undefined;
    const uptimeSec =
      typeof entry[upIdx] === "number" ? (entry[upIdx] as number) : undefined;

    let measurement: number | undefined;
    if (type === "SHOCK") measurement = accelerationG;
    else if (type === "TILT") measurement = tiltDeg;
    else if (type === "MOTION") measurement = gyroDps;
    else if (type === "LIGHT") measurement = ldrValue;

    events.push({
      id: `nfc-${eventId}`,
      eventId,
      type,
      severity,
      timestamp,
      timeValid,
      timeEstimated,
      measurement,
      accelerationG,
      tiltDeg,
      gyroDps,
      ldrValue,
      logState,
      boot,
      uptimeSec,
      details: {
        logState,
        timeQuality:
          rawTq === 1 ? "exact" : rawTq === 2 ? "estimated" : "unsynced",
        bootCount: boot,
        uptimeSec,
        accelerationG,
        tiltDeg,
        gyroDps,
        ldrValue,
      },
    });
  }

  return events;
}

export function parseNFCReport(
  rawJson: string,
  opts?: {
    nfcSerialNumber?: string;
    tagType?: string;
    verifiedAt?: string;
    deviceName?: string;
  }
): ParseNfcReportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      ok: false,
      code: "INVALID_JSON",
      error: "The NFC payload is not valid JSON.",
    };
  }

  const anyVersion = safeCargoNfcPayloadAnyVersionSchema.safeParse(parsed);
  if (!anyVersion.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      error:
        "This NFC tag does not contain a valid SafeCargo report.",
    };
  }

  if (anyVersion.data.v !== SAFECARGO_PAYLOAD_VERSION) {
    return {
      ok: false,
      code: "UNSUPPORTED_VERSION",
      error:
        "This SafeCargo report uses an unsupported data version.",
    };
  }

  const v1 = safeCargoNfcPayloadV1Schema.safeParse(parsed);
  if (!v1.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      error:
        "This NFC tag does not contain a valid SafeCargo report.",
    };
  }

  const p = v1.data;

  const eventCounts: SafeCargoEventCounts = {
    SHOCK: p.events.shock,
    TILT: p.events.tilt,
    MOTION: p.events.motion,
    LIGHT: p.events.light,
  };

  const max: SafeCargoMaxMeasurements = {
    g: p.max.g ?? null,
    tilt: p.max.tilt ?? null,
    gyro: p.max.gyro ?? null,
  };

  const timeValid = p.timeValid ?? true;

  const eventsLog = decodeNfcLog(
    p.log as unknown[][] | undefined,
    p.logFmt ?? undefined
  );

  const last = p.last;
  let latestEvent: SafeCargoEvent | null =
    last &&
    last.id !== 0 &&
    last.type !== "NONE" &&
    last.severity !== "NORMAL"
      ? {
          id: last.id !== undefined && last.id !== null ? String(last.id) : undefined,
          eventId: last.id ?? undefined,
          type: last.type,
          severity: last.severity,
          timestamp: last.time,
          timeValid,
          measurement: last.measurement ?? undefined,
          durationMs: last.durationMs ?? undefined,
          details: last.details ?? undefined,
        }
      : null;

  if (!latestEvent && eventsLog.length > 0) {
    latestEvent = eventsLog[0];
  }

  const latestTimestamp = timeValid
    ? (p.time ?? p.ts ?? latestEvent?.timestamp ?? null)
    : null;

  const report: SafeCargoReport = {
    version: SAFECARGO_PAYLOAD_VERSION,
    deviceId: p.device,
    deviceName: opts?.deviceName,
    status: p.status,
    eventCounts,
    max,
    latestEvent,
    latestTimestamp,
    timeValid,
    pending: p.pending ?? undefined,
    sent: p.sent ?? undefined,
    dropped: p.dropped ?? undefined,
    evicted: p.evicted ?? undefined,
    eventsLog: eventsLog.length > 0 ? eventsLog : undefined,
    sensorInfo: p.sensor
      ? {
          accelerometer: p.sensor.accel ?? undefined,
          gyroscope: p.sensor.gyro ?? undefined,
          nfcChip: p.sensor.nfc ?? undefined,
          firmwareVersion: p.sensor.fw ?? undefined,
          espModel: p.sensor.esp ?? undefined,
        }
      : undefined,
    source: "NFC",
    verification: {
      method: "NFC",
      nfcSerialNumber: opts?.nfcSerialNumber,
      tagType: opts?.tagType ?? "ST25DV64KC",
      verifiedAt: opts?.verifiedAt ?? nowIso(),
    },
  };

  return { ok: true, report };
}

export interface LiveDeviceRow {
  id: string;
  name?: string | null;
  current_status?: SafeCargoReportStatus | null;
  current_max_g?: number | null;
  current_max_tilt?: number | null;
  current_max_gyro?: number | null;
  last_seen_at?: string | null;
  current_report_jsonb?: unknown;
  reset_pending?: boolean | null;
}

export interface LiveEventRow {
  id?: string;
  event_id?: number | null;
  event_type: SafeCargoEvent["type"];
  severity: SafeCargoEvent["severity"];
  measurement?: number | null;
  acceleration_g?: number | null;
  tilt_deg?: number | null;
  gyro_dps?: number | null;
  ldr_value?: number | null;
  time_valid?: boolean | null;
  duration_ms?: number | null;
  details?: unknown;
  created_at: string;
}

export function parseLiveReport(
  deviceRow: LiveDeviceRow,
  events: LiveEventRow[] = [],
  opts?: { verifiedAt?: string }
): SafeCargoReport {
  const sorted = [...events].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  );

  const eventCounts: SafeCargoEventCounts = {
    SHOCK: 0,
    TILT: 0,
    MOTION: 0,
    LIGHT: 0,
  };

  let maxG: number | null = deviceRow.current_max_g ?? null;
  let maxTilt: number | null = deviceRow.current_max_tilt ?? null;
  let maxGyro: number | null = deviceRow.current_max_gyro ?? null;
  let pending: number | undefined = undefined;

  for (const e of events) {
    if (e.event_type !== "NONE") {
      eventCounts[e.event_type] = (eventCounts[e.event_type] ?? 0) + 1;
    }
    if (typeof e.measurement === "number") {
      switch (e.event_type) {
        case "SHOCK":
          if (maxG === null || e.measurement > maxG) maxG = e.measurement;
          break;
        case "TILT":
          if (maxTilt === null || e.measurement > maxTilt)
            maxTilt = e.measurement;
          break;
        case "MOTION":
          if (maxGyro === null || e.measurement > maxGyro)
            maxGyro = e.measurement;
          break;
      }
    }
  }

  const latestRaw = sorted[0];
  const latestEvent: SafeCargoEvent | null = latestRaw
    ? {
        id: latestRaw.id,
        eventId: latestRaw.event_id ?? undefined,
        type: latestRaw.event_type,
        severity: latestRaw.severity,
        measurement: latestRaw.measurement ?? undefined,
        accelerationG: latestRaw.acceleration_g ?? undefined,
        tiltDeg: latestRaw.tilt_deg ?? undefined,
        gyroDps: latestRaw.gyro_dps ?? undefined,
        ldrValue: latestRaw.ldr_value ?? undefined,
        timeValid: latestRaw.time_valid ?? true,
        durationMs: latestRaw.duration_ms ?? undefined,
        details:
          latestRaw.details && typeof latestRaw.details === "object"
            ? (latestRaw.details as Record<string, unknown>)
            : undefined,
        timestamp: latestRaw.created_at,
      }
    : null;

  const latestTimestamp =
    latestEvent?.timestamp ?? deviceRow.last_seen_at ?? nowIso();

  let status: SafeCargoReportStatus =
    deviceRow.current_status ?? "NORMAL";

  if (latestEvent) {
    const eventStatus: SafeCargoReportStatus = (() => {
      switch (latestEvent.severity) {
        case "NORMAL":
          return "NORMAL";
        case "LOW":
          return "LOW";
        case "MEDIUM":
          return "MEDIUM";
        case "WARNING":
          return "WARNING";
        case "HIGH":
          return "HIGH";
        case "CRITICAL":
          return "CRITICAL";
      }
    })();
    const order: SafeCargoReportStatus[] = [
      "NORMAL",
      "LOW",
      "MEDIUM",
      "WARNING",
      "HIGH",
      "CRITICAL",
    ];
    if (order.indexOf(eventStatus) > order.indexOf(status)) {
      status = eventStatus;
    }
  }

  const snap =
    deviceRow.current_report_jsonb &&
    typeof deviceRow.current_report_jsonb === "object"
      ? (deviceRow.current_report_jsonb as Record<string, unknown>)
      : null;

  if (snap) {
    const sCounts = snap["events"];
    if (sCounts && typeof sCounts === "object") {
      const sc = sCounts as Record<string, unknown>;
      const normalize = <K extends keyof SafeCargoEventCounts>(
        key: K,
        rawKey: string
      ) => {
        const v = sc[rawKey];
        if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
          eventCounts[key] = Math.max(eventCounts[key], Math.floor(v));
        }
      };
      normalize("SHOCK", "shock");
      normalize("TILT", "tilt");
      normalize("MOTION", "motion");
      normalize("LIGHT", "light");
    }
    const sMax = snap["max"];
    if (sMax && typeof sMax === "object") {
      const sm = sMax as Record<string, unknown>;
      const pick = (key: "g" | "tilt" | "gyro"): number | null => {
        const v = sm[key];
        return typeof v === "number" && Number.isFinite(v) ? v : null;
      };
      const g = pick("g");
      const t = pick("tilt");
      const gy = pick("gyro");
      if (g !== null && (maxG === null || g > maxG)) maxG = g;
      if (t !== null && (maxTilt === null || t > maxTilt)) maxTilt = t;
      if (gy !== null && (maxGyro === null || gy > maxGyro)) maxGyro = gy;
    }
    const snapPending = snap["pending"];
    if (typeof snapPending === "number") {
      pending = snapPending;
    }
  }

  const snapSent =
    snap && typeof snap["sent"] === "number" ? (snap["sent"] as number) : undefined;
  const snapDropped =
    snap && typeof snap["dropped"] === "number"
      ? (snap["dropped"] as number)
      : undefined;
  const snapEvicted =
    snap && typeof snap["evicted"] === "number"
      ? (snap["evicted"] as number)
      : undefined;

  const timeValid = latestEvent
    ? (latestEvent.timeValid ?? true)
    : snap && typeof snap["timeValid"] === "boolean"
    ? snap["timeValid"]
    : true;

  return {
    version: SAFECARGO_PAYLOAD_VERSION,
    deviceId: deviceRow.id,
    deviceName: deviceRow.name ?? undefined,
    status,
    eventCounts,
    max: { g: maxG, tilt: maxTilt, gyro: maxGyro },
    latestEvent,
    latestTimestamp: timeValid ? latestTimestamp : null,
    timeValid,
    pending,
    sent: snapSent,
    dropped: snapDropped,
    evicted: snapEvicted,
    resetPending:
      Boolean(deviceRow.reset_pending) ||
      Boolean(snap && (snap as Record<string, unknown>)["reset_pending"]),
    source: "LIVE",
    verification: {
      method: "SERVER",
      verifiedAt: opts?.verifiedAt ?? nowIso(),
    },
  };
}
