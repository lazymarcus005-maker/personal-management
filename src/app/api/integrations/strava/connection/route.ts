import { auth } from "@/auth";
import {
  disconnectConnection,
  getConnectionByUserId,
} from "@/lib/strava/repository";

function serializeConnection(connection: {
  id: string;
  stravaAthleteId: number;
  status: string;
  scopes: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  disconnectedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: connection.id,
    stravaAthleteId: connection.stravaAthleteId,
    status: connection.status,
    scopes: connection.scopes,
    lastSyncedAt: connection.lastSyncedAt,
    lastError: connection.lastError,
    disconnectedAt: connection.disconnectedAt,
    createdAt: connection.createdAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getConnectionByUserId(session.user.id);
  if (!connection) {
    return Response.json({ connected: false, connection: null });
  }

  return Response.json({
    connected: connection.status === "CONNECTED",
    connection: serializeConnection(connection),
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getConnectionByUserId(session.user.id);
  if (!connection) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await disconnectConnection(connection.id);
  return Response.json({ connected: false });
}
