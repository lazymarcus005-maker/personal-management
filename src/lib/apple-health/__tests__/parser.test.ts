import { describe, expect, it } from "vitest";
import {
  AppleHealthStreamParser,
  decodeEntities,
  parseAppleHealthXml,
  parseAttributes,
} from "../parser";
import type {
  AppleHealthRawRecord,
  AppleHealthRawWorkout,
} from "../types";

describe("decodeEntities", () => {
  it("decodes named entities", () => {
    expect(decodeEntities("a &amp; b &lt; c &gt; d &quot; e &apos;")).toBe(
      'a & b < c > d " e \''
    );
  });

  it("decodes numeric entities", () => {
    expect(decodeEntities("&#65;&#x42;")).toBe("AB");
  });

  it("leaves unknown entities intact", () => {
    expect(decodeEntities("&nope;")).toBe("&nope;");
  });
});

describe("parseAttributes", () => {
  it("extracts quoted attributes", () => {
    const attrs = parseAttributes(
      'Record type="HKQuantityTypeIdentifierHeartRate" value="72" unit="count/min"'
    );
    expect(attrs.type).toBe("HKQuantityTypeIdentifierHeartRate");
    expect(attrs.value).toBe("72");
    expect(attrs.unit).toBe("count/min");
  });

  it("decodes entities inside attribute values", () => {
    const attrs = parseAttributes('Record sourceName="Tom &amp; Jerry"');
    expect(attrs.sourceName).toBe("Tom & Jerry");
  });
});

describe("AppleHealthStreamParser", () => {
  it("emits self-closing records", async () => {
    const records: AppleHealthRawRecord[] = [];
    await parseAppleHealthXml(
      '<HealthData><Record type="HKStepCount" value="120" unit="count" startDate="2024-01-01 08:00:00 +0700" endDate="2024-01-01 09:00:00 +0700"/></HealthData>',
      { onRecord: (r) => void records.push(r) }
    );
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("HKStepCount");
    expect(records[0].value).toBe("120");
  });

  it("collects metadata on container records", async () => {
    const records: AppleHealthRawRecord[] = [];
    await parseAppleHealthXml(
      '<HealthData><Record type="HKSleepAnalysis" startDate="2024-01-01 22:00:00 +0700">' +
        '<MetadataEntry key="HKSleepAnalysis" value="InBed"/>' +
        "</Record></HealthData>",
      { onRecord: (r) => void records.push(r) }
    );
    expect(records).toHaveLength(1);
    expect(records[0].metadata).toEqual({ HKSleepAnalysis: "InBed" });
  });

  it("collects workout events and metadata", async () => {
    const workouts: AppleHealthRawWorkout[] = [];
    await parseAppleHealthXml(
      '<HealthData><Workout workoutActivityType="HKWorkoutActivityTypeRunning" ' +
        'duration="30" durationUnit="min" totalDistance="5" totalDistanceUnit="km" ' +
        'startDate="2024-01-01 07:00:00 +0700" endDate="2024-01-01 07:30:00 +0700">' +
        '<MetadataEntry key="HKIndoorWorkout" value="0"/>' +
        '<WorkoutEvent type="HKWorkoutEventTypePause" date="2024-01-01 07:10:00 +0700"/>' +
        "</Workout></HealthData>",
      { onWorkout: (w) => void workouts.push(w) }
    );
    expect(workouts).toHaveLength(1);
    expect(workouts[0].workoutActivityType).toBe(
      "HKWorkoutActivityTypeRunning"
    );
    expect(workouts[0].metadata).toEqual({ HKIndoorWorkout: "0" });
    expect(workouts[0].events).toHaveLength(1);
    expect(workouts[0].events?.[0].type).toBe("HKWorkoutEventTypePause");
  });

  it("handles tags split across chunk boundaries", async () => {
    const records: AppleHealthRawRecord[] = [];
    const parser = new AppleHealthStreamParser({
      onRecord: (r) => void records.push(r),
    });
    await parser.write('<HealthData><Record type="HKStepCount" val');
    await parser.write('ue="42" unit="count"/></HealthData>');
    await parser.end();
    expect(records).toHaveLength(1);
    expect(records[0].value).toBe("42");
  });

  it("handles attribute values containing > inside quotes", async () => {
    const records: AppleHealthRawRecord[] = [];
    await parser_write(
      '<HealthData><Record type="HKNote" value="a > b" unit="x"/></HealthData>',
      records
    );
    expect(records).toHaveLength(1);
    expect(records[0].value).toBe("a > b");
  });

  it("captures export date and device into meta", async () => {
    const parser = new AppleHealthStreamParser({});
    await parser.write(
      '<HealthData locale="en_US"><ExportDate value="2024-02-01 10:00:00 +0700"/>' +
        '<Record type="HKStepCount" device="iPhone" value="1"/></HealthData>'
    );
    await parser.end();
    const meta = parser.getMeta();
    expect(meta.exportDate).toBe("2024-02-01 10:00:00 +0700");
    expect(meta.deviceName).toBe("iPhone");
  });

  it("tracks record and workout counts", async () => {
    const parser = new AppleHealthStreamParser({});
    await parser.write(
      "<HealthData>" +
        '<Record type="A" value="1"/>' +
        '<Record type="B" value="2"/>' +
        '<Workout workoutActivityType="HKWorkoutActivityTypeYoga" duration="10" durationUnit="min"></Workout>' +
        "</HealthData>"
    );
    await parser.end();
    expect(parser.stats.recordsSeen).toBe(2);
    expect(parser.stats.workoutsSeen).toBe(1);
  });
});

async function parser_write(
  xml: string,
  records: AppleHealthRawRecord[]
): Promise<void> {
  await parseAppleHealthXml(xml, { onRecord: (r) => void records.push(r) });
}
