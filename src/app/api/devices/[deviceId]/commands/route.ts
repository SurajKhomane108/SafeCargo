import { NextResponse } from "next/server";
import { isDeviceResetPending, verifyDeviceToken } from "@/lib/db";
import { hasServerSupabaseConfig } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
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
  if (headerDeviceId && headerDeviceId !== deviceId) {
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
  if (!authCheck.valid) {
    return NextResponse.json(
      { error: "Invalid device credentials." },
      { status: 401 }
    );
  }

  const isPending = await isDeviceResetPending(deviceId);
  return NextResponse.json({ reset: isPending }, { status: 200 });
}
