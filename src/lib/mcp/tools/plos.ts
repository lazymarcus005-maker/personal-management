import { z } from "zod";
import {
  areas,
  projects,
  goals,
  entityLinks,
  todos,
  notes,
  financialItems,
  financialTransactions,
} from "@/db/schema";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  isEntityType,
  isRelationType,
  RELATION_TYPES,
} from "@/lib/entity-registry";
import { safeRun, optionalId, dateOnly } from "./shared";
import type { ToolDefinition } from "../types";

/**
 * Polymorphic link endpoints have no database FK, so every endpoint id is
 * verified against the mapped table AND scoped to the user (same mapping as
 * the app's entity-links action; AREA is additionally linkable here).
 */
const LINK_OWNERSHIP_TABLES = {
  TODO: todos,
  NOTE: notes,
  PROJECT: projects,
  GOAL: goals,
  JOURNAL_ENTRY: null,
  BILL: financialItems,
  SUBSCRIPTION: financialItems,
  TRANSACTION: financialTransactions,
  ACCOUNT: null,
} as const;

async function assertEntityOwned(
  userId: string,
  type: string,
  id: string
): Promise<void> {
  if (!isEntityType(type)) throw new Error(`Unsupported entity type: ${type}`);
  const table = LINK_OWNERSHIP_TABLES[type as keyof typeof LINK_OWNERSHIP_TABLES];
  if (!table) throw new Error(`Links to ${type} entities are not supported here`);
  const db = await getDb();
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId)));
  if (!row) throw new Error(`${type} entity not found`);
}

// ------------------------------------------------------------------
// Areas
// ------------------------------------------------------------------

const listAreasSchema = z.object({
  includeArchived: z.boolean().optional().default(false),
});

export const listAreasTool: ToolDefinition<typeof listAreasSchema> = {
  name: "list_areas",
  config: {
    title: "List Areas",
    description: "List the user's life areas (the top context layer).",
    inputSchema: listAreasSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const conditions = [eq(areas.userId, ctx.userId)];
      if (!args.includeArchived) conditions.push(isNull(areas.archivedAt));
      return db
        .select()
        .from(areas)
        .where(and(...conditions))
        .orderBy(asc(areas.sortOrder), asc(areas.name));
    }),
};

const createAreaSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(50).describe("Free-form area type, e.g. Work, Health"),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const createAreaTool: ToolDefinition<typeof createAreaSchema> = {
  name: "create_area",
  config: {
    title: "Create Area",
    description: "Create a new life area (context layer for projects and goals).",
    inputSchema: createAreaSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const [area] = await db
        .insert(areas)
        .values({ userId: ctx.userId, ...args })
        .returning();
      return area;
    }),
};

// ------------------------------------------------------------------
// Projects
// ------------------------------------------------------------------

const listProjectsSchema = z.object({
  status: z
    .enum(["PLANNING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"])
    .optional()
    .describe("Filter by project status"),
  areaId: optionalId,
});

export const listProjectsTool: ToolDefinition<typeof listProjectsSchema> = {
  name: "list_projects",
  config: {
    title: "List Projects",
    description: "List the user's projects, most recently updated first.",
    inputSchema: listProjectsSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const conditions = [eq(projects.userId, ctx.userId)];
      if (args.status) conditions.push(eq(projects.status, args.status));
      if (args.areaId) conditions.push(eq(projects.areaId, args.areaId));
      return db
        .select({ project: projects, areaName: areas.name })
        .from(projects)
        .leftJoin(areas, eq(projects.areaId, areas.id))
        .where(and(...conditions))
        .orderBy(desc(projects.updatedAt))
        .limit(100);
    }),
};

const getProjectSchema = z.object({
  projectId: z.string().uuid(),
});

export const getProjectTool: ToolDefinition<typeof getProjectSchema> = {
  name: "get_project",
  config: {
    title: "Get Project",
    description:
      "Get one project with its goals, todos, notes, outgoing entity links and total linked expenses.",
    inputSchema: getProjectSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, args.projectId), eq(projects.userId, ctx.userId)));
      if (!project) throw new Error("Project not found");

      const [projectGoals, projectTodos, projectNotes, links, expenses] =
        await Promise.all([
          db
            .select()
            .from(goals)
            .where(and(eq(goals.projectId, project.id), eq(goals.userId, ctx.userId))),
          db
            .select()
            .from(todos)
            .where(and(eq(todos.projectId, project.id), eq(todos.userId, ctx.userId))),
          db
            .select()
            .from(notes)
            .where(
              and(
                eq(notes.projectId, project.id),
                eq(notes.userId, ctx.userId),
                isNull(notes.archivedAt)
              )
            ),
          db
            .select()
            .from(entityLinks)
            .where(
              and(
                eq(entityLinks.userId, ctx.userId),
                eq(entityLinks.sourceId, project.id)
              )
            )
            .orderBy(desc(entityLinks.createdAt)),
          db
            .select({
              total: sql<string>`coalesce(sum(${financialTransactions.amount}), '0')`,
            })
            .from(financialTransactions)
            .where(
              and(
                eq(financialTransactions.projectId, project.id),
                eq(financialTransactions.userId, ctx.userId),
                eq(financialTransactions.type, "EXPENSE"),
                // Stay consistent with the soft-deletion rule used elsewhere.
                isNull(financialTransactions.deletedAt)
              )
            ),
        ]);

      return {
        project,
        goals: projectGoals,
        todos: projectTodos,
        notes: projectNotes,
        links,
        expenses: parseFloat(expenses[0]?.total ?? "0"),
      };
    }),
};

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  areaId: optionalId,
  status: z
    .enum(["PLANNING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"])
    .optional()
    .default("PLANNING"),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
    .optional()
    .default("MEDIUM"),
  startDate: dateOnly.optional(),
  targetDate: dateOnly.optional(),
});

