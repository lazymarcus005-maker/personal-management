export const STRAVA_OAUTH_AUTHORIZE_URL =
  "https://www.strava.com/oauth/authorize";

export const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

export const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export const STRAVA_DEAUTHORIZE_URL =
  "https://www.strava.com/oauth/deauthorize";

export const STRAVA_SCOPE = "read,activity:read_all";

export const STRAVA_CALLBACK_PATH = "/api/integrations/strava/callback";

export const STRAVA_WEBHOOK_PATH = "/api/integrations/strava/webhook";

export const STRAVA_OAUTH_STATE_COOKIE = "strava_oauth_state";

export const STRAVA_STATE_COOKIE_MAX_AGE = 10 * 60;

export const STRAVA_DEFAULT_PAGE_SIZE = 100;

export const STRAVA_MAX_PAGE_SIZE = 200;

export const STRAVA_BACKFILL_MAX_PAGES = 20;

export const STRAVA_RECONCILE_MAX_PAGES = 10;

export const STRAVA_WEBHOOK_RETRY_LIMIT = 25;

export const STRAVA_RECONCILE_BATCH_LIMIT = 25;

export function getStravaClientId(): string {
  const id = process.env.STRAVA_CLIENT_ID;
  if (!id) throw new Error("STRAVA_CLIENT_ID environment variable is not set");
  return id;
}

export function getStravaClientSecret(): string {
  const secret = process.env.STRAVA_CLIENT_SECRET;
  if (!secret)
    throw new Error("STRAVA_CLIENT_SECRET environment variable is not set");
  return secret;
}

export function getStravaVerifyToken(): string {
  return process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? "";
}
