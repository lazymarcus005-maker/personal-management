"use server";

import { requireUserId } from "@/lib/guards";
import { getDb } from "@/db";
import {
  financialAccounts,
  financialCategories,
  financialTransactions,
  budgets,
  areas,
  projects,
} from "@/db/schema";
import { eq, and, desc, isNull, gte, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  transactionSchema,
  createTransactionCore,
} from "@/lib/services/transactions";

// ============================================================
// Accounts
// ============================================================

const accountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["BANK", "CASH", "WALLET", "INVESTMENT", "CREDIT_CARD"]),
  currency: z.string().default("THB"),
  openingBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/).default("0"),
});

export async function getAccounts(includeArchived = false) {
  const userId = await requireUserId();
  const db = await getDb();

  const conditions = [eq(financialAccounts.userId, userId)];
  if (!includeArchived) conditions.push(isNull(financialAccounts.archivedAt));

  return db
    .select()
    .from(financialAccounts)
    .where(and(...conditions))
    .orderBy(desc(financialAccounts.createdAt));
}

export async function createAccount(data: z.infer<typeof accountSchema>) {
  const userId = await requireUserId();
  const db = await getDb();
  const parsed = accountSchema.parse(data);

  const [account] = await db
    .insert(financialAccounts)
    .values({
      userId,
      name: parsed.name,
      type: parsed.type,
      currency: parsed.currency,
      openingBalance: parsed.openingBalance,
      // Start the running balance at the opening balance so net worth and
      // later transaction adjustments are not offset by the opening amount.
      currentBalance: parsed.openingBalance,
    })
    .returning();

  revalidatePath("/finance");
  return account;
}

export async function updateAccount(
  id: string,
  rawData: Partial<z.infer<typeof accountSchema>>
) {
  const userId = await requireUserId();
  const db = await getDb();

  // Parse before spreading so crafted payloads can't inject table fields.
  const data = accountSchema.partial().parse(rawData);
  const [account] = await db
    .update(financialAccounts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(financialAccounts.id, id), eq(financialAccounts.userId, userId)))
    .returning();

  revalidatePath("/finance");
  return account;
}

export async function archiveAccount(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const [account] = await db
    .update(financialAccounts)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(financialAccounts.id, id), eq(financialAccounts.userId, userId)))
    .returning();

  revalidatePath("/finance");
  return account;
}

// ============================================================
// Categories
// ============================================================

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

export async function getCategories() {
  const userId = await requireUserId();
  const db = await getDb();

  return db
    .select()
    .from(financialCategories)
    .where(eq(financialCategories.userId, userId))
    .orderBy(financialCategories.name);
}

export async function createCategory(data: z.infer<typeof categorySchema>) {
  const userId = await requireUserId();
  const db = await getDb();
  const parsed = categorySchema.parse(data);

  const [category] = await db
    .insert(financialCategories)
    .values({ userId, ...parsed })
    .returning();

  revalidatePath("/finance");
  return category;
}

export async function deleteCategory(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  await db
    .delete(financialCategories)
    .where(
      and(eq(financialCategories.id, id), eq(financialCategories.userId, userId))
    );

  revalidatePath("/finance");
}

// ============================================================
// Transactions
// ============================================================

export async function getTransactions(limit = 100) {
  const userId = await requireUserId();
  const db = await getDb();

  return db
    .select({
      transaction: financialTransactions,
      accountName: financialAccounts.name,
      categoryName: financialCategories.name,
      areaName: areas.name,
      projectName: projects.name,
    })
    .from(financialTransactions)
    .innerJoin(
      financialAccounts,
      eq(financialTransactions.accountId, financialAccounts.id)
    )
    .leftJoin(
      financialCategories,
      eq(financialTransactions.categoryId, financialCategories.id)
    )
    .leftJoin(areas, eq(financialTransactions.areaId, areas.id))
    .leftJoin(projects, eq(financialTransactions.projectId, projects.id))
    .where(
      and(
        eq(financialTransactions.userId, userId),
        isNull(financialTransactions.deletedAt)
      )
    )
    .orderBy(desc(financialTransactions.transactionDate))
    .limit(limit);
}

