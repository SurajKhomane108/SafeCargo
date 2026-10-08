export type SafeCargoReportStatus =
  | "NORMAL"
  | "LOW"
  | "MEDIUM"
  | "WARNING"
  | "HIGH"
  | "CRITICAL";

export type SafeCargoEventType = "SHOCK" | "TILT" | "MOTION" | "LIGHT";

export type SafeCargoEventSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SafeCargoReportSource = "NFC" | "LIVE" | "DEMO";

export interface SafeCargoEvent {
  id?: string;
  eventId?: number;
  type: SafeCargoEventType;
  severity: SafeCargoEventSeverity;
  timestamp: string;
  timeValid?: boolean;
  measurement?: number;
  accelerationG?: number;
  tiltDeg?: number;
  gyroDps?: number;
  ldrValue?: number;
  durationMs?: number;
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
  sensorInfo?: SafeCargoSensorInfo;
  source: SafeCargoReportSource;
  verification: SafeCargoReportVerification;
}

export interface DeviceSummary {
  id: string;
  name: string;
  status: SafeCargoReportStatus;
  lastSeenAt: string | null;
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
    case "LOW":
      return "LOW";
    case "MEDIUM":
      return "MEDIUM";
    case "HIGH":
      return "HIGH";
    case "CRITICAL":
      return "CRITICAL";
  }
}
