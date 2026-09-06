/**
 * Lightweight structured audit trail for MCP tool calls. Writes go to stdout
 * as one JSON line each so they survive in server logs (Vercel, Docker).
 * A dedicated audit table can replace this without touching callers.
 */
export function logMcpToolCall(
  userId: string,
  tool: string,
  argsSummary: Record<string, unknown>
): void {
  console.log(
    JSON.stringify({
      channel: "mcp_audit",
      at: new Date().toISOString(),
      userId,
      tool,
      args: argsSummary,
    })
  );
}

/** Strips noisy fields before an argument object lands in the audit log. */
export function summarizeArgs(
  args: Record<string, unknown>
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string" && value.length > 200) {
      summary[key] = `${value.slice(0, 200)}…`;
    } else {
      summary[key] = value;
    }
  }
  return summary;
}
