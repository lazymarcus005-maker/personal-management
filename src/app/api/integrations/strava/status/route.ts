import { auth } from "@/auth";
import {
  getActivitySummaryForUser,
  getAthleteByConnectionId,
  getConnectionByUserId,
  getLatestSyncJob,
} from "@/lib/strava/repository";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getConnectionByUserId(session.user.id);
  if (!connection) {
    return Response.json({ connected: false, status: null });
  }

  const [athlete, latestJob, summary] = await Promise.all([
    getAthleteByConnectionId(connection.id),
    getLatestSyncJob(connection.id),
    getActivitySummaryForUser(session.user.id),
  ]);

  return Response.json({
    connected: connection.status === "CONNECTED",
    connection: {
      id: connection.id,
      status: connection.status,
      scopes: connection.scopes,
      lastSyncedAt: connection.lastSyncedAt,
      lastError: connection.lastError,
    },
    athlete: athlete
      ? {
          stravaAthleteId: athlete.stravaAthleteId,
          username: athlete.username,
          firstname: athlete.firstname,
          lastname: athlete.lastname,
          profile: athlete.profile,
        }
      : null,
    latestJob: latestJob
      ? {
          type: latestJob.type,
          status: latestJob.status,
          activitiesProcessed: latestJob.activitiesProcessed,
          startedAt: latestJob.startedAt,
          finishedAt: latestJob.finishedAt,
          error: latestJob.error,
        }
      : null,
    summary,
  });
}
