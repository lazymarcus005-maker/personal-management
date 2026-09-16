import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpTokens } from "@/db/schema";

/** MCP tokens are minted by scripts/mcp-token.mjs with this prefix. */
const TOKEN_PREFIX = "mcp_";

/** Only the SHA-256 hex digest is stored, same scheme as passwordResetTokens. */
export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  const trimmed = token.trim();
  return trimmed.startsWith(TOKEN_PREFIX) ? trimmed : null;
}

/**
 * Resolves a bearer token to the owning user id. The MCP endpoint derives
 * every query's user scope from this value — the Auth.js session is never
 * consulted.
 */
export async function resolveMcpUserId(token: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ id: mcpTokens.id, userId: mcpTokens.userId })
    .from(mcpTokens)
    .where(
      and(
        eq(mcpTokens.tokenHash, hashMcpToken(token)),
        isNull(mcpTokens.revokedAt)
      )
    );
  if (!row) return null;

  // Best-effort usage stamp; never blocks the request.
  void db
    .update(mcpTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(mcpTokens.id, row.id))
    .catch(() => undefined);

  return row.userId;
}
