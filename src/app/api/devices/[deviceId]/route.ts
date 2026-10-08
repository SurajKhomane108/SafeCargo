import { NextResponse } from "next/server";
import { getDevice, getDeviceEvents } from "@/lib/db";
import { hasBrowserSupabaseConfig } from "@/lib/supabase/client";
import { hasServerSupabaseConfig } from "@/lib/supabase/server";
import { parseLiveReport } from "@/lib/report";
import type { SafeCargoReport } from "@/lib/types";

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
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

  const [device, events] = await Promise.all([
    getDevice(deviceId),
    getDeviceEvents(deviceId, 100),
  ]);

  if (!device) {
    return NextResponse.json(
      { error: `Device ${deviceId} not found.` },
      { status: 404 }
    );
  }

  const report: SafeCargoReport = parseLiveReport(device, events);

  return NextResponse.json(report, { status: 200 });
}
