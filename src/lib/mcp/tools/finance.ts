import { z } from "zod";
import {
  financialAccounts,
  financialCategories,
  financialTransactions,
  financialItems,
  budgets,
  areas,
  projects,
} from "@/db/schema";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  budgetVsActual,
  monthlyIncomeExpense,
  netWorth,
  nextDueDate,
  recurringMonthlyTotal,
  spendingByCategory,
} from "@/lib/services/finance-summary";
import { createTransactionCore } from "@/lib/services/transactions";
import { logMcpToolCall, summarizeArgs } from "../audit";
import { safeRun, optionalId, dateOnly } from "./shared";
import type { ToolDefinition } from "../types";

// ------------------------------------------------------------------
// Read
// ------------------------------------------------------------------

const listAccountsSchema = z.object({
  includeArchived: z.boolean().optional().default(false),
});

export const listAccountsTool: ToolDefinition<typeof listAccountsSchema> = {
  name: "list_accounts",
  config: {
    title: "List Accounts",
    description: "List the user's financial accounts with current balances.",
    inputSchema: listAccountsSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const conditions = [eq(financialAccounts.userId, ctx.userId)];
      if (!args.includeArchived) {
        conditions.push(isNull(financialAccounts.archivedAt));
      }
      return db
        .select()
        .from(financialAccounts)
        .where(and(...conditions))
        .orderBy(desc(financialAccounts.createdAt));
    }),
};

const listCategoriesSchema = z.object({});

export const listCategoriesTool: ToolDefinition<typeof listCategoriesSchema> = {
  name: "list_categories",
  config: {
    title: "List Categories",
    description: "List the user's transaction categories (useful before creating transactions).",
    inputSchema: listCategoriesSchema,
  },
  handler: (ctx) =>
    safeRun(async () => {
      const db = await getDb();
      return db
        .select()
        .from(financialCategories)
        .where(eq(financialCategories.userId, ctx.userId))
        .orderBy(asc(financialCategories.name));
    }),
};

