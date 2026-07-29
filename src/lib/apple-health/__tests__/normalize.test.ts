import { describe, expect, it } from "vitest";
import {
  buildWorkoutEventsStreamData,
  computeSampleDedupKey,
  computeWorkoutDedupKey,
  normalizeSample,
  normalizeWorkout,
  parseAppleHealthDate,
  parseReal,
} from "../normalize";
import type {
  AppleHealthRawRecord,
  AppleHealthRawWorkout,
} from "../types";

describe("parseAppleHealthDate", () => {
  it("parses positive offset without colon", () => {
    const d = parseAppleHealthDate("2024-01-15 08:00:00 +0700");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2024-01-15T01:00:00.000Z");
  });

  it("parses negative offset", () => {
    const d = parseAppleHealthDate("2024-01-15 08:00:00 -0500");
    expect(d!.toISOString()).toBe("2024-01-15T13:00:00.000Z");
  });

  it("parses offset with colon", () => {
    const d = parseAppleHealthDate("2024-01-15 08:00:00 +07:00");
    expect(d!.toISOString()).toBe("2024-01-15T01:00:00.000Z");
  });

  it("returns null for empty or invalid input", () => {
    expect(parseAppleHealthDate(null)).toBeNull();
    expect(parseAppleHealthDate("")).toBeNull();
    expect(parseAppleHealthDate("not a date")).toBeNull();
  });
});

describe("parseReal", () => {
  it("parses valid numbers", () => {
    expect(parseReal("72")).toBe(72);
    expect(parseReal("5.25")).toBe(5.25);
    expect(parseReal("-3")).toBe(-3);
  });

  it("returns null for non-numeric input", () => {
    expect(parseReal(null)).toBeNull();
    expect(parseReal("")).toBeNull();
    expect(parseReal("abc")).toBeNull();
  });
});

const baseRecord: AppleHealthRawRecord = {
  type: "HKQuantityTypeIdentifierHeartRate",
  startDate: "2024-01-15 08:00:00 +0700",
  endDate: "2024-01-15 08:00:05 +0700",
  value: "72",
  unit: "count/min",
  sourceName: "Apple Watch",
};

describe("dedup keys", () => {
  it("is stable for identical records", () => {
    const a = computeSampleDedupKey("conn-1", baseRecord);
    const b = computeSampleDedupKey("conn-1", { ...baseRecord });
    expect(a).toBe(b);
  });

  it("differs when the value changes", () => {
    const a = computeSampleDedupKey("conn-1", baseRecord);
    const b = computeSampleDedupKey("conn-1", { ...baseRecord, value: "80" });
    expect(a).not.toBe(b);
  });

  it("differs across connections", () => {
    const a = computeSampleDedupKey("conn-1", baseRecord);
    const b = computeSampleDedupKey("conn-2", baseRecord);
    expect(a).not.toBe(b);
  });

  it("produces a 64-char hex hash", () => {
    expect(computeSampleDedupKey("conn-1", baseRecord)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("normalizeSample", () => {
  it("maps raw record to a row shape", () => {
    const row = normalizeSample("conn-1", baseRecord);
    expect(row.connectionId).toBe("conn-1");
    expect(row.recordType).toBe("HKQuantityTypeIdentifierHeartRate");
    expect(row.value).toBe(72);
    expect(row.unit).toBe("count/min");
    expect(row.startDate?.toISOString()).toBe("2024-01-15T01:00:00.000Z");
    expect(row.metadata).toBeNull();
    expect(row.dedupKey).toMatch(/^[0-9a-f]{64}$/);
  });
});

const baseWorkout: AppleHealthRawWorkout = {
  workoutActivityType: "HKWorkoutActivityTypeRunning",
  startDate: "2024-01-15 07:00:00 +0700",
  endDate: "2024-01-15 07:30:00 +0700",
  duration: "30",
  durationUnit: "min",
  totalDistance: "5",
  totalDistanceUnit: "km",
  totalEnergyBurned: "300",
  totalEnergyBurnedUnit: "kcal",
  sourceName: "Apple Watch",
};

describe("normalizeWorkout", () => {
  it("maps raw workout to a row shape", () => {
    const row = normalizeWorkout("conn-1", baseWorkout);
    expect(row.activityType).toBe("HKWorkoutActivityTypeRunning");
    expect(row.duration).toBe(30);
    expect(row.totalDistance).toBe(5);
    expect(row.totalEnergyBurned).toBe(300);
    expect(row.energyUnit).toBe("kcal");
  });

  it("keeps workout dedup keys distinct from sample keys", () => {
    const workoutKey = computeWorkoutDedupKey("conn-1", baseWorkout);
    const sampleKey = computeSampleDedupKey("conn-1", baseRecord);
    expect(workoutKey).not.toBe(sampleKey);
  });
});

describe("buildWorkoutEventsStreamData", () => {
  it("returns null when there are no events", () => {
    expect(buildWorkoutEventsStreamData(baseWorkout)).toBeNull();
  });

  it("maps events with parsed dates", () => {
    const data = buildWorkoutEventsStreamData({
      ...baseWorkout,
      events: [
        {
          type: "HKWorkoutEventTypePause",
          date: "2024-01-15 07:10:00 +0700",
        },
      ],
    });
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      type: "HKWorkoutEventTypePause",
      date: "2024-01-15T00:10:00.000Z",
    });
  });
});
