import { z } from "zod";
import {
  todos,
  captureItems,
  journalEntries,
  financialTransactions,
  projects,
} from "@/db/schema";
import { and, asc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { safeRun, dateOnly } from "./shared";
import type { ToolDefinition } from "../types";

const inputSchema = z.object({
  date: dateOnly.optional().describe("Defaults to today"),
});

/** Today-at-a-glance for the agent: due/overdue todos, inbox, journal, spend. */
export const getDashboardTool: ToolDefinition<typeof inputSchema> = {
  name: "get_dashboard",
  config: {
    title: "Get Dashboard",
    description:
      "Today overview: todos due (or overdue) on the date, unprocessed capture inbox items, whether a journal entry exists for that date, and total expenses that day.",
    inputSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const dayStart = args.date ? new Date(args.date) : new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [dueTodos, inboxItems, journalToday, expenseToday] = await Promise.all([
        db
          .select({ todo: todos, projectName: projects.name })
          .from(todos)
          .leftJoin(projects, eq(todos.projectId, projects.id))
          .where(
            and(
              eq(todos.userId, ctx.userId),
              isNull(todos.archivedAt),
              // Not already done/cancelled, and due on or before the day.
              or(eq(todos.status, "TODO"), eq(todos.status, "IN_PROGRESS")),
              isNull(todos.completedAt),
              lt(todos.dueAt, dayEnd)
            )
          )
          .orderBy(asc(todos.dueAt))
          .limit(50),
        db
          .select()
          .from(captureItems)
          .where(and(eq(captureItems.userId, ctx.userId), eq(captureItems.status, "NEW")))
          .orderBy(asc(captureItems.createdAt))
          .limit(50),
        db
          .select({ id: journalEntries.id, title: journalEntries.title })
          .from(journalEntries)
          .where(
            and(
              eq(journalEntries.userId, ctx.userId),
              gte(journalEntries.entryDate, dayStart),
              lt(journalEntries.entryDate, dayEnd)
            )
          ),
        db
          .select({
            total: sql<string>`coalesce(sum(${financialTransactions.amount}), '0')`,
          })
          .from(financialTransactions)
          .where(
            and(
              eq(financialTransactions.userId, ctx.userId),
              eq(financialTransactions.type, "EXPENSE"),
              isNull(financialTransactions.deletedAt),
              gte(financialTransactions.transactionDate, dayStart),
              lt(financialTransactions.transactionDate, dayEnd)
            )
          ),
      ]);

      return {
        date: dayStart.toISOString().slice(0, 10),
        todosDue: dueTodos.map(({ todo, projectName }) => ({
          id: todo.id,
          title: todo.title,
          status: todo.status,
          priority: todo.priority,
          dueAt: todo.dueAt,
          project: projectName,
        })),
        inboxCount: inboxItems.length,
        inboxItems,
        journalEntryToday: journalToday[0] ?? null,
        expenseToday: parseFloat(expenseToday[0]?.total ?? "0"),
      };
    }),
};
