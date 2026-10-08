import { NextResponse } from "next/server";
import { requestDeviceReset, getDevice } from "@/lib/db";
import { hasServerSupabaseConfig } from "@/lib/supabase/server";

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

  const device = await getDevice(deviceId);
  if (!device) {
    return NextResponse.json(
      { error: `Device ${deviceId} not found.` },
      { status: 404 }
    );
  }

  const result = await requestDeviceReset(deviceId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Failed to queue reset request." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      deviceId,
      resetPending: true,
      message:
        "Reset request queued. The device will wipe all local and cloud state on its next poll (within 30 seconds).",
    },
    { status: 200 }
  );
}