export const createProjectTool: ToolDefinition<typeof createProjectSchema> = {
  name: "create_project",
  config: {
    title: "Create Project",
    description: "Create a project, optionally inside an area.",
    inputSchema: createProjectSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      if (args.areaId) {
        const [area] = await db
          .select({ id: areas.id })
          .from(areas)
          .where(and(eq(areas.id, args.areaId), eq(areas.userId, ctx.userId)));
        if (!area) throw new Error("Area not found");
      }
      const [project] = await db
        .insert(projects)
        .values({
          userId: ctx.userId,
          name: args.name,
          description: args.description,
          areaId: args.areaId || null,
          status: args.status,
          priority: args.priority,
          startDate: args.startDate ? new Date(args.startDate) : null,
          targetDate: args.targetDate ? new Date(args.targetDate) : null,
        })
        .returning();
      return project;
    }),
};

const updateProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["PLANNING", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  targetDate: dateOnly.optional(),
});

export const updateProjectTool: ToolDefinition<typeof updateProjectSchema> = {
  name: "update_project",
  config: {
    title: "Update Project",
    description: "Update a project's name, description, status, priority or target date.",
    inputSchema: updateProjectSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const { projectId, ...changes } = args;
      const updateData: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
      if (changes.name !== undefined) updateData.name = changes.name;
      if (changes.description !== undefined) updateData.description = changes.description;
      if (changes.status !== undefined) updateData.status = changes.status;
      if (changes.priority !== undefined) updateData.priority = changes.priority;
      if (changes.targetDate !== undefined) {
        updateData.targetDate = new Date(changes.targetDate);
      }
      const [project] = await db
        .update(projects)
        .set(updateData)
        .where(and(eq(projects.id, projectId), eq(projects.userId, ctx.userId)))
        .returning();
      if (!project) throw new Error("Project not found");
      return project;
    }),
};

// ------------------------------------------------------------------
// Goals
// ------------------------------------------------------------------

const listGoalsSchema = z.object({
  status: z.enum(["ACTIVE", "COMPLETED", "PAUSED", "CANCELLED"]).optional(),
  areaId: optionalId,
  projectId: optionalId,
});

export const listGoalsTool: ToolDefinition<typeof listGoalsSchema> = {
  name: "list_goals",
  config: {
    title: "List Goals",
    description: "List the user's goals with area/project context.",
    inputSchema: listGoalsSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const conditions = [eq(goals.userId, ctx.userId)];
      if (args.status) conditions.push(eq(goals.status, args.status));
      if (args.areaId) conditions.push(eq(goals.areaId, args.areaId));
      if (args.projectId) conditions.push(eq(goals.projectId, args.projectId));
      return db
        .select({ goal: goals, areaName: areas.name, projectName: projects.name })
        .from(goals)
        .leftJoin(areas, eq(goals.areaId, areas.id))
        .leftJoin(projects, eq(goals.projectId, projects.id))
        .where(and(...conditions))
        .orderBy(desc(goals.updatedAt))
        .limit(100);
    }),
};

const createGoalSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  areaId: optionalId,
  projectId: optionalId,
  targetValue: z
    .number()
    .nonnegative()
    .optional()
    .describe("Numeric target, e.g. 10 (books) or 50000 (THB)"),
  unit: z.string().max(30).optional().describe("Unit for the target value"),
  targetDate: dateOnly.optional(),
});

export const createGoalTool: ToolDefinition<typeof createGoalSchema> = {
  name: "create_goal",
  config: {
    title: "Create Goal",
    description: "Create a goal, optionally tied to an area and/or project.",
    inputSchema: createGoalSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      if (args.areaId) {
        const [area] = await db
          .select({ id: areas.id })
          .from(areas)
          .where(and(eq(areas.id, args.areaId), eq(areas.userId, ctx.userId)));
        if (!area) throw new Error("Area not found");
      }
      if (args.projectId) {
        const [project] = await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.id, args.projectId), eq(projects.userId, ctx.userId)));
        if (!project) throw new Error("Project not found");
      }
      const [goal] = await db
        .insert(goals)
        .values({
          userId: ctx.userId,
          title: args.title,
          description: args.description,
          areaId: args.areaId || null,
          projectId: args.projectId || null,
          status: "ACTIVE",
          targetValue:
            args.targetValue !== undefined ? args.targetValue.toFixed(2) : null,
          currentValue: "0",
          unit: args.unit,
          targetDate: args.targetDate ? new Date(args.targetDate) : null,
        })
        .returning();
      return goal;
    }),
};

