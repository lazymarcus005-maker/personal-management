"use server";

import { requireUserId } from "@/lib/guards";
import { getDb } from "@/db";
import {
  projects,
  areas,
  todos,
  notes,
  goals,
  financialTransactions,
  entityLinks,
} from "@/db/schema";
import { eq, and, desc, count, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  areaId: z.string().uuid().optional().nullable(),
  status: z.enum(["PLANNING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  startDate: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
});

export async function getProjects(status?: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const conditions = [eq(projects.userId, userId)];
  if (status) {
    conditions.push(
      eq(
        projects.status,
        status as "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED"
      )
    );
  }

  return db
    .select({
      project: projects,
      areaName: areas.name,
      areaColor: areas.color,
    })
    .from(projects)
    .leftJoin(areas, eq(projects.areaId, areas.id))
    .where(and(...conditions))
    .orderBy(desc(projects.updatedAt));
}

export async function getProjectById(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const [row] = await db
    .select({ project: projects, areaName: areas.name, areaColor: areas.color })
    .from(projects)
    .leftJoin(areas, eq(projects.areaId, areas.id))
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  return row;
}

export async function createProject(data: z.infer<typeof projectSchema>) {
  const userId = await requireUserId();
  const db = await getDb();
  const parsed = projectSchema.parse(data);

  // Validate that a provided area belongs to the user before linking it.
  if (parsed.areaId) {
    const [area] = await db
      .select({ id: areas.id })
      .from(areas)
      .where(and(eq(areas.id, parsed.areaId), eq(areas.userId, userId)));
    if (!area) throw new Error("Area not found");
  }

  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name: parsed.name,
      description: parsed.description,
      areaId: parsed.areaId || null,
      status: parsed.status,
      priority: parsed.priority,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      targetDate: parsed.targetDate ? new Date(parsed.targetDate) : null,
    })
    .returning();

  revalidatePath("/projects");
  revalidatePath("/");
  return project;
}

export async function updateProject(
  id: string,
  data: Partial<z.infer<typeof projectSchema>>
) {
  const userId = await requireUserId();
  const db = await getDb();

  if (data.areaId) {
    const [area] = await db
      .select({ id: areas.id })
      .from(areas)
      .where(and(eq(areas.id, data.areaId), eq(areas.userId, userId)));
    if (!area) throw new Error("Area not found");
  }

  const {
    startDate,
    targetDate,
    ...rest
  } = data;
  const updateData: Partial<typeof projects.$inferInsert> = {
    ...rest,
    updatedAt: new Date(),
  };
  if (typeof startDate === "string") updateData.startDate = new Date(startDate);
  if (typeof targetDate === "string") updateData.targetDate = new Date(targetDate);

  const [project] = await db
    .update(projects)
    .set(updateData)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
  return project;
}

export async function deleteProject(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));

  revalidatePath("/projects");
  revalidatePath("/");
}

/** Counts of linked entities plus linked expense total for a project page. */
export async function getProjectStats(projectId: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  if (!owned) throw new Error("Not found");

  const [taskCount, noteCount, goalCount, expenses] = await Promise.all([
    db
      .select({ total: count() })
      .from(todos)
      .where(and(eq(todos.projectId, projectId), eq(todos.userId, userId))),
    db
      .select({ total: count() })
      .from(notes)
      .where(and(eq(notes.projectId, projectId), eq(notes.userId, userId))),
    db
      .select({ total: count() })
      .from(goals)
      .where(and(eq(goals.projectId, projectId), eq(goals.userId, userId))),
    db
      .select({
        total: sql<string>`coalesce(sum(${financialTransactions.amount}), '0')`,
      })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.projectId, projectId),
          eq(financialTransactions.userId, userId),
          eq(financialTransactions.type, "EXPENSE"),
          // Stay consistent with the soft-deletion rule used everywhere else.
          isNull(financialTransactions.deletedAt)
        )
      ),
  ]);

  return {
    tasks: Number(taskCount[0]?.total ?? 0),
    notes: Number(noteCount[0]?.total ?? 0),
    goals: Number(goalCount[0]?.total ?? 0),
    expenses: parseFloat(expenses[0]?.total ?? "0"),
  };
}

/** Entities linked to a project via entity_links (in addition to direct FKs). */
export async function getLinkedEntities(projectId: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  if (!owned) throw new Error("Not found");

  const links = await db
    .select()
    .from(entityLinks)
    .where(
      and(
        eq(entityLinks.userId, userId),
        sql`(${entityLinks.sourceId} = ${projectId} OR ${entityLinks.targetId} = ${projectId})`
      )
    )
    .orderBy(desc(entityLinks.createdAt));

  return links;
}
