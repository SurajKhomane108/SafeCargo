import { NextResponse } from "next/server";
import { hasServerSupabaseConfig, createServerRoleSupabase } from "@/lib/supabase/server";
import { hasBrowserSupabaseConfig } from "@/lib/supabase/client";
import { insertEvent, verifyDeviceToken, getDeviceEvents } from "@/lib/db";
import { eventIngestionSchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

/* =============================================================
   POST — Event ingestion for ESP8266 firmware
   Headers:
     Content-Type: application/json
     X-Device-ID: <deviceId>
     Authorization: Bearer <device-token>
   ============================================================= */
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

  const parsed = eventIngestionSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "Invalid event payload.",
        details: first
          ? `${first.path.join(".") || "body"}: ${first.message}`
          : undefined,
      },
      { status: 400 }
    );
  }

  const ev = parsed.data;
  if (ev.device && ev.device !== deviceId) {
    return NextResponse.json(
      { error: "Payload device does not match URL deviceId." },
      { status: 400 }
    );
  }

  const result = await insertEvent({
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
    source: ev.source,
  });

  if (!result.ok || !result.event) {
    return NextResponse.json(
      { error: result.error ?? "Failed to write event." },
      { status: 500 }
    );
  }

  try {
    const supabase = createServerRoleSupabase();
    if (supabase) {
      const heartbeat: Record<string, unknown> = {
        last_seen_at: ev.timeValid !== false && ev.timestamp ? ev.timestamp : new Date().toISOString(),
      };
      await supabase
        .from("devices")
        .update(heartbeat)
        .eq("id", deviceId);
    }
  } catch {
    /* ignore best-effort heartbeat update */
  }

  return NextResponse.json(
    {
      ok: true,
      id: result.event.id,
      eventId: result.event.event_id,
      duplicated: result.duplicated ?? false,
      event: result.event,
    },
    { status: result.duplicated ? 200 : 201 }
  );
}

/* =============================================================
   GET — Public event history for the browser UI
   Query:  ?limit=50 (optional, 1..500, default 50)
   ============================================================= */
export async function GET(req: Request, { params }: RouteParams) {
  const hasAny = hasBrowserSupabaseConfig() || hasServerSupabaseConfig();
  if (!hasAny) {
    return NextResponse.json(
      {
        error:
          "Live data is currently unavailable. NFC/offline verification can still be used.",
      },
      { status: 503 }
    );
  }

  const { deviceId } = await params;

  if (!deviceId) {
    return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam
    ? Math.min(500, Math.max(1, parseInt(limitParam, 10) || 50))
    : 50;

  const events = await getDeviceEvents(deviceId, limit);
  return NextResponse.json({ events }, { status: 200 });
}