const updateGoalSchema = z.object({
  goalId: z.string().uuid(),
  currentValue: z
    .number()
    .nonnegative()
    .optional()
    .describe("New progress value toward the target"),
  status: z.enum(["ACTIVE", "COMPLETED", "PAUSED", "CANCELLED"]).optional(),
});

export const updateGoalTool: ToolDefinition<typeof updateGoalSchema> = {
  name: "update_goal",
  config: {
    title: "Update Goal",
    description: "Update a goal's progress value and/or status.",
    inputSchema: updateGoalSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const { goalId, currentValue, status } = args;
      const updateData: Partial<typeof goals.$inferInsert> = { updatedAt: new Date() };
      if (currentValue !== undefined) updateData.currentValue = currentValue.toFixed(2);
      if (status !== undefined) updateData.status = status;
      const [goal] = await db
        .update(goals)
        .set(updateData)
        .where(and(eq(goals.id, goalId), eq(goals.userId, ctx.userId)))
        .returning();
      if (!goal) throw new Error("Goal not found");
      return goal;
    }),
};

// ------------------------------------------------------------------
// Entity links
// ------------------------------------------------------------------

const LINKABLE_TYPES = [
  "TODO",
  "NOTE",
  "PROJECT",
  "GOAL",
  "JOURNAL_ENTRY",
  "BILL",
  "SUBSCRIPTION",
  "TRANSACTION",
  "ACCOUNT",
] as const;

const linkEntitiesSchema = z.object({
  sourceType: z.enum(LINKABLE_TYPES),
  sourceId: z.string().uuid(),
  targetType: z.enum(LINKABLE_TYPES),
  targetId: z.string().uuid(),
  relationType: z.enum(RELATION_TYPES).optional().default("RELATED_TO"),
});

export const linkEntitiesTool: ToolDefinition<typeof linkEntitiesSchema> = {
  name: "link_entities",
  config: {
    title: "Link Entities",
    description:
      "Create a typed relation between two entities. Relation types: PART_OF, RELATED_TO, SUPPORTS, BLOCKS, PAID_FOR, GENERATED_FROM, INSPIRED_BY. Idempotent — re-linking the same pair with the same relation returns the existing link.",
    inputSchema: linkEntitiesSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const { sourceType, sourceId, targetType, targetId, relationType } = args;
      if (!isRelationType(relationType)) {
        throw new Error(`Unsupported relation type: ${relationType}`);
      }
      if (sourceType === targetType && sourceId === targetId) {
        throw new Error("Cannot link an entity to itself");
      }

      await assertEntityOwned(ctx.userId, sourceType, sourceId);
      await assertEntityOwned(ctx.userId, targetType, targetId);

      const [existing] = await db
        .select()
        .from(entityLinks)
        .where(
          and(
            eq(entityLinks.userId, ctx.userId),
            eq(entityLinks.sourceType, sourceType),
            eq(entityLinks.sourceId, sourceId),
            eq(entityLinks.targetType, targetType),
            eq(entityLinks.targetId, targetId),
            eq(entityLinks.relationType, relationType)
          )
        );
      if (existing) return { ...existing, duplicate: true };

      const [link] = await db
        .insert(entityLinks)
        .values({
          userId: ctx.userId,
          sourceType,
          sourceId,
          targetType,
          targetId,
          relationType,
        })
        .returning();
      return link;
    }),
};

const getEntityLinksSchema = z.object({
  entityType: z.string(),
  entityId: z.string().uuid(),
});

export const getEntityLinksTool: ToolDefinition<typeof getEntityLinksSchema> = {
  name: "get_entity_links",
  config: {
    title: "Get Entity Links",
    description: "List all entity links touching the given entity (both directions).",
    inputSchema: getEntityLinksSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const { entityType, entityId } = args;
      if (!isEntityType(entityType)) throw new Error("Unsupported entity type");
      const outgoing = await db
        .select()
        .from(entityLinks)
        .where(
          and(
            eq(entityLinks.userId, ctx.userId),
            eq(entityLinks.sourceType, entityType),
            eq(entityLinks.sourceId, entityId)
          )
        );
      const incoming = await db
        .select()
        .from(entityLinks)
        .where(
          and(
            eq(entityLinks.userId, ctx.userId),
            eq(entityLinks.targetType, entityType),
            eq(entityLinks.targetId, entityId)
          )
        );
      return { outgoing, incoming };
    }),
};
