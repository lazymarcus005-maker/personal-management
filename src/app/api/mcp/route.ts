import { createMcpHandler } from "mcp-handler";
import type { McpServer } from "@modelcontextprotocol/server";
import { extractBearerToken, resolveMcpUserId } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/register-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MCP endpoint over Streamable HTTP. Clients authenticate with a personal
 * access token minted by `scripts/mcp-token.mjs`, sent as
 * `Authorization: Bearer mcp_...`. The token resolves to a user id and every
 * tool call is scoped to that user — Auth.js sessions are not involved.
 */
const unauthorized = () =>
  Response.json(
    { error: "Unauthorized: provide a valid MCP bearer token" },
    { status: 401 }
  );

async function handler(request: Request): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) return unauthorized();

  const userId = await resolveMcpUserId(token);
  if (!userId) return unauthorized();

  const mcpHandler = createMcpHandler(
    (server: McpServer) => {
      registerTools(server, { userId });
    },
    {
      serverInfo: { name: "personal-life-os", version: "0.1.0" },
      instructions:
        "Personal Life OS: a unified personal command center. Data domains: " +
        "Areas → Projects → Goals (context layer), todos, notes, journal, a capture inbox " +
        "with a Thai/English quick-capture classifier, and personal finance (accounts, " +
        "transactions, budgets, recurring bills). " +
        "Start with get_dashboard or search_entities to find entity ids, then use the " +
        "read tools for detail. Write tools mutate real data: financial transactions use " +
        "soft delete and adjust balances atomically, and capture items can be converted " +
        "straight into entities.",
      verboseLogs: false,
    }
  );

  return mcpHandler(request);
}

export { handler as GET, handler as POST, handler as DELETE };
