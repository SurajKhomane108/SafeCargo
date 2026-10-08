import { NextResponse } from "next/server";
import { hasServerSupabaseConfig } from "@/lib/supabase/server";
import {
  insertEvent,
  upsertDeviceReport,
  verifyDeviceToken,
} from "@/lib/db";
import { reportIngestionSchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  if (!hasServerSupabaseConfig()) {
    return NextResponse.json(
      { error: "Server not configured with Supabase service role." },
      { status: 500 }
    );
  }

  const { deviceId } = await params;

  if (!deviceId) {
    return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
  }

  const headerDeviceId = req.headers.get("x-device-id");
  if (!headerDeviceId) {
    return NextResponse.json(
      { error: "Missing X-Device-ID header" },
      { status: 400 }
    );
  }
  if (headerDeviceId !== deviceId) {
    return NextResponse.json(
      { error: "X-Device-ID header does not match URL deviceId." },
      { status: 400 }
    );
  }

  const auth = req.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid Authorization header. Expected Bearer token.",
      },
      { status: 401 }
    );
  }
  const token = auth.slice("Bearer ".length).trim();
  const authCheck = await verifyDeviceToken(deviceId, token);
  if (!authCheck.valid || !authCheck.device) {
    return NextResponse.json(
      { error: "Invalid device credentials." },
      { status: 401 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = reportIngestionSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "Invalid report payload.",
        details: first
          ? `${first.path.join(".") || "body"}: ${first.message}`
          : undefined,
      },
      { status: 400 }
    );
  }

  const r = parsed.data;
  const eventTime = r.time ?? r.timestamp ?? null;
  const isRealLastEvent =
    r.last &&
    r.last.id !== 0 &&
    r.last.type !== "NONE" &&
    r.last.severity !== "NORMAL";

  const snapshot = {
    v: r.v ?? 1,
    device: deviceId,
    status: r.status,
    time: eventTime,
    timeValid: r.timeValid ?? true,
    events: r.events,
    max: r.max,
    last: isRealLastEvent ? r.last : null,
    pending: r.pending ?? 0,
    sensor: r.sensor ?? null,
    ts: eventTime ?? (r.timeValid !== false ? new Date().toISOString() : null),
  };

  const upsert = await upsertDeviceReport({
    deviceId,
    status: r.status,
    maxG: r.max.g ?? null,
    maxTilt: r.max.tilt ?? null,
    maxGyro: r.max.gyro ?? null,
    pendingEvents: r.pending ?? null,
    snapshotJsonb: snapshot,
    timestamp: r.timeValid !== false ? eventTime : null,
  });

  if (!upsert.ok || !upsert.device) {
    return NextResponse.json(
      { error: upsert.error ?? "Failed to update report." },
      { status: 500 }
    );
  }

  const writtenEventIds: string[] = [];
  let writeError: string | null = null;
  for (const ev of r.newEvents ?? []) {
    const res = await insertEvent({
      deviceId,
      eventId: ev.eventId,
      type: ev.type,
      severity: ev.severity,
      measurement: ev.measurement ?? null,
      accelerationG: ev.accelerationG ?? null,
      tiltDeg: ev.tiltDeg ?? null,
      gyroDps: ev.gyroDps ?? null,
      ldrValue: ev.ldrValue ?? null,
      timeValid: ev.timeValid,
      durationMs: ev.durationMs ?? null,
      details: ev.details ?? null,
      timestamp: ev.timestamp ?? null,
      source: ev.source ?? "WIFI",
    });
    if (res.ok && res.event) writtenEventIds.push(res.event.id);
    else writeError = writeError ?? res.error ?? "Event write failed";
  }

  return NextResponse.json(
    {
      ok: true,
      device: upsert.device,
      eventsWritten: writtenEventIds.length,
      eventIds: writtenEventIds,
      writeError: writeError ?? undefined,
    },
    { status: 200 }
  );
}

export function GET() {
  return NextResponse.json(
    { error: "Use POST to submit a report snapshot." },
    { status: 405 }
  );
}
