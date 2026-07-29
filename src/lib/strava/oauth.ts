import {
  STRAVA_DEAUTHORIZE_URL,
  STRAVA_OAUTH_AUTHORIZE_URL,
  STRAVA_SCOPE,
  STRAVA_TOKEN_URL,
  getStravaClientId,
  getStravaClientSecret,
} from "./constants";
import type {
  StravaRefreshTokenResponse,
  StravaTokenResponse,
} from "./types";

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: getStravaClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: STRAVA_SCOPE,
    state,
    approval_prompt: "auto",
  });
  return `${STRAVA_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<StravaTokenResponse> {
  const body = new URLSearchParams({
    client_id: getStravaClientId(),
    client_secret: getStravaClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token exchange failed (${res.status}): ${text}`);
  }

  return (await res.json()) as StravaTokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<StravaRefreshTokenResponse> {
  const body = new URLSearchParams({
    client_id: getStravaClientId(),
    client_secret: getStravaClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token refresh failed (${res.status}): ${text}`);
  }

  return (await res.json()) as StravaRefreshTokenResponse;
}

export async function deauthorize(accessToken: string): Promise<void> {
  const res = await fetch(STRAVA_DEAUTHORIZE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava deauthorize failed (${res.status}): ${text}`);
  }
}
