import { createHash } from "crypto";
import type {
  AppleHealthRawRecord,
  AppleHealthRawWorkout,
} from "./types";

const AH_DATE_RE =
  /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.\d+)? ([+-])(\d{2}):?(\d{2})$/;

export function parseAppleHealthDate(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = AH_DATE_RE.exec(trimmed);
  if (match) {
    const [, date, time, sign, offH, offM] = match;
    const iso = `${date}T${time}${sign}${offH}:${offM}`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function parseReal(value?: string | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hash(parts: Array<string | null | undefined>): string {
  return createHash("sha256")
    .update(parts.map((p) => p ?? "").join("|"))
    .digest("hex");
}

export function computeSampleDedupKey(
  connectionId: string,
  record: AppleHealthRawRecord
): string {
  return hash([
    "sample",
    connectionId,
    record.type,
    record.startDate,
    record.endDate,
    record.value,
    record.unit,
    record.sourceName,
  ]);
}

export function computeWorkoutDedupKey(
  connectionId: string,
  workout: AppleHealthRawWorkout
): string {
  return hash([
    "workout",
    connectionId,
    workout.workoutActivityType,
    workout.startDate,
    workout.endDate,
    workout.duration,
    workout.totalDistance,
    workout.totalEnergyBurned,
  ]);
}

export interface NormalizedSampleRow {
  connectionId: string;
  dedupKey: string;
  recordType: string;
  startDate: Date | null;
  endDate: Date | null;
  value: number | null;
  unit: string | null;
  sourceName: string | null;
  sourceVersion: string | null;
  deviceName: string | null;
  creationDate: Date | null;
  metadata: Record<string, string> | null;
  rawPayload: AppleHealthRawRecord;
}

export function normalizeSample(
  connectionId: string,
  record: AppleHealthRawRecord
): NormalizedSampleRow {
  return {
    connectionId,
    dedupKey: computeSampleDedupKey(connectionId, record),
    recordType: record.type,
    startDate: parseAppleHealthDate(record.startDate),
    endDate: parseAppleHealthDate(record.endDate),
    value: parseReal(record.value),
    unit: record.unit ?? null,
    sourceName: record.sourceName ?? null,
    sourceVersion: record.sourceVersion ?? null,
    deviceName: record.device ?? null,
    creationDate: parseAppleHealthDate(record.creationDate),
    metadata: record.metadata && Object.keys(record.metadata).length
      ? record.metadata
      : null,
    rawPayload: record,
  };
}

export interface NormalizedWorkoutRow {
  connectionId: string;
  dedupKey: string;
  activityType: string;
  startDate: Date | null;
  endDate: Date | null;
  duration: number | null;
  durationUnit: string | null;
  totalDistance: number | null;
  distanceUnit: string | null;
  totalEnergyBurned: number | null;
  energyUnit: string | null;
  sourceName: string | null;
  sourceVersion: string | null;
  deviceName: string | null;
  creationDate: Date | null;
  metadata: Record<string, string> | null;
  rawPayload: AppleHealthRawWorkout;
}

export function normalizeWorkout(
  connectionId: string,
  workout: AppleHealthRawWorkout
): NormalizedWorkoutRow {
  return {
    connectionId,
    dedupKey: computeWorkoutDedupKey(connectionId, workout),
    activityType: workout.workoutActivityType,
    startDate: parseAppleHealthDate(workout.startDate),
    endDate: parseAppleHealthDate(workout.endDate),
    duration: parseReal(workout.duration),
    durationUnit: workout.durationUnit ?? null,
    totalDistance: parseReal(workout.totalDistance),
    distanceUnit: workout.totalDistanceUnit ?? null,
    totalEnergyBurned: parseReal(workout.totalEnergyBurned),
    energyUnit: workout.totalEnergyBurnedUnit ?? null,
    sourceName: workout.sourceName ?? null,
    sourceVersion: workout.sourceVersion ?? null,
    deviceName: workout.device ?? null,
    creationDate: parseAppleHealthDate(workout.creationDate),
    metadata: workout.metadata && Object.keys(workout.metadata).length
      ? workout.metadata
      : null,
    rawPayload: workout,
  };
}

export const WORKOUT_EVENTS_STREAM_TYPE = "workout_events";

export function buildWorkoutEventsStreamData(
  workout: AppleHealthRawWorkout
): unknown[] | null {
  if (!workout.events || workout.events.length === 0) return null;
  return workout.events.map((event) => ({
    type: event.type,
    date: parseAppleHealthDate(event.date)?.toISOString() ?? null,
    duration: parseReal(event.duration),
    durationUnit: event.durationUnit ?? null,
  }));
}
