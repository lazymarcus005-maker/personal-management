import { db } from "@/db";
import {
  stravaActivities,
  stravaAthletes,
  stravaConnections,
  stravaSyncJobs,
  stravaWebhookEvents,
} from "@/db/schema";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { STRAVA_SCOPE } from "./constants";
import { decrypt, encrypt } from "./encryption";
import { refreshAccessToken } from "./oauth";
import type {
  StravaActivitySummaryPayload,
  StravaAthletePayload,
  StravaSyncJobStatus,
  StravaSyncJobType,
  StravaTokenResponse,
  StravaWebhookEventPayload,
  StravaWebhookEventStatus,
} from "./types";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

export async function getConnectionByUserId(userId: string) {
  const [connection] = await db
    .select()
    .from(stravaConnections)
    .where(eq(stravaConnections.userId, userId))
    .limit(1);
  return connection ?? null;
}

export async function upsertConnectionFromToken(
  userId: string,
  token: StravaTokenResponse
) {
  const athlete = token.athlete;
  if (!athlete?.id) {
    throw new Error("Strava token response did not include an athlete");
  }

  const expiresAt = new Date(token.expires_at * 1000);

  const [connection] = await db
    .insert(stravaConnections)
    .values({
      userId,
      stravaAthleteId: athlete.id,
      status: "CONNECTED",
      scopes: STRAVA_SCOPE,
      accessTokenEnc: encrypt(token.access_token),
      refreshTokenEnc: encrypt(token.refresh_token),
      tokenType: token.token_type,
      tokenExpiresAt: expiresAt,
      lastError: null,
      disconnectedAt: null,
    })
    .onConflictDoUpdate({
      target: stravaConnections.userId,
      set: {
        stravaAthleteId: athlete.id,
        status: "CONNECTED",
        scopes: STRAVA_SCOPE,
        accessTokenEnc: encrypt(token.access_token),
        refreshTokenEnc: encrypt(token.refresh_token),
        tokenType: token.token_type,
        tokenExpiresAt: expiresAt,
        lastError: null,
        disconnectedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return connection;
}

export async function updateConnectionTokens(
  connectionId: string,
  token: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_at: number;
  }
) {
  const [connection] = await db
    .update(stravaConnections)
    .set({
      accessTokenEnc: encrypt(token.access_token),
      refreshTokenEnc: encrypt(token.refresh_token),
      tokenType: token.token_type,
      tokenExpiresAt: new Date(token.expires_at * 1000),
      status: "CONNECTED",
      updatedAt: new Date(),
    })
    .where(eq(stravaConnections.id, connectionId))
    .returning();
  return connection;
}

export async function disconnectConnection(connectionId: string) {
  const [connection] = await db
    .update(stravaConnections)
    .set({
      status: "REVOKED",
      accessTokenEnc: null,
      refreshTokenEnc: null,
      disconnectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(stravaConnections.id, connectionId))
    .returning();
  return connection;
}

export async function upsertAthlete(
  connectionId: string,
  payload: StravaAthletePayload
) {
  const [athlete] = await db
    .insert(stravaAthletes)
    .values({
      connectionId,
      stravaAthleteId: payload.id,
      username: payload.username ?? null,
      firstname: payload.firstname ?? null,
      lastname: payload.lastname ?? null,
      bio: payload.bio ?? null,
      city: payload.city ?? null,
      state: payload.state ?? null,
      country: payload.country ?? null,
      sex: payload.sex ?? null,
      weight: payload.weight ?? null,
      profile: payload.profile ?? null,
      profileMedium: payload.profile_medium ?? null,
      rawPayload: payload,
    })
    .onConflictDoUpdate({
      target: stravaAthletes.stravaAthleteId,
      set: {
        connectionId,
        username: payload.username ?? null,
        firstname: payload.firstname ?? null,
        lastname: payload.lastname ?? null,
        bio: payload.bio ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        country: payload.country ?? null,
        sex: payload.sex ?? null,
        weight: payload.weight ?? null,
        profile: payload.profile ?? null,
        profileMedium: payload.profile_medium ?? null,
        rawPayload: payload,
        updatedAt: new Date(),
      },
    })
    .returning();
  return athlete;
}

export async function getAthleteByConnectionId(connectionId: string) {
  const [athlete] = await db
    .select()
    .from(stravaAthletes)
    .where(eq(stravaAthletes.connectionId, connectionId))
    .limit(1);
  return athlete ?? null;
}

function mapActivity(
  connectionId: string,
  athleteId: string | null,
  payload: StravaActivitySummaryPayload
) {
  return {
    connectionId,
    athleteId,
    stravaActivityId: payload.id,
    name: payload.name,
    sportType: payload.sport_type ?? payload.type ?? null,
    type: payload.type ?? null,
    startDate: payload.start_date ? new Date(payload.start_date) : null,
    startDateLocal: payload.start_date_local ?? null,
    timezone: payload.timezone ?? null,
    distance: payload.distance ?? null,
    movingTime: payload.moving_time ?? null,
    elapsedTime: payload.elapsed_time ?? null,
    totalElevationGain: payload.total_elevation_gain ?? null,
    averageSpeed: payload.average_speed ?? null,
    maxSpeed: payload.max_speed ?? null,
    averageHeartrate: payload.average_heartrate ?? null,
    maxHeartrate: payload.max_heartrate ?? null,
    averageWatts: payload.average_watts ?? null,
    maxWatts: payload.max_watts ?? null,
    weightedAverageWatts: payload.weighted_average_watts ?? null,
    kilojoules: payload.kilojoules ?? null,
    deviceWatts: payload.device_watts ?? false,
    calories: payload.calories ?? null,
    averageCadence: payload.average_cadence ?? null,
    prCount: payload.pr_count ?? null,
    kudosCount: payload.kudos_count ?? null,
    commentCount: payload.comment_count ?? null,
    achievementCount: payload.achievement_count ?? null,
    commute: payload.commute ?? false,
    trainer: payload.trainer ?? false,
    manual: payload.manual ?? false,
    private: payload.private ?? false,
    visibility: payload.visibility ?? null,
    gearId: payload.gear_id ?? null,
    externalId: payload.external_id ?? null,
    summaryPolyline: payload.map?.summary_polyline ?? null,
    rawPayload: payload,
  };
}

export async function upsertActivities(
  connectionId: string,
  athleteId: string | null,
  payloads: StravaActivitySummaryPayload[]
): Promise<number> {
  let processed = 0;
  for (const payload of payloads) {
    const row = mapActivity(connectionId, athleteId, payload);
    await db
      .insert(stravaActivities)
      .values(row)
      .onConflictDoUpdate({
        target: stravaActivities.stravaActivityId,
        set: { ...row, updatedAt: new Date() },
      });
    processed += 1;
  }
  return processed;
}

export interface ListActivitiesParams {
  limit?: number;
  offset?: number;
  sportType?: string;
}

export async function listActivitiesForUser(
  userId: string,
  params: ListActivitiesParams = {}
) {
  const connection = await getConnectionByUserId(userId);
  if (!connection) return [];

  const limit = Math.min(params.limit ?? 30, 100);
  const offset = params.offset ?? 0;

  const conditions = [eq(stravaActivities.connectionId, connection.id)];
  if (params.sportType) {
    conditions.push(eq(stravaActivities.sportType, params.sportType));
  }

  return db
    .select()
    .from(stravaActivities)
    .where(and(...conditions))
    .orderBy(desc(stravaActivities.startDate))
    .limit(limit)
    .offset(offset);
}

export async function getActivityForUser(userId: string, activityId: string) {
  const connection = await getConnectionByUserId(userId);
  if (!connection) return null;

  const [activity] = await db
    .select()
    .from(stravaActivities)
    .where(
      and(
        eq(stravaActivities.id, activityId),
        eq(stravaActivities.connectionId, connection.id)
      )
    )
    .limit(1);
  return activity ?? null;
}

export async function getActivitySummaryForUser(userId: string) {
  const connection = await getConnectionByUserId(userId);
  if (!connection) return null;

  const [summary] = await db
    .select({
      totalActivities: count(stravaActivities.id),
      totalDistance: sql<number>`coalesce(sum(${stravaActivities.distance}), 0)`,
      totalMovingTime: sql<number>`coalesce(sum(${stravaActivities.movingTime}), 0)`,
      totalElevationGain: sql<number>`coalesce(sum(${stravaActivities.totalElevationGain}), 0)`,
      totalCalories: sql<number>`coalesce(sum(${stravaActivities.calories}), 0)`,
      latestActivityAt: sql<string | null>`max(${stravaActivities.startDate})`,
    })
    .from(stravaActivities)
    .where(eq(stravaActivities.connectionId, connection.id));

  return summary ?? null;
}

export async function createSyncJob(
  connectionId: string,
  type: StravaSyncJobType,
  trigger: string
) {
  const [job] = await db
    .insert(stravaSyncJobs)
    .values({
      connectionId,
      type,
      status: "QUEUED",
      trigger,
    })
    .returning();
  return job;
}

export async function setSyncJobStatus(
  jobId: string,
  status: StravaSyncJobStatus,
  extra: { activitiesProcessed?: number; error?: string } = {}
) {
  const now = new Date();
  const [job] = await db
    .update(stravaSyncJobs)
    .set({
      status,
      startedAt: status === "RUNNING" ? now : undefined,
      finishedAt:
        status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED"
          ? now
          : undefined,
      activitiesProcessed: extra.activitiesProcessed,
      error: extra.error ?? null,
    })
    .where(eq(stravaSyncJobs.id, jobId))
    .returning();
  return job;
}

export async function getLatestSyncJob(connectionId: string) {
  const [job] = await db
    .select()
    .from(stravaSyncJobs)
    .where(eq(stravaSyncJobs.connectionId, connectionId))
    .orderBy(desc(stravaSyncJobs.createdAt))
    .limit(1);
  return job ?? null;
}

export function decryptAccessToken(connection: {
  accessTokenEnc: string | null;
}): string {
  if (!connection.accessTokenEnc) {
    throw new Error("Connection has no stored access token");
  }
  return decrypt(connection.accessTokenEnc);
}

export function isTokenExpiring(
  connection: { tokenExpiresAt: Date | null },
  bufferMs = TOKEN_EXPIRY_BUFFER_MS
): boolean {
  if (!connection.tokenExpiresAt) return true;
  return connection.tokenExpiresAt.getTime() - Date.now() < bufferMs;
}

export async function getValidAccessToken(connection: {
  id: string;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  if (!isTokenExpiring(connection) && connection.accessTokenEnc) {
    return decrypt(connection.accessTokenEnc);
  }

  if (!connection.refreshTokenEnc) {
    throw new Error("Connection token expired and no refresh token available");
  }

  const refreshed = await refreshAccessToken(
    decrypt(connection.refreshTokenEnc)
  );
  const updated = await updateConnectionTokens(connection.id, refreshed);
  return decrypt(updated.accessTokenEnc!);
}

export async function getConnectionByStravaAthleteId(stravaAthleteId: number) {
  const [connection] = await db
    .select()
    .from(stravaConnections)
    .where(eq(stravaConnections.stravaAthleteId, stravaAthleteId))
    .limit(1);
  return connection ?? null;
}

export async function listConnectedConnections() {
  return db
    .select()
    .from(stravaConnections)
    .where(eq(stravaConnections.status, "CONNECTED"));
}

export async function getActivityByStravaActivityId(
  connectionId: string,
  stravaActivityId: number
) {
  const [activity] = await db
    .select()
    .from(stravaActivities)
    .where(
      and(
        eq(stravaActivities.connectionId, connectionId),
        eq(stravaActivities.stravaActivityId, stravaActivityId)
      )
    )
    .limit(1);
  return activity ?? null;
}

export async function deleteActivityByStravaActivityId(
  connectionId: string,
  stravaActivityId: number
): Promise<boolean> {
  const [deleted] = await db
    .delete(stravaActivities)
    .where(
      and(
        eq(stravaActivities.connectionId, connectionId),
        eq(stravaActivities.stravaActivityId, stravaActivityId)
      )
    )
    .returning({ id: stravaActivities.id });
  return Boolean(deleted);
}

export async function getWebhookEventByKey(eventKey: string) {
  const [event] = await db
    .select()
    .from(stravaWebhookEvents)
    .where(eq(stravaWebhookEvents.eventKey, eventKey))
    .limit(1);
  return event ?? null;
}

export async function recordWebhookEvent(
  eventKey: string,
  payload: StravaWebhookEventPayload
) {
  const [event] = await db
    .insert(stravaWebhookEvents)
    .values({
      eventKey,
      objectType: payload.object_type,
      objectId: payload.object_id,
      aspectType: payload.aspect_type,
      ownerResourceId: payload.owner_id,
      subscriptionId: payload.subscription_id,
      updates: payload.updates ?? null,
      eventTime: payload.event_time
        ? new Date(payload.event_time * 1000)
        : null,
      status: "RECEIVED",
    })
    .onConflictDoNothing({ target: stravaWebhookEvents.eventKey })
    .returning();
  return event ?? null;
}

export async function setWebhookEventStatus(
  eventId: string,
  status: StravaWebhookEventStatus
) {
  const [event] = await db
    .update(stravaWebhookEvents)
    .set({
      status,
      processedAt:
        status === "PROCESSED" || status === "IGNORED" ? new Date() : null,
    })
    .where(eq(stravaWebhookEvents.id, eventId))
    .returning();
  return event;
}

export async function listProcessableWebhookEvents(limit = 25) {
  return db
    .select()
    .from(stravaWebhookEvents)
    .where(
      inArray(stravaWebhookEvents.status, ["RECEIVED", "FAILED", "PROCESSING"])
    )
    .orderBy(stravaWebhookEvents.createdAt)
    .limit(limit);
}
