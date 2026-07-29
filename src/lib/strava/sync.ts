import { db } from "@/db";
import { stravaConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getActivity, getAthlete, listAthleteActivities } from "./client";
import {
  STRAVA_BACKFILL_MAX_PAGES,
  STRAVA_DEFAULT_PAGE_SIZE,
  STRAVA_RECONCILE_MAX_PAGES,
} from "./constants";
import {
  createSyncJob,
  getAthleteByConnectionId,
  getValidAccessToken,
  setSyncJobStatus,
  upsertActivities,
  upsertAthlete,
} from "./repository";
import type { StravaSyncJobType } from "./types";

type Connection = typeof stravaConnections.$inferSelect;

async function markConnectionError(connectionId: string, error: string) {
  await db
    .update(stravaConnections)
    .set({ status: "ERROR", lastError: error, updatedAt: new Date() })
    .where(eq(stravaConnections.id, connectionId));
}

async function markConnectionSynced(connectionId: string) {
  await db
    .update(stravaConnections)
    .set({
      status: "CONNECTED",
      lastSyncedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(stravaConnections.id, connectionId));
}

async function runSync(
  connection: Connection,
  type: StravaSyncJobType,
  trigger: string,
  work: (accessToken: string) => Promise<number>
) {
  const job = await createSyncJob(connection.id, type, trigger);
  await setSyncJobStatus(job.id, "RUNNING");

  try {
    const accessToken = await getValidAccessToken(connection);
    const processed = await work(accessToken);
    await setSyncJobStatus(job.id, "SUCCEEDED", { activitiesProcessed: processed });
    await markConnectionSynced(connection.id);
    return { jobId: job.id, processed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setSyncJobStatus(job.id, "FAILED", { error: message });
    await markConnectionError(connection.id, message);
    throw err;
  }
}

export async function performBackfill(connection: Connection, trigger: string) {
  return runSync(connection, "BACKFILL", trigger, async (accessToken) => {
    const athletePayload = await getAthlete(accessToken);
    const athlete = await upsertAthlete(connection.id, athletePayload);

    const activities = await listAthleteActivities(accessToken, {
      perPage: STRAVA_DEFAULT_PAGE_SIZE,
      maxPages: STRAVA_BACKFILL_MAX_PAGES,
    });

    return upsertActivities(connection.id, athlete.id, activities);
  });
}

export async function performIncrementalSync(
  connection: Connection,
  trigger: string
) {
  return runSync(connection, "INCREMENTAL", trigger, async (accessToken) => {
    const after = connection.lastSyncedAt
      ? Math.floor(connection.lastSyncedAt.getTime() / 1000)
      : undefined;

    const activities = await listAthleteActivities(accessToken, {
      after,
      perPage: STRAVA_DEFAULT_PAGE_SIZE,
      maxPages: STRAVA_BACKFILL_MAX_PAGES,
    });

    const athlete = await getAthlete(accessToken).then((payload) =>
      upsertAthlete(connection.id, payload)
    );

    return upsertActivities(connection.id, athlete.id, activities);
  });
}

async function resolveAthleteId(connection: Connection, accessToken: string) {
  const existing = await getAthleteByConnectionId(connection.id);
  if (existing) return existing.id;
  const payload = await getAthlete(accessToken);
  const athlete = await upsertAthlete(connection.id, payload);
  return athlete.id;
}

export async function performSingleActivitySync(
  connection: Connection,
  stravaActivityId: number,
  trigger: string
) {
  return runSync(connection, "SINGLE_ACTIVITY", trigger, async (accessToken) => {
    const athleteId = await resolveAthleteId(connection, accessToken);
    const payload = await getActivity(accessToken, stravaActivityId);
    return upsertActivities(connection.id, athleteId, [payload]);
  });
}

export async function performReconciliation(connection: Connection, trigger: string) {
  return runSync(connection, "RECONCILE", trigger, async (accessToken) => {
    const athleteId = await resolveAthleteId(connection, accessToken);

    const activities = await listAthleteActivities(accessToken, {
      perPage: STRAVA_DEFAULT_PAGE_SIZE,
      maxPages: STRAVA_RECONCILE_MAX_PAGES,
    });

    return upsertActivities(connection.id, athleteId, activities);
  });
}
