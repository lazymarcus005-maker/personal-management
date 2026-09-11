import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  extractBearerToken,
  hashMcpToken,
} from "@/lib/mcp/auth";

describe("hashMcpToken", () => {
  it("returns the sha256 hex digest of the token", () => {
    const token = "mcp_abc123";
    expect(hashMcpToken(token)).toBe(
      createHash("sha256").update(token).digest("hex")
    );
  });

  it("is deterministic and differs per token", () => {
    expect(hashMcpToken("mcp_a")).toBe(hashMcpToken("mcp_a"));
    expect(hashMcpToken("mcp_a")).not.toBe(hashMcpToken("mcp_b"));
  });
});

describe("extractBearerToken", () => {
  const requestWith = (authorization: string | null) =>
    new Request("https://example.com/api/mcp", {
      headers: authorization ? { authorization } : {},
    });

  it("extracts a bearer token with the mcp_ prefix", () => {
    expect(
      extractBearerToken(requestWith("Bearer mcp_token123"))
    ).toBe("mcp_token123");
  });

  it("is case-insensitive on the scheme", () => {
    expect(extractBearerToken(requestWith("bearer mcp_x"))).toBe("mcp_x");
  });

  it("rejects tokens without the mcp_ prefix", () => {
    expect(extractBearerToken(requestWith("Bearer sk_other"))).toBeNull();
  });

  it("rejects missing or malformed headers", () => {
    expect(extractBearerToken(requestWith(null))).toBeNull();
    expect(extractBearerToken(requestWith("mcp_x"))).toBeNull();
    expect(extractBearerToken(requestWith("Basic mcp_x"))).toBeNull();
    expect(extractBearerToken(requestWith("Bearer "))).toBeNull();
  });
});
