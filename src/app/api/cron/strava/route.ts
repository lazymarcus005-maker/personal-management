import {
  retryFailedWebhookEvents,
  runDailyReconciliation,
} from "@/lib/strava/webhook";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  return request.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [reconciliation, retries] = await Promise.all([
    runDailyReconciliation(),
    retryFailedWebhookEvents(),
  ]);

  return Response.json({ ok: true, reconciliation, retries });
}
