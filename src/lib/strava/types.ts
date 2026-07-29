export type StravaConnectionStatus =
  | "PENDING"
  | "CONNECTED"
  | "EXPIRED"
  | "REVOKED"
  | "ERROR";

export type StravaSyncJobType =
  | "BACKFILL"
  | "INCREMENTAL"
  | "RECONCILE"
  | "SINGLE_ACTIVITY";

export type StravaSyncJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type StravaWebhookEventStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "IGNORED"
  | "FAILED";

export interface StravaTokenResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  athlete?: StravaAthletePayload;
}

export interface StravaRefreshTokenResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
}

export interface StravaAthletePayload {
  id: number;
  username?: string | null;
  resource_state?: number;
  firstname?: string | null;
  lastname?: string | null;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  sex?: string | null;
  premium?: boolean;
  summit?: boolean;
  created_at?: string;
  updated_at?: string;
  follower_count?: number | null;
  friend_count?: number | null;
  measurement_preference?: string | null;
  ftp?: number | null;
  weight?: number | null;
  clubs?: unknown[];
  bikes?: unknown[];
  shoes?: unknown[];
  profile?: string | null;
  profile_medium?: string | null;
}

export interface StravaActivitySummaryPayload {
  id: number;
  resource_state?: number;
  external_id?: string | null;
  athlete?: { id: number };
  name: string;
  distance?: number | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  total_elevation_gain?: number | null;
  type?: string | null;
  sport_type?: string | null;
  start_date?: string | null;
  start_date_local?: string | null;
  timezone?: string | null;
  utc_offset?: number | null;
  start_latlng?: number[] | null;
  end_latlng?: number[] | null;
  achievement_count?: number | null;
  kudos_count?: number | null;
  comment_count?: number | null;
  athlete_count?: number | null;
  photo_count?: number | null;
  total_photo_count?: number | null;
  map?: {
    id?: string;
    summary_polyline?: string | null;
    resource_state?: number;
  } | null;
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
  visibility?: string | null;
  flagged?: boolean;
  gear_id?: string | null;
  average_speed?: number | null;
  max_speed?: number | null;
  average_cadence?: number | null;
  average_temp?: number | null;
  average_watts?: number | null;
  weighted_average_watts?: number | null;
  max_watts?: number | null;
  kilojoules?: number | null;
  device_watts?: boolean;
  has_heartrate?: boolean;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  elev_high?: number | null;
  elev_low?: number | null;
  pr_count?: number | null;
  total_photo_count2?: number | null;
  has_kudoed?: boolean;
  suffer_score?: number | null;
  calories?: number | null;
}

export interface StravaActivityStreamPayload {
  type: string;
  data: unknown[];
  series_type?: string | null;
  original_size?: number | null;
  resolution?: string | null;
}

export interface StravaWebhookEventPayload {
  object_type: string;
  object_id: number;
  aspect_type: string;
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, unknown>;
}
