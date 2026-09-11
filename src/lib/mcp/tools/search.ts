import { z } from "zod";
import { unifiedSearch } from "@/lib/services/search";
import { safeRun, dateOnly } from "./shared";
import type { ToolDefinition } from "../types";

const inputSchema = z.object({
  q: z.string().min(2).max(200).describe("Search text (Thai or English)"),
  type: z
    .enum([
      "TODO",
      "NOTE",
      "PROJECT",
      "GOAL",
      "JOURNAL_ENTRY",
      "BILL",
      "SUBSCRIPTION",
      "TRANSACTION",
      "ACCOUNT",
      "AREA",
      "TAG",
    ])
    .optional()
    .describe("Restrict results to one entity type"),
  area: z.string().optional().describe("Filter by area name"),
  project: z.string().optional().describe("Filter by project name"),
  from: dateOnly.optional().describe("Only entities created on/after this date"),
  to: dateOnly.optional().describe("Only entities created on/before this date"),
});

/**
 * Cross-entity search. Shares query logic with the web app's /api/search
 * route via `unifiedSearch`, so MCP and the UI see identical results.
 */
export const searchEntitiesTool: ToolDefinition<typeof inputSchema> = {
  name: "search_entities",
  config: {
    title: "Search Entities",
    description:
      "Search across the user's personal data: todos, notes, projects, goals, journal entries, bills, subscriptions, transactions, accounts, areas and tags. " +
      "Requires a query of at least 2 characters. Use it to find entity ids before reading or linking them.",
    inputSchema,
  },
  handler: (ctx, args) =>
    safeRun(() => unifiedSearch(ctx.userId, args)),
};
