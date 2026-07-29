import { auth } from "@/auth";
import { buildAuthorizeUrl } from "@/lib/strava/oauth";
import {
  STRAVA_CALLBACK_PATH,
  STRAVA_OAUTH_STATE_COOKIE,
  STRAVA_STATE_COOKIE_MAX_AGE,
} from "@/lib/strava/constants";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${request.nextUrl.origin}${STRAVA_CALLBACK_PATH}`;
  const url = buildAuthorizeUrl(redirectUri, state);

  const cookieStore = await cookies();
  cookieStore.set(STRAVA_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STRAVA_STATE_COOKIE_MAX_AGE,
  });

  return Response.json({ url });
}
