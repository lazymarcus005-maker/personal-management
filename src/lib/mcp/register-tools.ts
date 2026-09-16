import type { McpServer } from "@modelcontextprotocol/server";
import type { ToolContext, ToolDefinition } from "./types";
import { logMcpToolCall, summarizeArgs } from "./audit";
import { searchEntitiesTool } from "./tools/search";
import { getDashboardTool } from "./tools/dashboard";
import {
  listAreasTool,
  createAreaTool,
  listProjectsTool,
  getProjectTool,
  createProjectTool,
  updateProjectTool,
  listGoalsTool,
  createGoalTool,
  updateGoalTool,
  linkEntitiesTool,
  getEntityLinksTool,
} from "./tools/plos";
import {
  listTodosTool,
  createTodoTool,
  updateTodoTool,
  listNotesTool,
  createNoteTool,
} from "./tools/tasks";
import {
  listJournalEntriesTool,
  createJournalEntryTool,
  createCaptureItemTool,
  listCaptureItemsTool,
  dismissCaptureItemTool,
} from "./tools/journal-capture";
import {
  listAccountsTool,
  listCategoriesTool,
  listTransactionsTool,
  getFinanceSummaryTool,
  createTransactionTool,
  deleteTransactionTool,
} from "./tools/finance";

const TOOLS = [
  searchEntitiesTool,
  getDashboardTool,
  listAreasTool,
  createAreaTool,
  listProjectsTool,
  getProjectTool,
  createProjectTool,
  updateProjectTool,
  listGoalsTool,
  createGoalTool,
  updateGoalTool,
  linkEntitiesTool,
  getEntityLinksTool,
  listTodosTool,
  createTodoTool,
  updateTodoTool,
  listNotesTool,
  createNoteTool,
  listJournalEntriesTool,
  createJournalEntryTool,
  createCaptureItemTool,
  listCaptureItemsTool,
  dismissCaptureItemTool,
  listAccountsTool,
  listCategoriesTool,
  listTransactionsTool,
  getFinanceSummaryTool,
  createTransactionTool,
  deleteTransactionTool,
] as const;

/**
 * Registers every tool on a fresh McpServer instance. Each handler closes
 * over the authenticated userId so data access is always scoped to the token
 * owner; the SDK validates tool arguments against each inputSchema before
 * the handler runs. Every call lands in the audit log.
 */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  for (const tool of TOOLS) {
    const definition: ToolDefinition = tool;
    server.registerTool(
      definition.name,
      definition.config,
      async (args) => {
        const summary = (args ?? {}) as Record<string, unknown>;
        logMcpToolCall(ctx.userId, definition.name, summarizeArgs(summary));
        return definition.handler(ctx, summary as never);
      }
    );
  }
}
