import { z } from "zod";
import { journalEntries, captureItems } from "@/db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { classifyCapture } from "@/lib/capture/classify";
import { saveCaptureCore } from "@/lib/services/capture";
import { logMcpToolCall, summarizeArgs } from "../audit";
import { safeRun, dateOnly } from "./shared";
import type { ToolDefinition } from "../types";

// ------------------------------------------------------------------
// Journal
// ------------------------------------------------------------------

const listJournalSchema = z.object({
  from: dateOnly.optional().describe("Entries on/after this date"),
  to: dateOnly.optional().describe("Entries on/before this date"),
  limit: z.number().int().min(1).max(200).optional().default(30),
});

export const listJournalEntriesTool: ToolDefinition<typeof listJournalSchema> = {
  name: "list_journal_entries",
  config: {
    title: "List Journal Entries",
    description: "List the user's journal entries, newest first.",
    inputSchema: listJournalSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const conditions = [eq(journalEntries.userId, ctx.userId)];
      if (args.from) conditions.push(gte(journalEntries.entryDate, new Date(args.from)));
      if (args.to) {
        const end = new Date(args.to);
        end.setDate(end.getDate() + 1); // inclusive day bound
        conditions.push(lte(journalEntries.entryDate, end));
      }
      return db
        .select()
        .from(journalEntries)
        .where(and(...conditions))
        .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
        .limit(args.limit);
    }),
};

const createJournalEntrySchema = z.object({
  content: z.string().min(1).max(20000),
  title: z.string().max(300).optional(),
  entryDate: dateOnly.optional().describe("Defaults to today"),
  mood: z.string().max(30).optional().describe("Free-form mood, e.g. good, tired"),
  energyLevel: z.number().int().min(1).max(5).optional(),
  wins: z.string().optional(),
  concerns: z.string().optional(),
});

export const createJournalEntryTool: ToolDefinition<typeof createJournalEntrySchema> = {
  name: "create_journal_entry",
  config: {
    title: "Create Journal Entry",
    description: "Write a journal entry for a date (defaults to today).",
    inputSchema: createJournalEntrySchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const [entry] = await db
        .insert(journalEntries)
        .values({
          userId: ctx.userId,
          entryDate: args.entryDate ? new Date(args.entryDate) : new Date(),
          title: args.title,
          content: args.content,
          mood: args.mood,
          energyLevel: args.energyLevel,
          wins: args.wins,
          concerns: args.concerns,
        })
        .returning();
      return entry;
    }),
};

// ------------------------------------------------------------------
// Capture inbox
// ------------------------------------------------------------------

const createCaptureItemSchema = z.object({
  rawText: z.string().min(1).max(2000).describe("The raw quick-capture text"),
  convertNow: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "true: immediately convert to the suggested entity (todo/note/transaction/journal). " +
        "false: leave it in the inbox for review in the app."
    ),
  areaId: z
    .string()
    .uuid()
    .optional()
    .describe("Area to attach when converting now (optional)"),
  projectId: z.string().uuid().optional().describe("Project to attach when converting now"),
  accountId: z
    .string()
    .uuid()
    .optional()
    .describe("Account to book the amount against when the capture is EXPENSE/INCOME"),
});

export const createCaptureItemTool: ToolDefinition<typeof createCaptureItemSchema> = {
  name: "create_capture_item",
  config: {
    title: "Capture",
    description:
      "Quick-capture raw text (Thai or English). The deterministic classifier suggests a type, title, amount, currency and due date. " +
      "By default the text lands in the inbox for review; with convertNow=true it is converted immediately.",
    inputSchema: createCaptureItemSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const trimmed = args.rawText.trim();
      const suggestion = classifyCapture(trimmed);

      logMcpToolCall(ctx.userId, "create_capture_item", {
        suggestionType: suggestion.type,
        rawText: summarizeArgs({ rawText: trimmed }).rawText,
        convertNow: args.convertNow,
      });

      if (!args.convertNow) {
        // Same behaviour as the app's saveToInbox: dedupe pending identical text.
        const [existing] = await db
          .select({ id: captureItems.id })
          .from(captureItems)
          .where(
            and(
              eq(captureItems.userId, ctx.userId),
              eq(captureItems.rawText, trimmed),
              eq(captureItems.status, "NEW")
            )
          );
        if (existing) {
          return { ...existing, duplicate: true, suggestion };
        }
        const [capture] = await db
          .insert(captureItems)
          .values({
            userId: ctx.userId,
            rawText: trimmed,
            suggestedType: suggestion.type,
            payload: {
              title: suggestion.title,
              amount: suggestion.amount,
              currency: suggestion.currency,
              dueDate: suggestion.dueDate,
              suggestedTags: suggestion.suggestedTags,
              areaHint: suggestion.areaHint,
            },
            status: "NEW",
          })
          .returning();
        return { capture, suggestion };
      }

      // Convert immediately using the shared capture core (same as the UI).
      const result = await saveCaptureCore(ctx.userId, {
        rawText: trimmed,
        type: suggestion.type,
        title: suggestion.title,
        amount: suggestion.amount,
        currency: suggestion.currency,
        dueDate: suggestion.dueDate,
        areaId: args.areaId ?? null,
        projectId: args.projectId ?? null,
        accountId: args.accountId ?? null,
      });
      return { ...result, suggestion };
    }),
};

const listCaptureItemsSchema = z.object({
  status: z.enum(["NEW", "CONVERTED", "DISMISSED"]).optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export const listCaptureItemsTool: ToolDefinition<typeof listCaptureItemsSchema> = {
  name: "list_capture_items",
  config: {
    title: "List Capture Inbox",
    description: "List capture inbox items; status NEW means still unprocessed.",
    inputSchema: listCaptureItemsSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const conditions = [eq(captureItems.userId, ctx.userId)];
      if (args.status) conditions.push(eq(captureItems.status, args.status));
      return db
        .select()
        .from(captureItems)
        .where(and(...conditions))
        .orderBy(desc(captureItems.createdAt))
        .limit(args.limit);
    }),
};

const dismissCaptureItemSchema = z.object({
  captureItemId: z.string().uuid(),
});

export const dismissCaptureItemTool: ToolDefinition<typeof dismissCaptureItemSchema> = {
  name: "dismiss_capture_item",
  config: {
    title: "Dismiss Capture Item",
    description: "Mark an unprocessed inbox item as dismissed.",
    inputSchema: dismissCaptureItemSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const [item] = await db
        .update(captureItems)
        .set({ status: "DISMISSED", updatedAt: new Date() })
        .where(
          and(
            eq(captureItems.id, args.captureItemId),
            eq(captureItems.userId, ctx.userId),
            eq(captureItems.status, "NEW")
          )
        )
        .returning();
      if (!item) throw new Error("Capture item not found (or already processed)");
      return item;
    }),
};
