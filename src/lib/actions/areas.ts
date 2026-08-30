"use server";

import { requireUserId } from "@/lib/guards";
import { getDb } from "@/db";
import { areas, projects, goals, todos, notes } from "@/db/schema";
import { eq, and, isNull, asc, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const areaSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
});

export async function getAreas(includeArchived = false) {
  const userId = await requireUserId();
  const db = await getDb();

  const conditions = [eq(areas.userId, userId)];
  if (!includeArchived) conditions.push(isNull(areas.archivedAt));

  return db
    .select()
    .from(areas)
    .where(and(...conditions))
    .orderBy(asc(areas.sortOrder), asc(areas.name));
}

export async function createArea(data: z.infer<typeof areaSchema>) {
  const userId = await requireUserId();
  const db = await getDb();
  const parsed = areaSchema.parse(data);

  const [area] = await db
    .insert(areas)
    .values({ userId, ...parsed })
    .returning();

  revalidatePath("/projects");
  return area;
}

export async function updateArea(
  id: string,
  data: Partial<z.infer<typeof areaSchema>>
) {
  const userId = await requireUserId();
  const db = await getDb();

  const [area] = await db
    .update(areas)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(areas.id, id), eq(areas.userId, userId)))
    .returning();

  revalidatePath("/projects");
  return area;
}

export async function archiveArea(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const [area] = await db
    .update(areas)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(areas.id, id), eq(areas.userId, userId)))
    .returning();

  revalidatePath("/projects");
  return area;
}

export async function unarchiveArea(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const [area] = await db
    .update(areas)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(areas.id, id), eq(areas.userId, userId)))
    .returning();

  revalidatePath("/projects");
  return area;
}

export async function deleteArea(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  await db.delete(areas).where(and(eq(areas.id, id), eq(areas.userId, userId)));

  revalidatePath("/projects");
  revalidatePath("/todos");
  revalidatePath("/notes");
  revalidatePath("/finance");
}

export async function getAreaCounts() {
  const userId = await requireUserId();
  const db = await getDb();

  const [projectCounts, goalCounts, todoCounts, noteCounts] =
    await Promise.all([
      db
        .select({ areaId: projects.areaId, total: count() })
        .from(projects)
        .where(eq(projects.userId, userId))
        .groupBy(projects.areaId),
      db
        .select({ areaId: goals.areaId, total: count() })
        .from(goals)
        .where(eq(goals.userId, userId))
        .groupBy(goals.areaId),
      db
        .select({ areaId: todos.areaId, total: count() })
        .from(todos)
        .where(eq(todos.userId, userId))
        .groupBy(todos.areaId),
      db
        .select({ areaId: notes.areaId, total: count() })
        .from(notes)
        .where(eq(notes.userId, userId))
        .groupBy(notes.areaId),
    ]);

  const totals = new Map<string, number>();
  for (const rows of [projectCounts, goalCounts, todoCounts, noteCounts]) {
    for (const row of rows) {
      if (!row.areaId) continue;
      totals.set(row.areaId, (totals.get(row.areaId) ?? 0) + Number(row.total));
    }
  }
  return totals;
}