export async function createTransaction(
  data: z.infer<typeof transactionSchema>
) {
  const userId = await requireUserId();
  const result = await createTransactionCore(userId, data);

  revalidatePath("/finance");
  revalidatePath("/");
  return result;
}

/** Soft deletion: financial history is never hard-deleted. */
export async function deleteTransaction(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const result = await db.transaction(async (tx) => {
    // Ownership check + soft delete are atomic with the balance reversal so
    // the account never keeps a stale effect from a deleted transaction.
    const [txn] = await tx
      .update(financialTransactions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(financialTransactions.id, id),
          eq(financialTransactions.userId, userId),
          isNull(financialTransactions.deletedAt)
        )
      )
      .returning();

    if (txn && txn.type !== "TRANSFER") {
      // Creation signed the amount (+income / −expense); reverse it.
      const reversal =
        txn.type === "INCOME" ? `-${txn.amount}` : txn.amount;
      await tx
        .update(financialAccounts)
        .set({
          currentBalance: sql`${financialAccounts.currentBalance} + ${reversal}`,
          updatedAt: new Date(),
        })
        .where(eq(financialAccounts.id, txn.accountId));
    }

    return txn;
  });

  revalidatePath("/finance");
  revalidatePath("/");
  return result;
}

// ============================================================
// Budgets
// ============================================================

const budgetSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  areaId: z.string().uuid().optional().nullable(),
  period: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().default("THB"),
});

export async function getBudgets() {
  const userId = await requireUserId();
  const db = await getDb();

  return db
    .select({
      budget: budgets,
      categoryName: financialCategories.name,
      areaName: areas.name,
    })
    .from(budgets)
    .leftJoin(
      financialCategories,
      eq(budgets.categoryId, financialCategories.id)
    )
    .leftJoin(areas, eq(budgets.areaId, areas.id))
    .where(eq(budgets.userId, userId))
    .orderBy(desc(budgets.createdAt));
}

export async function createBudget(data: z.infer<typeof budgetSchema>) {
  const userId = await requireUserId();
  const db = await getDb();
  const parsed = budgetSchema.parse(data);

  if (!parsed.categoryId && !parsed.areaId) {
    throw new Error("Budget needs a category or an area");
  }
  if (parsed.categoryId) {
    const [category] = await db
      .select({ id: financialCategories.id })
      .from(financialCategories)
      .where(
        and(
          eq(financialCategories.id, parsed.categoryId),
          eq(financialCategories.userId, userId)
        )
      );
    if (!category) throw new Error("Category not found");
  }
  if (parsed.areaId) {
    const [area] = await db
      .select({ id: areas.id })
      .from(areas)
      .where(and(eq(areas.id, parsed.areaId), eq(areas.userId, userId)));
    if (!area) throw new Error("Area not found");
  }

  const [budget] = await db
    .insert(budgets)
    .values({
      userId,
      categoryId: parsed.categoryId ?? null,
      areaId: parsed.areaId ?? null,
      period: parsed.period,
      amount: parsed.amount,
      currency: parsed.currency,
    })
    .returning();

  revalidatePath("/finance");
  return budget;
}

export async function deleteBudget(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  await db
    .delete(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));

  revalidatePath("/finance");
}

/** Transactions for the current calendar month, for budget-vs-actual views. */
export async function getTransactionsForCurrentMonth() {
  const userId = await requireUserId();
  const db = await getDb();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return db
    .select()
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.userId, userId),
        isNull(financialTransactions.deletedAt),
        gte(financialTransactions.transactionDate, monthStart),
        lt(financialTransactions.transactionDate, monthEnd)
      )
    );
}
