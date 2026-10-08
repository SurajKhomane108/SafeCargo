import { NextResponse } from "next/server";
import { verifyDeviceToken } from "@/lib/db";
import { createServerRoleSupabase, hasServerSupabaseConfig } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  const { deviceId } = await params;
  if (!deviceId) {
    return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
  }

  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    const authCheck = await verifyDeviceToken(deviceId, token);
    if (!authCheck.valid) {
      return NextResponse.json(
        { error: "Invalid device credentials." },
        { status: 401 }
      );
    }
  }

  // If Supabase server is configured, delete previous events for this device upon reset
  if (hasServerSupabaseConfig()) {
    const supabase = createServerRoleSupabase();
    if (supabase) {
      await supabase.from("events").delete().eq("device_id", deviceId);
      await supabase
        .from("devices")
        .update({
          current_status: "NORMAL",
          current_max_g: null,
          current_max_tilt: null,
          current_max_gyro: null,
          pending_events: 0,
        })
        .eq("id", deviceId);
    }
  }

  return NextResponse.json({ ok: true, reset: true });
}
