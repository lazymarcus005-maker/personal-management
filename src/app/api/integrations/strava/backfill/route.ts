import { auth } from "@/auth";
import { getConnectionByUserId } from "@/lib/strava/repository";
import { performBackfill } from "@/lib/strava/sync";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getConnectionByUserId(session.user.id);
  if (!connection) {
    return Response.json({ error: "Not connected" }, { status: 404 });
  }

  try {
    const result = await performBackfill(connection, "manual");
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