const listTransactionsSchema = z.object({
  from: dateOnly.optional().describe("Transactions on/after this date"),
  to: dateOnly.optional().describe("Transactions on/before this date"),
  accountId: optionalId,
  categoryId: optionalId,
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export const listTransactionsTool: ToolDefinition<typeof listTransactionsSchema> = {
  name: "list_transactions",
  config: {
    title: "List Transactions",
    description:
      "List financial transactions (soft-deleted ones excluded), newest first, with account/category/area/project names.",
    inputSchema: listTransactionsSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      const db = await getDb();
      const conditions = [
        eq(financialTransactions.userId, ctx.userId),
        isNull(financialTransactions.deletedAt),
      ];
      if (args.from) {
        conditions.push(gte(financialTransactions.transactionDate, new Date(args.from)));
      }
      if (args.to) {
        const end = new Date(args.to);
        end.setDate(end.getDate() + 1); // inclusive day bound
        conditions.push(lt(financialTransactions.transactionDate, end));
      }
      if (args.accountId) {
        conditions.push(eq(financialTransactions.accountId, args.accountId));
      }
      if (args.categoryId) {
        conditions.push(eq(financialTransactions.categoryId, args.categoryId));
      }
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
        .where(and(...conditions))
        .orderBy(desc(financialTransactions.transactionDate))
        .limit(args.limit);
    }),
};

const getFinanceSummarySchema = z.object({});

export const getFinanceSummaryTool: ToolDefinition<typeof getFinanceSummarySchema> = {
  name: "get_finance_summary",
  config: {
    title: "Get Finance Summary",
    description:
      "Snapshot of the current month: net worth, income vs expense, budget vs actual per category/area, spending by category, recurring monthly cost and upcoming recurring bills.",
    inputSchema: getFinanceSummarySchema,
  },
  handler: (ctx) =>
    safeRun(async () => {
      const db = await getDb();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [accounts, monthTransactions, userBudgets, categories, recurringItems] =
        await Promise.all([
          db
            .select()
            .from(financialAccounts)
            .where(
              and(
                eq(financialAccounts.userId, ctx.userId),
                isNull(financialAccounts.archivedAt)
              )
            ),
          db
            .select()
            .from(financialTransactions)
            .where(
              and(
                eq(financialTransactions.userId, ctx.userId),
                isNull(financialTransactions.deletedAt),
                gte(financialTransactions.transactionDate, monthStart),
                lt(financialTransactions.transactionDate, monthEnd)
              )
            ),
          db
            .select({ budget: budgets, categoryName: financialCategories.name })
            .from(budgets)
            .leftJoin(
              financialCategories,
              eq(budgets.categoryId, financialCategories.id)
            )
            .where(eq(budgets.userId, ctx.userId)),
          db
            .select({ id: financialCategories.id, name: financialCategories.name })
            .from(financialCategories)
            .where(eq(financialCategories.userId, ctx.userId)),
          db
            .select()
            .from(financialItems)
            .where(
              and(
                eq(financialItems.userId, ctx.userId),
                eq(financialItems.status, "ACTIVE")
              )
            ),
        ]);

      const categoryName = new Map(categories.map((c) => [c.id, c.name]));

      const upcoming = recurringItems
        .map((item) => {
          const due = nextDueDate(
            {
              billingCycle: item.billingCycle,
              billingDay: item.billingDay,
              startDate: item.startDate,
            },
            now
          );
          return due
            ? {
                id: item.id,
                name: item.name,
                type: item.type,
                amount: parseFloat(item.amount),
                currency: item.currency ?? "THB",
                nextDueDate: due.toISOString().slice(0, 10),
              }
            : null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
        .slice(0, 10);

      return {
        month: monthStart.toISOString().slice(0, 7),
        netWorth: netWorth(accounts),
        income: monthlyIncomeExpense(monthTransactions, monthStart).income,
        expense: monthlyIncomeExpense(monthTransactions, monthStart).expense,
        recurringMonthlyTotal: recurringMonthlyTotal(recurringItems),
        budgets: userBudgets.map(({ budget, categoryName: catName }) => ({
          id: budget.id,
          category: catName ?? (budget.areaId ? "area-scoped" : null),
          period: budget.period,
          currency: budget.currency ?? "THB",
          ...budgetVsActual(budget, monthTransactions, monthStart, monthEnd),
        })),
        spendingByCategory: [...spendingByCategory(monthTransactions, monthStart, monthEnd)]
          .map(([categoryId, total]) => ({
            category: categoryName.get(categoryId) ?? categoryId,
            total,
          }))
          .sort((a, b) => b.total - a.total),
        upcomingBills: upcoming,
      };
    }),
};

// ------------------------------------------------------------------
// Write
// ------------------------------------------------------------------

const createTransactionSchema = z.object({
  accountId: z.string().uuid().describe("Account the transaction moves"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .describe("Positive amount with up to 2 decimals, e.g. \"150.00\""),
  currency: z.string().optional().default("THB"),
  transactionDate: dateOnly.optional().describe("Defaults to today"),
  categoryId: optionalId,
  merchant: z.string().max(200).optional(),
  description: z.string().optional(),
  areaId: optionalId,
  projectId: optionalId,
});

export const createTransactionTool: ToolDefinition<typeof createTransactionSchema> = {
  name: "create_transaction",
  config: {
    title: "Create Transaction",
    description:
      "Record a financial transaction and update the account balance (same core as the app). List/list_accounts first to get valid ids.",
    inputSchema: createTransactionSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      logMcpToolCall(ctx.userId, "create_transaction", summarizeArgs(args));
      return createTransactionCore(ctx.userId, {
        accountId: args.accountId,
        categoryId: args.categoryId ?? null,
        type: args.type,
        amount: args.amount,
        currency: args.currency ?? "THB",
        transactionDate: args.transactionDate ?? new Date().toISOString().slice(0, 10),
        merchant: args.merchant,
        description: args.description,
        areaId: args.areaId ?? null,
        projectId: args.projectId ?? null,
      });
    }),
};

const deleteTransactionSchema = z.object({
  transactionId: z.string().uuid(),
});

export const deleteTransactionTool: ToolDefinition<typeof deleteTransactionSchema> = {
  name: "delete_transaction",
  config: {
    title: "Delete Transaction",
    description:
      "Soft-delete a transaction and reverse its balance effect. Financial history is never hard-deleted.",
    inputSchema: deleteTransactionSchema,
  },
  handler: (ctx, args) =>
    safeRun(async () => {
      logMcpToolCall(ctx.userId, "delete_transaction", {
        transactionId: args.transactionId,
      });
      const db = await getDb();
      const result = await db.transaction(async (tx) => {
        const [txn] = await tx
          .update(financialTransactions)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(financialTransactions.id, args.transactionId),
              eq(financialTransactions.userId, ctx.userId),
              isNull(financialTransactions.deletedAt)
            )
          )
          .returning();
        if (!txn) throw new Error("Transaction not found (or already deleted)");
        if (txn.type !== "TRANSFER") {
          const reversal = txn.type === "INCOME" ? `-${txn.amount}` : txn.amount;
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
      return result;
    }),
};
