export type SafeCargoReportStatus =
  | "NORMAL"
  | "LOW"
  | "MEDIUM"
  | "WARNING"
  | "HIGH"
  | "CRITICAL";

export type SafeCargoEventType = "SHOCK" | "TILT" | "MOTION" | "LIGHT" | "NONE";

export type SafeCargoEventSeverity =
  | "NORMAL"
  | "LOW"
  | "MEDIUM"
  | "WARNING"
  | "HIGH"
  | "CRITICAL";

export type SafeCargoReportSource = "NFC" | "LIVE" | "DEMO";

export type SafeCargoLogState = "PENDING" | "SENT" | "DROPPED";

export interface SafeCargoEvent {
  id?: string;
  eventId?: number;
  type: SafeCargoEventType;
  severity: SafeCargoEventSeverity;
  timestamp: string;
  timeValid?: boolean;
  timeEstimated?: boolean;
  measurement?: number;
  accelerationG?: number;
  tiltDeg?: number;
  gyroDps?: number;
  ldrValue?: number;
  durationMs?: number;
  logState?: SafeCargoLogState;
  boot?: number;
  uptimeSec?: number;
  details?: Record<string, unknown>;
}

export interface SafeCargoReportVerification {
  method: "NFC" | "SERVER" | "DEMO";
  nfcSerialNumber?: string;
  tagType?: string;
  verifiedAt: string;
}

export interface SafeCargoEventCounts {
  SHOCK: number;
  TILT: number;
  MOTION: number;
  LIGHT: number;
}

export interface SafeCargoMaxMeasurements {
  g: number | null;
  tilt: number | null;
  gyro: number | null;
}

export interface SafeCargoSensorInfo {
  accelerometer?: string;
  gyroscope?: string;
  nfcChip?: string;
  firmwareVersion?: string;
  espModel?: string;
}

export interface SafeCargoReport {
  version: number;
  deviceId: string;
  deviceName?: string;
  status: SafeCargoReportStatus;
  eventCounts: SafeCargoEventCounts;
  max: SafeCargoMaxMeasurements;
  latestEvent: SafeCargoEvent | null;
  latestTimestamp: string | null;
  timeValid?: boolean;
  pending?: number;
  sent?: number;
  dropped?: number;
  evicted?: number;
  eventsLog?: SafeCargoEvent[];
  sensorInfo?: SafeCargoSensorInfo;
  resetPending?: boolean;
  source: SafeCargoReportSource;
  verification: SafeCargoReportVerification;
}

export interface DeviceSummary {
  id: string;
  name: string;
  status: SafeCargoReportStatus;
  lastSeenAt: string | null;
  createdAt?: string | null;
  resetPending?: boolean;
}

export const STATUS_ORDER: SafeCargoReportStatus[] = [
  "NORMAL",
  "LOW",
  "MEDIUM",
  "WARNING",
  "HIGH",
  "CRITICAL",
];

export function worstStatus(
  a: SafeCargoReportStatus,
  b: SafeCargoReportStatus
): SafeCargoReportStatus {
  const ia = STATUS_ORDER.indexOf(a);
  const ib = STATUS_ORDER.indexOf(b);
  return ia >= ib ? a : b;
}

export function severityToStatus(
  severity: SafeCargoEventSeverity
): SafeCargoReportStatus {
  switch (severity) {
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
}
