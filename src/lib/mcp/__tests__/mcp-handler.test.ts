import { describe, expect, it } from "vitest";
import { createMcpHandler } from "mcp-handler";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerTools } from "@/lib/mcp/register-tools";

/**
 * Protocol-level integration test: exercises the real MCP Streamable HTTP
 * handler with registerTools attached (no database needed — the DB is only
 * touched inside individual tool handlers).
 */
function buildHandler() {
  return createMcpHandler(
    (server: McpServer) => registerTools(server, { userId: "test-user" }),
    { serverInfo: { name: "personal-life-os", version: "0.1.0" } }
  );
}

function post(handler: ReturnType<typeof buildHandler>, body: unknown, sessionId?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  return handler(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
  );
}

async function jsonResult(response: Response) {
  expect(response.ok).toBe(true);
  const text = await response.text();
  // Streamable HTTP may answer with plain JSON or an SSE frame.
  if (text.startsWith("event:") || text.includes("data:")) {
    const dataLine = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .at(-1);
    return JSON.parse(dataLine!.slice("data:".length).trim());
  }
  return JSON.parse(text);
}

describe("MCP endpoint protocol", () => {
  it("completes initialize and lists all tools with JSON schemas", async () => {
    const handler = buildHandler();

    const initRes = await post(handler, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "vitest", version: "0.0.0" },
      },
    });
    const init = await jsonResult(initRes);
    expect(init.result.serverInfo.name).toBe("personal-life-os");
    const sessionId = initRes.headers.get("mcp-session-id") ?? undefined;

    await post(
      handler,
      { jsonrpc: "2.0", method: "notifications/initialized" },
      sessionId
    );

    const listRes = await post(
      handler,
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      sessionId
    );
    const list = await jsonResult(listRes);
    const names = list.result.tools.map((t: { name: string }) => t.name);

    expect(names.length).toBe(29);
    for (const expected of [
      "search_entities",
      "get_dashboard",
      "list_todos",
      "create_todo",
      "create_note",
      "create_journal_entry",
      "create_capture_item",
      "create_transaction",
      "delete_transaction",
      "get_finance_summary",
      "link_entities",
    ]) {
      expect(names).toContain(expected);
    }
    // Every tool advertises a JSON Schema for its input.
    for (const tool of list.result.tools) {
      expect(tool.inputSchema?.type, `${tool.name} schema`).toBe("object");
    }
  });

  it("rejects tool calls with invalid arguments (schema validation)", async () => {
    const handler = buildHandler();

    const initRes = await post(handler, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "vitest", version: "0.0.0" },
      },
    });
    await jsonResult(initRes);
    const sessionId = initRes.headers.get("mcp-session-id") ?? undefined;
    await post(
      handler,
      { jsonrpc: "2.0", method: "notifications/initialized" },
      sessionId
    );

    const res = await post(
      handler,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "create_transaction",
          arguments: { type: "EXPENSE", amount: "10" }, // accountId missing
        },
      },
      sessionId
    );
    const result = await jsonResult(res);
    // The SDK either rejects with a JSON-RPC error (invalid params) or
    // returns a tool result flagged as an error.
    if (result.error) {
      expect(result.error.code).toBeDefined();
    } else {
      expect(result.result.isError).toBe(true);
    }
  });
});
