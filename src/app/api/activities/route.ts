import { auth } from "@/auth";
import { listActivitiesForUser } from "@/lib/strava/repository";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const limit = params.get("limit")
    ? Number.parseInt(params.get("limit")!, 10)
    : undefined;
  const offset = params.get("offset")
    ? Number.parseInt(params.get("offset")!, 10)
    : undefined;
  const sportType = params.get("sportType") ?? undefined;

  const activities = await listActivitiesForUser(session.user.id, {
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
    sportType,
  });

  return Response.json({ activities });
}
