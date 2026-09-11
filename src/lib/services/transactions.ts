import { getDb } from "@/db";
import {
  financialAccounts,
  financialCategories,
  financialTransactions,
  areas,
  projects,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

export const transactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().default("THB"),
  transactionDate: z.string(),
  merchant: z.string().max(200).optional(),
  description: z.string().optional(),
  areaId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
});

export type CreateTransactionInput = z.infer<typeof transactionSchema>;

/** Account, category, area and project ids must all be owned by the user. */
export async function assertTransactionRelationsOwned(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  accountId: string,
  categoryId?: string | null,
  areaId?: string | null,
  projectId?: string | null
) {
  const [account] = await db
    .select({ id: financialAccounts.id })
    .from(financialAccounts)
    .where(
      and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId))
    );
  if (!account) throw new Error("Account not found");

  if (categoryId) {
    const [category] = await db
      .select({ id: financialCategories.id })
      .from(financialCategories)
      .where(
        and(
          eq(financialCategories.id, categoryId),
          eq(financialCategories.userId, userId)
        )
      );
    if (!category) throw new Error("Category not found");
  }
  if (areaId) {
    const [area] = await db
      .select({ id: areas.id })
      .from(areas)
      .where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
    if (!area) throw new Error("Area not found");
  }
  if (projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!project) throw new Error("Project not found");
  }
}

/**
 * Creates a transaction and keeps the account balance in sync. Shared by the
 * `createTransaction` server action and the MCP `create_transaction` tool.
 */
export async function createTransactionCore(
  userId: string,
  data: CreateTransactionInput
) {
  const db = await getDb();
  const parsed = transactionSchema.parse(data);

  await assertTransactionRelationsOwned(
    db,
    userId,
    parsed.accountId,
    parsed.categoryId,
    parsed.areaId,
    parsed.projectId
  );

  return db.transaction(async (tx) => {
    const [txn] = await tx
      .insert(financialTransactions)
      .values({
        userId,
        accountId: parsed.accountId,
        categoryId: parsed.categoryId ?? null,
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        transactionDate: new Date(parsed.transactionDate),
        merchant: parsed.merchant,
        description: parsed.description,
        areaId: parsed.areaId ?? null,
        projectId: parsed.projectId ?? null,
      })
      .returning();

    // Keep the account balance in sync with the transaction history.
    const signedAmount =
      parsed.type === "INCOME"
        ? parsed.amount
        : parsed.type === "EXPENSE"
          ? `-${parsed.amount}`
          : "0";
    await tx
      .update(financialAccounts)
      .set({
        currentBalance: sql`${financialAccounts.currentBalance} + ${signedAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(financialAccounts.id, parsed.accountId));

    return txn;
  });
}
