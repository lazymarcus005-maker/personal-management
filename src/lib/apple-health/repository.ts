import { db } from "@/db";
import {
  appleHealthConnections,
  appleHealthImportJobs,
  appleHealthSamples,
  appleHealthWorkoutStreams,
  appleHealthWorkouts,
} from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  WORKOUT_EVENTS_STREAM_TYPE,
  buildWorkoutEventsStreamData,
} from "./normalize";
import type {
  AppleHealthImportCounts,
  AppleHealthImportJobStatus,
} from "./types";

export async function getConnectionByUserId(userId: string) {
  const [connection] = await db
    .select()
    .from(appleHealthConnections)
    .where(eq(appleHealthConnections.userId, userId))
    .limit(1);
  return connection ?? null;
}

export async function getOrCreateConnection(userId: string) {
  const existing = await getConnectionByUserId(userId);
  if (existing) return existing;

  const [connection] = await db
    .insert(appleHealthConnections)
    .values({ userId, status: "PENDING" })
    .onConflictDoNothing({ target: appleHealthConnections.userId })
    .returning();

  return connection ?? (await getConnectionByUserId(userId))!;
}

export async function updateConnectionAfterImport(
  connectionId: string,
  fields: {
    status?: "CONNECTED" | "ERROR";
    deviceName?: string | null;
    exportDate?: Date | null;
    lastError?: string | null;
  }
) {
  const [connection] = await db
    .update(appleHealthConnections)
    .set({
      status: fields.status,
      deviceName: fields.deviceName,
      exportDate: fields.exportDate,
      lastError: fields.lastError ?? null,
      lastImportedAt: fields.status === "CONNECTED" ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(appleHealthConnections.id, connectionId))
    .returning();
  return connection;
}

export async function createImportJob(connectionId: string, trigger: string) {
  const [job] = await db
    .insert(appleHealthImportJobs)
    .values({ connectionId, status: "QUEUED", trigger })
    .returning();
  return job;
}

export async function setImportJobStatus(
  jobId: string,
  status: AppleHealthImportJobStatus,
  counts: Partial<AppleHealthImportCounts> & { error?: string } = {}
) {
  const now = new Date();
  const [job] = await db
    .update(appleHealthImportJobs)
    .set({
      status,
      startedAt: status === "RUNNING" ? now : undefined,
      finishedAt:
        status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED"
          ? now
          : undefined,
      workoutsInserted: counts.workoutsInserted,
      samplesInserted: counts.samplesInserted,
      streamsInserted: counts.streamsInserted,
      duplicatesSkipped: counts.duplicatesSkipped,
      error: counts.error ?? null,
    })
    .where(eq(appleHealthImportJobs.id, jobId))
    .returning();
  return job;
}

export async function getLatestImportJob(connectionId: string) {
  const [job] = await db
    .select()
    .from(appleHealthImportJobs)
    .where(eq(appleHealthImportJobs.connectionId, connectionId))
    .orderBy(desc(appleHealthImportJobs.createdAt))
    .limit(1);
  return job ?? null;
}

type SampleInsertRow = typeof appleHealthSamples.$inferInsert;
type WorkoutInsertRow = typeof appleHealthWorkouts.$inferInsert;

export interface BatchInsertOutcome {
  inserted: number;
  duplicates: number;
}

export async function insertSampleBatch(
  rows: SampleInsertRow[]
): Promise<BatchInsertOutcome> {
  if (rows.length === 0) return { inserted: 0, duplicates: 0 };
  const inserted = await db
    .insert(appleHealthSamples)
    .values(rows)
    .onConflictDoNothing({ target: appleHealthSamples.dedupKey })
    .returning({ id: appleHealthSamples.id });
  return { inserted: inserted.length, duplicates: rows.length - inserted.length };
}

export interface WorkoutStreamInput {
  dedupKey: string;
  data: unknown[];
}

export interface WorkoutBatchResult extends BatchInsertOutcome {
  streamsInserted: number;
}

export async function insertWorkoutBatch(
  rows: WorkoutInsertRow[],
  streamsByDedupKey: Map<string, unknown[]>
): Promise<WorkoutBatchResult> {
  if (rows.length === 0) {
    return { inserted: 0, duplicates: 0, streamsInserted: 0 };
  }

  const inserted = await db
    .insert(appleHealthWorkouts)
    .values(rows)
    .onConflictDoNothing({ target: appleHealthWorkouts.dedupKey })
    .returning({
      id: appleHealthWorkouts.id,
      dedupKey: appleHealthWorkouts.dedupKey,
    });

  const idByDedupKey = new Map<string, string>(
    inserted.map((r) => [r.dedupKey, r.id])
  );

  const missing = rows
    .map((r) => r.dedupKey)
    .filter((key) => !idByDedupKey.has(key));

  if (missing.length > 0) {
    const existing = await db
      .select({
        id: appleHealthWorkouts.id,
        dedupKey: appleHealthWorkouts.dedupKey,
      })
      .from(appleHealthWorkouts)
      .where(inArray(appleHealthWorkouts.dedupKey, missing));
    for (const row of existing) {
      idByDedupKey.set(row.dedupKey, row.id);
    }
  }

  let streamsInserted = 0;
  const streamRows = [];
  for (const [dedupKey, data] of streamsByDedupKey) {
    const workoutId = idByDedupKey.get(dedupKey);
    if (!workoutId) continue;
    streamRows.push({
      workoutId,
      streamType: WORKOUT_EVENTS_STREAM_TYPE,
      data,
    });
  }

  if (streamRows.length > 0) {
    const insertedStreams = await db
      .insert(appleHealthWorkoutStreams)
      .values(streamRows)
      .onConflictDoNothing({
        target: [
          appleHealthWorkoutStreams.workoutId,
          appleHealthWorkoutStreams.streamType,
        ],
      })
      .returning({ id: appleHealthWorkoutStreams.id });
    streamsInserted = insertedStreams.length;
  }

  return {
    inserted: inserted.length,
    duplicates: rows.length - inserted.length,
    streamsInserted,
  };
}

export { buildWorkoutEventsStreamData };

export async function listWorkoutsForUser(
  userId: string,
  params: { limit?: number; offset?: number; activityType?: string } = {}
) {
  const connection = await getConnectionByUserId(userId);
  if (!connection) return [];

  const limit = Math.min(params.limit ?? 30, 100);
  const offset = params.offset ?? 0;

  const conditions = [
    eq(appleHealthWorkouts.connectionId, connection.id),
  ];
  if (params.activityType) {
    conditions.push(
      eq(appleHealthWorkouts.activityType, params.activityType)
    );
  }

  return db
    .select()
    .from(appleHealthWorkouts)
    .where(and(...conditions))
    .orderBy(desc(appleHealthWorkouts.startDate))
    .limit(limit)
    .offset(offset);
}
