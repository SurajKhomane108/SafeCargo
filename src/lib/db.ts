import type {
  SafeCargoEventSeverity,
  SafeCargoEventType,
} from "./types";
import { createServerRoleSupabase } from "./supabase/server";
import { createClientSideSupabase, hasBrowserSupabaseConfig } from "./supabase/client";

export interface DbDevice {
  id: string;
  name: string | null;
  auth_token_hash?: string;
  created_at: string;
  last_seen_at: string | null;
  current_status:
    | "NORMAL"
    | "LOW"
    | "MEDIUM"
    | "WARNING"
    | "HIGH"
    | "CRITICAL"
    | null;
  current_max_g: number | null;
  current_max_tilt: number | null;
  current_max_gyro: number | null;
  current_report_jsonb: unknown;
}

export interface DbEvent {
  id: string;
  device_id: string;
  event_id?: number | null;
  event_type: SafeCargoEventType;
  severity: SafeCargoEventSeverity;
  measurement: number | null;
  acceleration_g?: number | null;
  tilt_deg?: number | null;
  gyro_dps?: number | null;
  ldr_value?: number | null;
  time_valid?: boolean | null;
  duration_ms: number | null;
  details: unknown;
  source: "WIFI" | "NFC_MANUAL";
  created_at: string;
}

export interface InsertEventInput {
  deviceId: string;
  eventId?: number | null;
  type: SafeCargoEventType;
  severity: SafeCargoEventSeverity;
  measurement?: number | null;
  accelerationG?: number | null;
  tiltDeg?: number | null;
  gyroDps?: number | null;
  ldrValue?: number | null;
  timeValid?: boolean;
  durationMs?: number | null;
  details?: unknown;
  timestamp?: string | null;
  source?: "WIFI" | "NFC_MANUAL";
}

export interface UpsertReportInput {
  deviceId: string;
  status:
    | "NORMAL"
    | "LOW"
    | "MEDIUM"
    | "WARNING"
    | "HIGH"
    | "CRITICAL";
  maxG?: number | null;
  maxTilt?: number | null;
  maxGyro?: number | null;
  pendingEvents?: number | null;
  snapshotJsonb?: unknown;
  timestamp?: string | null;
}

export async function verifyDeviceToken(
  deviceId: string,
  token: string
): Promise<{ valid: boolean; device?: DbDevice }> {
  if (!deviceId || !token) return { valid: false };
  const supabase = createServerRoleSupabase();
  if (!supabase) return { valid: false };

  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("id", deviceId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return { valid: false };
  const device = data as unknown as DbDevice;
  const expected = device.auth_token_hash as string | undefined;
  if (!expected) return { valid: false };

  if (expected !== token) {
    return { valid: false };
  }
  const { auth_token_hash, ...safe } = device;
  void auth_token_hash;
  return { valid: true, device: safe as DbDevice };
}

export async function getDevice(
  deviceId: string
): Promise<DbDevice | null> {
  const client = hasBrowserSupabaseConfig()
    ? createClientSideSupabase()
    : createServerRoleSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from("devices")
    .select(
      "id,name,created_at,last_seen_at,current_status,current_max_g,current_max_tilt,current_max_gyro,current_report_jsonb"
    )
    .eq("id", deviceId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as DbDevice;
}

export async function listDevices(): Promise<DbDevice[]> {
  const client = hasBrowserSupabaseConfig()
    ? createClientSideSupabase()
    : createServerRoleSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("devices")
    .select(
      "id,name,created_at,last_seen_at,current_status,current_max_g,current_max_tilt,current_max_gyro,current_report_jsonb"
    )
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true });
  if (error || !data) return [];
  return data as unknown as DbDevice[];
}

export async function getDeviceEvents(
  deviceId: string,
  limit: number = 50
): Promise<DbEvent[]> {
  const client = hasBrowserSupabaseConfig()
    ? createClientSideSupabase()
    : createServerRoleSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as DbEvent[];
}

export async function insertEvent(
  input: InsertEventInput
): Promise<{ ok: boolean; event?: DbEvent; duplicated?: boolean; error?: string }> {
  const supabase = createServerRoleSupabase();
  if (!supabase) return { ok: false, error: "Server not configured" };

  // Deduplication check: if eventId is provided, check if already exists for this device
  if (typeof input.eventId === "number") {
    const { data: existing } = await supabase
      .from("events")
      .select("*")
      .eq("device_id", input.deviceId)
      .eq("event_id", input.eventId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { ok: true, event: existing as unknown as DbEvent, duplicated: true };
    }
  }

  const measurement =
    input.measurement ??
    (input.type === "SHOCK"
      ? input.accelerationG
      : input.type === "TILT"
      ? input.tiltDeg
      : input.type === "MOTION"
      ? input.gyroDps
      : input.type === "LIGHT"
      ? input.ldrValue
      : null) ??
    null;

  const row: Record<string, unknown> = {
    device_id: input.deviceId,
    event_id: input.eventId ?? null,
    event_type: input.type,
    severity: input.severity,
    measurement,
    acceleration_g: input.accelerationG ?? null,
    tilt_deg: input.tiltDeg ?? null,
    gyro_dps: input.gyroDps ?? null,
    ldr_value: input.ldrValue ?? null,
    time_valid: input.timeValid ?? true,
    duration_ms: input.durationMs ?? null,
    details: input.details ?? null,
    source: input.source ?? "WIFI",
  };

  if (input.timestamp && input.timeValid !== false) {
    row.created_at = input.timestamp;
  }

  let { data, error } = await supabase
    .from("events")
    .insert(row)
    .select()
    .limit(1)
    .maybeSingle();

  if (error && error.message?.includes("cargo_severity") && (row.severity === "WARNING" || row.severity === "NORMAL")) {
    row.severity = row.severity === "WARNING" ? "HIGH" : "LOW";
    const retry = await supabase
      .from("events")
      .insert(row)
      .select()
      .limit(1)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    // Concurrent retry protection: if unique constraint violation (code 23505) occurs
    if (error.code === "23505" && typeof input.eventId === "number") {
      const { data: existing } = await supabase
        .from("events")
        .select("*")
        .eq("device_id", input.deviceId)
        .eq("event_id", input.eventId)
        .limit(1)
        .maybeSingle();
      if (existing) {
        return { ok: true, event: existing as unknown as DbEvent, duplicated: true };
      }
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, event: data as unknown as DbEvent, duplicated: false };
}

export async function upsertDeviceReport(
  input: UpsertReportInput
): Promise<{ ok: boolean; device?: DbDevice; error?: string }> {
  const supabase = createServerRoleSupabase();
  if (!supabase) return { ok: false, error: "Server not configured" };

  const updates: Record<string, unknown> = {
    current_status: input.status,
    current_max_g: input.maxG ?? null,
    current_max_tilt: input.maxTilt ?? null,
    current_max_gyro: input.maxGyro ?? null,
    current_report_jsonb: input.snapshotJsonb ?? null,
  };
  if (input.pendingEvents !== undefined) {
    updates.pending_events = input.pendingEvents;
  }
  updates.last_seen_at = input.timestamp ? input.timestamp : new Date().toISOString();

  const { data, error } = await supabase
    .from("devices")
    .update(updates)
    .eq("id", input.deviceId)
    .select(
      "id,name,created_at,last_seen_at,current_status,current_max_g,current_max_tilt,current_max_gyro,current_report_jsonb"
    )
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Device not found" };
  return { ok: true, device: data as unknown as DbDevice };
}
