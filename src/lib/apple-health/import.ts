import { APPLE_HEALTH_BATCH_SIZE, APPLE_HEALTH_MAX_RECORDS } from "./constants";
import {
  buildWorkoutEventsStreamData,
  normalizeSample,
  normalizeWorkout,
  type NormalizedSampleRow,
  type NormalizedWorkoutRow,
} from "./normalize";
import { AppleHealthStreamParser } from "./parser";
import {
  createImportJob,
  getOrCreateConnection,
  insertSampleBatch,
  insertWorkoutBatch,
  setImportJobStatus,
  updateConnectionAfterImport,
} from "./repository";
import { parseAppleHealthDate } from "./normalize";
import type { AppleHealthImportCounts } from "./types";

interface PendingWorkout {
  row: NormalizedWorkoutRow;
  streamData: unknown[] | null;
}

export interface RunImportOptions {
  trigger?: string;
  batchSize?: number;
  maxRecords?: number;
}

export interface RunImportResult extends AppleHealthImportCounts {
  jobId: string;
  connectionId: string;
}

async function* toAsyncIterable(
  input: string | AsyncIterable<string>
): AsyncIterable<string> {
  if (typeof input === "string") {
    yield input;
    return;
  }
  yield* input;
}

export async function runImport(
  userId: string,
  input: string | AsyncIterable<string>,
  options: RunImportOptions = {}
): Promise<RunImportResult> {
  const trigger = options.trigger ?? "manual";
  const batchSize = options.batchSize ?? APPLE_HEALTH_BATCH_SIZE;
  const maxRecords = options.maxRecords ?? APPLE_HEALTH_MAX_RECORDS;

  const connection = await getOrCreateConnection(userId);
  const job = await createImportJob(connection.id, trigger);
  await setImportJobStatus(job.id, "RUNNING");

  const counts: AppleHealthImportCounts = {
    workoutsInserted: 0,
    samplesInserted: 0,
    streamsInserted: 0,
    duplicatesSkipped: 0,
  };

  let sampleBatch: NormalizedSampleRow[] = [];
  let workoutBatch: PendingWorkout[] = [];

  const flushSamples = async () => {
    if (sampleBatch.length === 0) return;
    const rows = sampleBatch;
    sampleBatch = [];
    const outcome = await insertSampleBatch(rows);
    counts.samplesInserted += outcome.inserted;
    counts.duplicatesSkipped += outcome.duplicates;
  };

  const flushWorkouts = async () => {
    if (workoutBatch.length === 0) return;
    const pending = workoutBatch;
    workoutBatch = [];
    const rows = pending.map((p) => p.row);
    const streams = new Map<string, unknown[]>();
    for (const p of pending) {
      if (p.streamData) streams.set(p.row.dedupKey, p.streamData);
    }
    const outcome = await insertWorkoutBatch(rows, streams);
    counts.workoutsInserted += outcome.inserted;
    counts.duplicatesSkipped += outcome.duplicates;
    counts.streamsInserted += outcome.streamsInserted;
  };

  const parser = new AppleHealthStreamParser({
    onRecord: async (record) => {
      if (parser.stats.recordsSeen + parser.stats.workoutsSeen > maxRecords) {
        throw new Error(`Import exceeds maximum of ${maxRecords} records`);
      }
      sampleBatch.push(normalizeSample(connection.id, record));
      if (sampleBatch.length >= batchSize) await flushSamples();
    },
    onWorkout: async (workout) => {
      workoutBatch.push({
        row: normalizeWorkout(connection.id, workout),
        streamData: buildWorkoutEventsStreamData(workout),
      });
      if (workoutBatch.length >= batchSize) await flushWorkouts();
    },
  });

  try {
    for await (const chunk of toAsyncIterable(input)) {
      await parser.write(chunk);
    }
    await parser.end();
    await flushSamples();
    await flushWorkouts();

    const meta = parser.getMeta();
    await setImportJobStatus(job.id, "SUCCEEDED", counts);
    await updateConnectionAfterImport(connection.id, {
      status: "CONNECTED",
      deviceName: meta.deviceName ?? null,
      exportDate: parseAppleHealthDate(meta.exportDate),
      lastError: null,
    });

    return { jobId: job.id, connectionId: connection.id, ...counts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setImportJobStatus(job.id, "FAILED", { ...counts, error: message });
    await updateConnectionAfterImport(connection.id, {
      status: "ERROR",
      lastError: message,
    });
    throw err;
  }
}
