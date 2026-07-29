export interface AppleHealthRawRecord {
  type: string;
  sourceName?: string | null;
  sourceVersion?: string | null;
  device?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  value?: string | null;
  unit?: string | null;
  creationDate?: string | null;
  metadata?: Record<string, string>;
}

export interface AppleHealthRawWorkoutEvent {
  type: string;
  date?: string | null;
  duration?: string | null;
  durationUnit?: string | null;
  metadata?: Record<string, string>;
}

export interface AppleHealthRawWorkout {
  workoutActivityType: string;
  startDate?: string | null;
  endDate?: string | null;
  duration?: string | null;
  durationUnit?: string | null;
  totalDistance?: string | null;
  totalDistanceUnit?: string | null;
  totalEnergyBurned?: string | null;
  totalEnergyBurnedUnit?: string | null;
  sourceName?: string | null;
  sourceVersion?: string | null;
  device?: string | null;
  creationDate?: string | null;
  metadata?: Record<string, string>;
  events?: AppleHealthRawWorkoutEvent[];
}

export interface AppleHealthExportMeta {
  exportDate?: string | null;
  deviceName?: string | null;
}

export interface AppleHealthParseResult {
  meta: AppleHealthExportMeta;
  workouts: AppleHealthRawWorkout[];
  samples: AppleHealthRawRecord[];
  stats: {
    recordsSeen: number;
    workoutsSeen: number;
  };
}

export type AppleHealthImportJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export interface AppleHealthImportCounts {
  workoutsInserted: number;
  samplesInserted: number;
  streamsInserted: number;
  duplicatesSkipped: number;
}
