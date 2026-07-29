import { STRAVA_API_BASE } from "./constants";
import type {
  StravaActivitySummaryPayload,
  StravaAthletePayload,
} from "./types";

export class StravaApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StravaApiError";
    this.status = status;
  }
}

async function stravaFetch<T>(
  path: string,
  accessToken: string,
  query?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${STRAVA_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new StravaApiError(
      `Strava API ${path} failed (${res.status}): ${text}`,
      res.status
    );
  }

  return (await res.json()) as T;
}

export function getAthlete(accessToken: string): Promise<StravaAthletePayload> {
  return stravaFetch<StravaAthletePayload>("/athlete", accessToken);
}

export function getActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivitySummaryPayload> {
  return stravaFetch<StravaActivitySummaryPayload>(
    `/activities/${activityId}`,
    accessToken
  );
}

export interface ListActivitiesOptions {
  before?: number;
  after?: number;
  perPage?: number;
  maxPages?: number;
}

export async function listAthleteActivities(
  accessToken: string,
  options: ListActivitiesOptions = {}
): Promise<StravaActivitySummaryPayload[]> {
  const perPage = options.perPage ?? 100;
  const maxPages = options.maxPages ?? 20;
  const all: StravaActivitySummaryPayload[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const batch = await stravaFetch<StravaActivitySummaryPayload[]>(
      "/athlete/activities",
      accessToken,
      {
        page,
        per_page: perPage,
        before: options.before,
        after: options.after,
      }
    );
    all.push(...batch);
    if (batch.length < perPage) break;
  }

  return all;
}
