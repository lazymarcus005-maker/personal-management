import { auth } from "@/auth";
import { getDb } from "@/db";
import { areas, projects } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { ExploreClient } from "@/components/explore/explore-client";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;
  const db = await getDb();

  const [areaRows, projectRows] = await Promise.all([
    db
      .select()
      .from(areas)
      .where(and(eq(areas.userId, userId), isNull(areas.archivedAt)))
      .orderBy(areas.name),
    db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(projects.name),
  ]);

  return (
    <ExploreClient
      areas={areaRows.map((a) => a.name)}
      projects={projectRows.map((p) => p.name)}
    />
  );
}
