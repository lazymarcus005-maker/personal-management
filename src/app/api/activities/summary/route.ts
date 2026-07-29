import { auth } from "@/auth";
import { getActivitySummaryForUser } from "@/lib/strava/repository";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getActivitySummaryForUser(session.user.id);
  return Response.json({ summary });
}
