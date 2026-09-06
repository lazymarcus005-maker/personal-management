import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/server";

/** Wraps a JSON-serializable value as a text MCP tool result. */
export function textResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  } as CallToolResult;
}

/** Tool result carrying an error message back to the model. */
export function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  } as CallToolResult;
}

/** Runs a tool handler, converting thrown errors into isError results. */
export async function safeRun<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    return textResult(await fn());
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

export const optionalId = z
  .string()
  .uuid()
  .optional()
  .nullable()
  .describe("UUID of an existing entity owned by the user");

export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Date in YYYY-MM-DD format");
