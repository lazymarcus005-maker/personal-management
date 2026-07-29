import type { StravaWebhookEventPayload } from "./types";

export interface WebhookChallengeParams {
  mode?: string | null;
  challenge?: string | null;
  verifyToken?: string | null;
}

export function validateWebhookChallenge(
  params: WebhookChallengeParams,
  expectedToken: string
): string | null {
  if (params.mode !== "subscribe") return null;
  if (!params.challenge) return null;
  if (!expectedToken || params.verifyToken !== expectedToken) return null;
  return params.challenge;
}

export function parseWebhookEvent(
  body: unknown
): StravaWebhookEventPayload | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  if (typeof data.object_type !== "string") return null;
  if (typeof data.object_id !== "number") return null;
  if (typeof data.aspect_type !== "string") return null;
  if (typeof data.owner_id !== "number") return null;
  if (typeof data.subscription_id !== "number") return null;
  if (typeof data.event_time !== "number") return null;

  return {
    object_type: data.object_type,
    object_id: data.object_id,
    aspect_type: data.aspect_type,
    owner_id: data.owner_id,
    subscription_id: data.subscription_id,
    event_time: data.event_time,
    updates:
      data.updates && typeof data.updates === "object"
        ? (data.updates as Record<string, unknown>)
        : undefined,
  };
}

export function buildEventKey(payload: StravaWebhookEventPayload): string {
  return [
    payload.object_type,
    payload.object_id,
    payload.aspect_type,
    payload.event_time,
  ].join(":");
}
