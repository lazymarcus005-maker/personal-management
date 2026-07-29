import type {
  AppleHealthExportMeta,
  AppleHealthRawRecord,
  AppleHealthRawWorkout,
  AppleHealthRawWorkoutEvent,
} from "./types";

export interface ParserCallbacks {
  onMeta?: (meta: AppleHealthExportMeta) => void;
  onRecord?: (record: AppleHealthRawRecord) => void | Promise<void>;
  onWorkout?: (workout: AppleHealthRawWorkout) => void | Promise<void>;
}

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return ENTITY_MAP[body] ?? match;
  });
}

const ATTR_RE = /([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g;

export function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(tag)) !== null) {
    attrs[m[1]] = decodeEntities(m[2]);
  }
  return attrs;
}

function splitTagName(tag: string): { name: string; selfClosing: boolean } {
  const trimmed = tag.trim();
  const selfClosing = trimmed.endsWith("/");
  const body = selfClosing ? trimmed.slice(0, -1) : trimmed;
  const spaceIdx = body.search(/\s/);
  const name = spaceIdx === -1 ? body : body.slice(0, spaceIdx);
  return { name, selfClosing };
}

export class AppleHealthStreamParser {
  private buffer = "";
  private currentRecord: AppleHealthRawRecord | null = null;
  private currentWorkout: AppleHealthRawWorkout | null = null;
  private metaEmitted = false;
  private readonly meta: AppleHealthExportMeta = {};
  readonly stats = { recordsSeen: 0, workoutsSeen: 0 };

  constructor(private readonly callbacks: ParserCallbacks = {}) {}

  getMeta(): AppleHealthExportMeta {
    return { ...this.meta };
  }

  async write(chunk: string): Promise<void> {
    this.buffer += chunk;
    await this.drain();
  }

  async end(): Promise<void> {
    await this.drain();
    if (this.currentRecord) {
      await this.emitRecord(this.currentRecord);
      this.currentRecord = null;
    }
    if (this.currentWorkout) {
      await this.emitWorkout(this.currentWorkout);
      this.currentWorkout = null;
    }
  }

  private async drain(): Promise<void> {
    while (true) {
      const lt = this.buffer.indexOf("<");
      if (lt === -1) {
        this.buffer = "";
        return;
      }
      if (lt > 0) {
        this.buffer = this.buffer.slice(lt);
      }
      const gt = this.findTagEnd(this.buffer);
      if (gt === -1) {
        return;
      }
      const tagContent = this.buffer.slice(1, gt);
      this.buffer = this.buffer.slice(gt + 1);
      if (tagContent.startsWith("?") || tagContent.startsWith("!")) {
        continue;
      }
      await this.handleTag(tagContent);
    }
  }

  private findTagEnd(buf: string): number {
    let quote: string | null = null;
    for (let i = 1; i < buf.length; i++) {
      const ch = buf[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === ">") {
        return i;
      }
    }
    return -1;
  }

  private async handleTag(tag: string): Promise<void> {
    if (tag.startsWith("/")) {
      await this.handleClose(tag.slice(1).trim());
      return;
    }
    const { name, selfClosing } = splitTagName(tag);
    const attrs = parseAttributes(tag);

    switch (name) {
      case "ExportDate":
        this.meta.exportDate = attrs.value ?? null;
        this.emitMetaOnce();
        break;
      case "Record": {
        const record = this.toRecord(attrs);
        if (selfClosing) {
          await this.emitRecord(record);
        } else {
          this.currentRecord = record;
        }
        break;
      }
      case "Workout": {
        const workout = this.toWorkout(attrs);
        if (selfClosing) {
          await this.emitWorkout(workout);
        } else {
          this.currentWorkout = workout;
        }
        break;
      }
      case "WorkoutEvent": {
        if (this.currentWorkout) {
          const event = this.toWorkoutEvent(attrs);
          this.currentWorkout.events ??= [];
          this.currentWorkout.events.push(event);
        }
        break;
      }
      case "MetadataEntry": {
        const key = attrs.key;
        const value = attrs.value ?? "";
        if (key === undefined) break;
        if (this.currentWorkout) {
          this.currentWorkout.metadata ??= {};
          this.currentWorkout.metadata[key] = value;
        } else if (this.currentRecord) {
          this.currentRecord.metadata ??= {};
          this.currentRecord.metadata[key] = value;
        }
        break;
      }
      default:
        break;
    }
  }

  private async handleClose(name: string): Promise<void> {
    if (name === "Record" && this.currentRecord) {
      await this.emitRecord(this.currentRecord);
      this.currentRecord = null;
    } else if (name === "Workout" && this.currentWorkout) {
      await this.emitWorkout(this.currentWorkout);
      this.currentWorkout = null;
    }
  }

  private toRecord(attrs: Record<string, string>): AppleHealthRawRecord {
    if (attrs.device && !this.meta.deviceName) {
      this.meta.deviceName = attrs.device;
    }
    this.stats.recordsSeen += 1;
    return {
      type: attrs.type ?? "",
      sourceName: attrs.sourceName ?? null,
      sourceVersion: attrs.sourceVersion ?? null,
      device: attrs.device ?? null,
      startDate: attrs.startDate ?? null,
      endDate: attrs.endDate ?? null,
      value: attrs.value ?? null,
      unit: attrs.unit ?? null,
      creationDate: attrs.creationDate ?? null,
    };
  }

  private toWorkout(attrs: Record<string, string>): AppleHealthRawWorkout {
    if (attrs.device && !this.meta.deviceName) {
      this.meta.deviceName = attrs.device;
    }
    this.stats.workoutsSeen += 1;
    return {
      workoutActivityType: attrs.workoutActivityType ?? "",
      startDate: attrs.startDate ?? null,
      endDate: attrs.endDate ?? null,
      duration: attrs.duration ?? null,
      durationUnit: attrs.durationUnit ?? null,
      totalDistance: attrs.totalDistance ?? null,
      totalDistanceUnit: attrs.totalDistanceUnit ?? null,
      totalEnergyBurned: attrs.totalEnergyBurned ?? null,
      totalEnergyBurnedUnit: attrs.totalEnergyBurnedUnit ?? null,
      sourceName: attrs.sourceName ?? null,
      sourceVersion: attrs.sourceVersion ?? null,
      device: attrs.device ?? null,
      creationDate: attrs.creationDate ?? null,
    };
  }

  private toWorkoutEvent(
    attrs: Record<string, string>
  ): AppleHealthRawWorkoutEvent {
    return {
      type: attrs.type ?? "",
      date: attrs.date ?? null,
      duration: attrs.duration ?? null,
      durationUnit: attrs.durationUnit ?? null,
    };
  }

  private emitMetaOnce(): void {
    if (this.metaEmitted) return;
    this.metaEmitted = true;
    this.callbacks.onMeta?.({ ...this.meta });
  }

  private async emitRecord(record: AppleHealthRawRecord): Promise<void> {
    await this.callbacks.onRecord?.(record);
  }

  private async emitWorkout(workout: AppleHealthRawWorkout): Promise<void> {
    await this.callbacks.onWorkout?.(workout);
  }
}

export async function parseAppleHealthXml(
  xml: string,
  callbacks: ParserCallbacks
): Promise<void> {
  const parser = new AppleHealthStreamParser(callbacks);
  await parser.write(xml);
  await parser.end();
}
