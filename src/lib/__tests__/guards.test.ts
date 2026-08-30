import { describe, it, expect, vi, beforeEach } from "vitest";
import { assertOwnership } from "@/lib/guards";

// requireUserId depends on the NextAuth edge config; mock the module so the
// ownership guard can be tested without a database or session runtime.
const mockAuth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: mockAuth }));

import { requireUserId } from "@/lib/guards";

describe("requireUserId", () => {
  beforeEach(() => {
    mockAuth.mockReset();
  });

  it("returns the session user id when authenticated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    await expect(requireUserId()).resolves.toBe("user-1");
  });

  it("throws Unauthorized when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireUserId()).rejects.toThrow("Unauthorized");
  });

  it("throws Unauthorized when the session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });
    await expect(requireUserId()).rejects.toThrow("Unauthorized");
  });
});

describe("assertOwnership (cross-user access boundary)", () => {
  const ownerRow = { id: "row-1", userId: "user-1" };

  it("returns the row when it belongs to the requesting user", () => {
    expect(assertOwnership(ownerRow, "user-1")).toBe(ownerRow);
  });

  it("throws Not found for a missing row", () => {
    expect(() => assertOwnership(undefined, "user-1")).toThrow("Not found");
  });

  it("throws Not found when another user tries to read the row", () => {
    // Simulates a crafted id pointing at another user's entity.
    expect(() => assertOwnership(ownerRow, "attacker-9")).toThrow("Not found");
  });

  it("never leaks the row across users even when ids collide", () => {
    const foreignRow = { id: "row-1", userId: "someone-else" };
    expect(() => assertOwnership(foreignRow, "user-1")).toThrow("Not found");
  });
});
