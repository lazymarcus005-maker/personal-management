import { auth } from "@/auth";

/**
 * Returns the authenticated user's id or throws.
 * Every server action and route handler must go through this (or an
 * equivalent check) so queries are always scoped to an owner.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

/**
 * Pure ownership check used by mutation paths that receive related entity
 * ids: the loaded row must exist AND belong to the current user.
 */
export function assertOwnership<T extends { userId: string }>(
  row: T | undefined,
  userId: string
): T {
  if (!row || row.userId !== userId) throw new Error("Not found");
  return row;
}
