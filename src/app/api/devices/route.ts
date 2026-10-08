import { NextResponse } from "next/server";
import { listDevices } from "@/lib/db";
import { hasBrowserSupabaseConfig } from "@/lib/supabase/client";
import { hasServerSupabaseConfig } from "@/lib/supabase/server";

export async function GET(_req: Request) {
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

  const devices = await listDevices();
  const safe = devices.map((d) => ({
    id: d.id,
    name: d.name,
    status: d.current_status,
    lastSeenAt: d.last_seen_at,
    createdAt: d.created_at,
  }));

  return NextResponse.json({ devices: safe }, { status: 200 });
}
