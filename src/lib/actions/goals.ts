"use server";

import { requireUserId } from "@/lib/guards";
import { getDb } from "@/db";
import { goals, areas, projects } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const goalSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  areaId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  status: z.enum(["ACTIVE", "COMPLETED", "PAUSED", "CANCELLED"]),
  targetValue: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  currentValue: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  unit: z.string().max(30).optional(),
  targetDate: z.string().optional().nullable(),
});

export async function getGoals(status?: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const conditions = [eq(goals.userId, userId)];
  if (status) {
    conditions.push(
      eq(goals.status, status as "ACTIVE" | "COMPLETED" | "PAUSED" | "CANCELLED")
    );
  }

  return db
    .select({ goal: goals, areaName: areas.name, projectName: projects.name })
    .from(goals)
    .leftJoin(areas, eq(goals.areaId, areas.id))
    .leftJoin(projects, eq(goals.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(desc(goals.updatedAt));
}

export async function createGoal(data: z.infer<typeof goalSchema>) {
  const userId = await requireUserId();
  const db = await getDb();
  const parsed = goalSchema.parse(data);

  // Related ids must belong to the user before they can be referenced.
  await assertRelatedEntitiesOwned(db, userId, parsed.areaId, parsed.projectId);

  const [goal] = await db
    .insert(goals)
    .values({
      userId,
      title: parsed.title,
      description: parsed.description,
      areaId: parsed.areaId || null,
      projectId: parsed.projectId || null,
      status: parsed.status,
      targetValue: parsed.targetValue ?? null,
      currentValue: parsed.currentValue ?? "0",
      unit: parsed.unit,
      targetDate: parsed.targetDate ? new Date(parsed.targetDate) : null,
    })
    .returning();

  revalidatePath("/projects");
  revalidatePath("/");
  return goal;
}

export async function updateGoal(
  id: string,
  data: Partial<z.infer<typeof goalSchema>>
) {
  const userId = await requireUserId();
  const db = await getDb();

  const [existing] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)));
  if (!existing) throw new Error("Not found");

  await assertRelatedEntitiesOwned(db, userId, data.areaId, data.projectId);

  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (typeof updateData.targetDate === "string")
    updateData.targetDate = new Date(updateData.targetDate);

  const [goal] = await db
    .update(goals)
    .set(updateData as any)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning();

  revalidatePath("/projects");
  revalidatePath("/");
  return goal;
}

export async function updateGoalProgress(id: string, currentValue: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const parsed = z.string().regex(/^\d+(\.\d{1,2})?$/).parse(currentValue);

  const [goal] = await db
    .update(goals)
    .set({ currentValue: parsed, updatedAt: new Date() })
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning();

  revalidatePath("/projects");
  revalidatePath("/");
  return goal;
}

export async function deleteGoal(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));

  revalidatePath("/projects");
  revalidatePath("/");
}

async function assertRelatedEntitiesOwned(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  areaId?: string | null | undefined,
  projectId?: string | null | undefined
) {
  if (areaId) {
    const [area] = await db
      .select({ id: areas.id })
      .from(areas)
      .where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
    if (!area) throw new Error("Area not found");
  }
  if (projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!project) throw new Error("Project not found");
  }
}
