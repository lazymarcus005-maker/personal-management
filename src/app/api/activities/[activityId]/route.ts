import { auth } from "@/auth";
import { getActivityForUser } from "@/lib/strava/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ activityId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activityId } = await params;
  const activity = await getActivityForUser(session.user.id, activityId);
  if (!activity) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ activity });
}
