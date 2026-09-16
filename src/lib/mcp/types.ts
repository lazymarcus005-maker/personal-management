import type { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/server";

/**
 * Everything an MCP tool handler needs besides its arguments. userId comes
 * from the verified bearer token in the /api/mcp route and scopes every
 * query — it must never be taken from tool arguments.
 */
export interface ToolContext {
  userId: string;
}

/** A tool definition: registered as-is, with ctx injected before args. */
export interface ToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  name: string;
  config: {
    title: string;
    description: string;
    inputSchema: TSchema;
  };
  handler: (ctx: ToolContext, args: z.infer<TSchema>) => Promise<CallToolResult>;
}
