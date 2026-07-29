import { getStravaVerifyToken } from "@/lib/strava/constants";
import {
  intakeWebhookEvent,
  parseWebhookEvent,
  validateWebhookChallenge,
} from "@/lib/strava/webhook";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const challenge = validateWebhookChallenge(
    {
      mode: params.get("hub.mode"),
      challenge: params.get("hub.challenge"),
      verifyToken: params.get("hub.verify_token"),
    },
    getStravaVerifyToken()
  );

  if (!challenge) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json({ "hub.challenge": challenge });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = parseWebhookEvent(body);
  if (!payload) {
    return Response.json({ error: "Invalid event payload" }, { status: 400 });
  }

  await intakeWebhookEvent(payload);
  return Response.json({ ok: true });
}
