import { NextResponse } from "next/server";
import { verifyDeviceToken } from "@/lib/db";

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
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

  return NextResponse.json({ reset: false });
}
