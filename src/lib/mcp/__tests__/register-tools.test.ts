import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerTools } from "@/lib/mcp/register-tools";
import { summarizeArgs } from "@/lib/mcp/audit";

describe("registerTools", () => {
  it("registers a unique, well-formed tool for every definition", () => {
    const registerTool = vi.fn();
    const fakeServer = { registerTool } as unknown as McpServer;

    registerTools(fakeServer, { userId: "user-1" });

    expect(registerTool).toHaveBeenCalledTimes(29);

    const names = registerTool.mock.calls.map(
      (call: unknown[]) => call[0] as string
    );
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[a-z_]+$/);
    }

    for (const call of registerTool.mock.calls) {
      const [name, config, handler] = call as [
        string,
        Record<string, unknown>,
        unknown,
      ];
      expect(config.title, `${name} title`).toBeTruthy();
      expect(config.description, `${name} description`).toBeTruthy();
      // The SDK validates args against this schema before the handler runs.
      expect(config.inputSchema, `${name} inputSchema`).toBeTruthy();
      expect(typeof handler).toBe("function");
    }
  });

  it("registers the planned core tools", () => {
    const registerTool = vi.fn();
    const fakeServer = { registerTool } as unknown as McpServer;
    registerTools(fakeServer, { userId: "user-1" });

    const names = registerTool.mock.calls.map(
      (call: unknown[]) => call[0] as string
    );
    for (const expected of [
      "search_entities",
      "get_dashboard",
      "list_todos",
      "create_todo",
      "create_note",
      "create_journal_entry",
      "create_capture_item",
      "create_transaction",
      "get_finance_summary",
      "link_entities",
    ]) {
      expect(names).toContain(expected);
    }
  });
});

describe("summarizeArgs", () => {
  it("truncates long strings and keeps short values", () => {
    const long = "x".repeat(300);
    const summary = summarizeArgs({ title: long, amount: 5, ok: true });
    expect(summary.amount).toBe(5);
    expect(summary.ok).toBe(true);
    expect(String(summary.title).length).toBeLessThan(210);
    expect(String(summary.title)).toMatch(/…$/);
  });
});
