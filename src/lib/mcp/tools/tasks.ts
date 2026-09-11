import { z } from "zod";
import { todos, todoChecklistItems, notes, areas, projects } from "@/db/schema";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { safeRun, optionalId, dateOnly } from "./shared";
import type { ToolDefinition } from "../types";

// ------------------------------------------------------------------
// Todos
// ------------------------------------------------------------------

const listTodosSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  areaId: optionalId,
  projectId: optionalId,
  dueFrom: dateOnly.optional().describe("Only todos due on/after this date"),
  dueTo: dateOnly.optional().describe("Only todos due on/before this date"),
  includeArchived: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export const listTodosTool: ToolDefinition<typeof listTodosSchema> = {
  name: "list_todos",
  config: {
    title: "List Todos",
    description:
      "List the user's todos with optional filters. Use dueFrom/dueTo to ask 'what's due this week'.",
    inputSchema: listTodosSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const conditions = [eq(todos.userId, ctx.userId)];
      if (args.status) conditions.push(eq(todos.status, args.status));
      if (args.areaId) conditions.push(eq(todos.areaId, args.areaId));
      if (args.projectId) conditions.push(eq(todos.projectId, args.projectId));
      if (args.dueFrom) conditions.push(gte(todos.dueAt, new Date(args.dueFrom)));
      if (args.dueTo) {
        const end = new Date(args.dueTo);
        end.setDate(end.getDate() + 1); // inclusive day bound
        conditions.push(lte(todos.dueAt, end));
      }
      if (!args.includeArchived) conditions.push(isNull(todos.archivedAt));
      return db
        .select({ todo: todos, areaName: areas.name, projectName: projects.name })
        .from(todos)
        .leftJoin(areas, eq(todos.areaId, areas.id))
        .leftJoin(projects, eq(todos.projectId, projects.id))
        .where(and(...conditions))
        .orderBy(asc(todos.dueAt), desc(todos.createdAt))
        .limit(args.limit);
    }),
};

const createTodoSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().default("MEDIUM"),
  dueDate: dateOnly.optional(),
  areaId: optionalId,
  projectId: optionalId,
  checklist: z
    .array(z.string().min(1).max(300))
    .optional()
    .describe("Optional checklist items created with the todo"),
});

export const createTodoTool: ToolDefinition<typeof createTodoSchema> = {
  name: "create_todo",
  config: {
    title: "Create Todo",
    description: "Create a todo, optionally inside an area/project and with checklist items.",
    inputSchema: createTodoSchema,
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
      return db.transaction(async (tx) => {
        const [todo] = await tx
          .insert(todos)
          .values({
            userId: ctx.userId,
            title: args.title,
            description: args.description,
            status: "TODO",
            priority: args.priority,
            dueAt: args.dueDate ? new Date(args.dueDate) : null,
            areaId: args.areaId ?? null,
            projectId: args.projectId ?? null,
          })
          .returning();
        if (args.checklist?.length) {
          await tx.insert(todoChecklistItems).values(
            args.checklist.map((content, index) => ({
              todoId: todo.id,
              content,
              sortOrder: index,
            }))
          );
        }
        return todo;
      });
    }),
};

const updateTodoSchema = z.object({
  todoId: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: dateOnly.optional().describe("Pass an empty-ish update carefully; omit to keep"),
  archive: z.boolean().optional().describe("true archives, false unarchives"),
});

export const updateTodoTool: ToolDefinition<typeof updateTodoSchema> = {
  name: "update_todo",
  config: {
    title: "Update Todo",
    description:
      "Update a todo's fields. Marking status DONE records the completion time.",
    inputSchema: updateTodoSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const { todoId, dueDate, archive, ...rest } = args;
      const updateData: Partial<typeof todos.$inferInsert> = { updatedAt: new Date() };
      if (rest.title !== undefined) updateData.title = rest.title;
      if (rest.description !== undefined) updateData.description = rest.description;
      if (rest.status !== undefined) {
        updateData.status = rest.status;
        updateData.completedAt = rest.status === "DONE" ? new Date() : null;
      }
      if (rest.priority !== undefined) updateData.priority = rest.priority;
      if (dueDate !== undefined) updateData.dueAt = new Date(dueDate);
      if (archive !== undefined) updateData.archivedAt = archive ? new Date() : null;
      const [todo] = await db
        .update(todos)
        .set(updateData)
        .where(and(eq(todos.id, todoId), eq(todos.userId, ctx.userId)))
        .returning();
      if (!todo) throw new Error("Todo not found");
      return todo;
    }),
};

// ------------------------------------------------------------------
// Notes
// ------------------------------------------------------------------

const listNotesSchema = z.object({
  areaId: optionalId,
  projectId: optionalId,
  noteType: z.enum(["GENERAL", "FINANCE", "IDEA", "REFERENCE", "MEETING"]).optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export const listNotesTool: ToolDefinition<typeof listNotesSchema> = {
  name: "list_notes",
  config: {
    title: "List Notes",
    description: "List the user's notes (archived notes excluded).",
    inputSchema: listNotesSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const conditions = [eq(notes.userId, ctx.userId), isNull(notes.archivedAt)];
      if (args.areaId) conditions.push(eq(notes.areaId, args.areaId));
      if (args.projectId) conditions.push(eq(notes.projectId, args.projectId));
      if (args.noteType) conditions.push(eq(notes.noteType, args.noteType));
      return db
        .select({ note: notes, areaName: areas.name, projectName: projects.name })
        .from(notes)
        .leftJoin(areas, eq(notes.areaId, areas.id))
        .leftJoin(projects, eq(notes.projectId, projects.id))
        .where(and(...conditions))
        .orderBy(desc(notes.updatedAt))
        .limit(args.limit);
    }),
};

const createNoteSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().optional(),
  noteType: z.enum(["GENERAL", "FINANCE", "IDEA", "REFERENCE", "MEETING"]).optional().default("GENERAL"),
  areaId: optionalId,
  projectId: optionalId,
});

export const createNoteTool: ToolDefinition<typeof createNoteSchema> = {
  name: "create_note",
  config: {
    title: "Create Note",
    description: "Create a note, optionally inside an area/project.",
    inputSchema: createNoteSchema,
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
      const [note] = await db
        .insert(notes)
        .values({
          userId: ctx.userId,
          title: args.title,
          content: args.content,
          noteType: args.noteType,
          areaId: args.areaId ?? null,
          projectId: args.projectId ?? null,
        })
        .returning();
      return note;
    }),
};
