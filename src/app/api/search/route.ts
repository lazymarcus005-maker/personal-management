import { auth } from "@/auth";
import { unifiedSearch } from "@/lib/services/search";
import { NextRequest } from "next/server";

/**
 * Unified authenticated entity search. Query logic lives in
 * `src/lib/services/search.ts` so the MCP search tool shares it.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const results = await unifiedSearch(session.user.id, {
    q: params.get("q") || "",
    type: params.get("type"),
    area: params.get("area"),
    project: params.get("project"),
    from: params.get("from"),
    to: params.get("to"),
  });

  return Response.json({ results });
}
