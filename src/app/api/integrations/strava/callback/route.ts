import { auth } from "@/auth";
import {
  STRAVA_CALLBACK_PATH,
  STRAVA_OAUTH_STATE_COOKIE,
} from "@/lib/strava/constants";
import { exchangeCode } from "@/lib/strava/oauth";
import {
  getConnectionByUserId,
  upsertConnectionFromToken,
} from "@/lib/strava/repository";
import { performBackfill } from "@/lib/strava/sync";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  const origin = request.nextUrl.origin;

  if (!session?.user?.id) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STRAVA_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(STRAVA_OAUTH_STATE_COOKIE);

  if (error) {
    return NextResponse.redirect(
      `${origin}/settings?strava=denied&reason=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      `${origin}/settings?strava=error&reason=invalid_state`
    );
  }

  try {
    const redirectUri = `${origin}${STRAVA_CALLBACK_PATH}`;
    const token = await exchangeCode(code, redirectUri);
    await upsertConnectionFromToken(session.user.id, token);

    const connection = await getConnectionByUserId(session.user.id);
    if (connection) {
      try {
        await performBackfill(connection, "oauth-callback");
      } catch {
        // Backfill failure should not block a successful connection.
      }
    }

    return NextResponse.redirect(`${origin}/settings?strava=connected`);
  } catch (err) {
    const reason =
      err instanceof Error ? encodeURIComponent(err.message) : "exchange_failed";
    return NextResponse.redirect(
      `${origin}/settings?strava=error&reason=${reason}`
    );
  }
}
