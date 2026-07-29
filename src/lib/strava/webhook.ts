import { STRAVA_WEBHOOK_RETRY_LIMIT } from "./constants";
import {
  deleteActivityByStravaActivityId,
  getConnectionByStravaAthleteId,
  listConnectedConnections,
  listProcessableWebhookEvents,
  recordWebhookEvent,
  setWebhookEventStatus,
} from "./repository";
import { performReconciliation, performSingleActivitySync } from "./sync";
import type {
  StravaWebhookEventPayload,
  StravaWebhookEventStatus,
} from "./types";
import { buildEventKey } from "./webhook-validation";

export {
  buildEventKey,
  parseWebhookEvent,
  validateWebhookChallenge,
} from "./webhook-validation";
export type { WebhookChallengeParams } from "./webhook-validation";

export interface WebhookIntakeResult {
  status: "accepted" | "duplicate";
  eventId: string | null;
}

export async function intakeWebhookEvent(
  payload: StravaWebhookEventPayload
): Promise<WebhookIntakeResult> {
  const eventKey = buildEventKey(payload);
  const event = await recordWebhookEvent(eventKey, payload);
  if (!event) {
    return { status: "duplicate", eventId: null };
  }
  await processWebhookEvent({
    id: event.id,
    objectType: event.objectType,
    objectId: event.objectId,
    aspectType: event.aspectType,
    ownerResourceId: event.ownerResourceId,
  });
  return { status: "accepted", eventId: event.id };
}

interface StoredEvent {
  id: string;
  objectType: string | null;
  objectId: number | null;
  aspectType: string | null;
  ownerResourceId: number | null;
}

async function finish(eventId: string, status: StravaWebhookEventStatus) {
  await setWebhookEventStatus(eventId, status);
  return status;
}

export async function processWebhookEvent(
  event: StoredEvent
): Promise<StravaWebhookEventStatus> {
  await setWebhookEventStatus(event.id, "PROCESSING");

  if (event.objectType !== "activity" || !event.objectId || !event.ownerResourceId) {
    return finish(event.id, "IGNORED");
  }

  const connection = await getConnectionByStravaAthleteId(event.ownerResourceId);
  if (!connection) {
    return finish(event.id, "IGNORED");
  }

  try {
    if (event.aspectType === "delete") {
      await deleteActivityByStravaActivityId(connection.id, event.objectId);
      return finish(event.id, "PROCESSED");
    }

    await performSingleActivitySync(
      connection,
      event.objectId,
      `webhook:${event.aspectType ?? "event"}`
    );
    return finish(event.id, "PROCESSED");
  } catch {
    return finish(event.id, "FAILED");
  }
}

export interface RetrySummary {
  attempted: number;
  processed: number;
  ignored: number;
  failed: number;
}

export async function retryFailedWebhookEvents(
  limit = STRAVA_WEBHOOK_RETRY_LIMIT
): Promise<RetrySummary> {
  const events = await listProcessableWebhookEvents(limit);
  const summary: RetrySummary = {
    attempted: events.length,
    processed: 0,
    ignored: 0,
    failed: 0,
  };

  for (const event of events) {
    const status = await processWebhookEvent(event);
    if (status === "PROCESSED") summary.processed += 1;
    else if (status === "IGNORED") summary.ignored += 1;
    else summary.failed += 1;
  }

  return summary;
}

export interface ReconciliationSummary {
  connections: number;
  succeeded: number;
  failed: number;
  activitiesProcessed: number;
}

export async function runDailyReconciliation(): Promise<ReconciliationSummary> {
  const connections = await listConnectedConnections();
  const summary: ReconciliationSummary = {
    connections: connections.length,
    succeeded: 0,
    failed: 0,
    activitiesProcessed: 0,
  };

  for (const connection of connections) {
    try {
      const result = await performReconciliation(connection, "daily-cron");
      summary.succeeded += 1;
      summary.activitiesProcessed += result.processed;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}
