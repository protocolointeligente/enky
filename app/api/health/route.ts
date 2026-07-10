import { NextResponse } from "next/server";
import { env } from "@/lib/env";

// Health must always reflect live state (uptime, timestamp) — never
// prerendered or cached as static output at build time.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "enky-os",
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
