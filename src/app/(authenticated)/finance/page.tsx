import { auth } from "@/auth";
import { db } from "@/db";
import {
  financialItems,
  financialAccounts,
  financialCategories,
  financialTransactions,
  areas,
  projects,
  budgets,
} from "@/db/schema";
import { eq, and, desc, isNull, gte, lt } from "drizzle-orm";
import { FinancialItemForm } from "@/components/finance/financial-item-form";
import {
  AccountForm,
  CategoryForm,
  TransactionForm,
  BudgetForm,
  DeleteTransactionButton,
} from "@/components/finance/life-finance-forms";
import { Progress } from "@/components/ui/progress";
import { BillLogo } from "@/components/finance/bill-logo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  recurringMonthlyTotal,
  netWorth,
  budgetVsActual,
} from "@/lib/services/finance-summary";
import {
  Receipt,
  Radio,
  Film,
  Wifi,
  Zap,
  Smartphone,
  Cloud,
  Music,
  BookOpen,
  Wallet,
  ArrowLeftRight,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";

const subscriptionIconMap: Record<string, LucideIcon> = {
  netflix: Film,
  spotify: Music,
  youtube: Film,
  cloud: Cloud,
  internet: Wifi,
  mobile: Smartphone,
  electricity: Zap,
  chatgpt: BookOpen,
  copilot: BookOpen,
  default: Radio,
};

function getSubscriptionIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(subscriptionIconMap)) {
    if (lower.includes(key)) return icon;
  }
  return subscriptionIconMap.default;
}

export default async function FinancePage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [bills, subscriptions, accountRows, categoryRows, transactionRows, areaRows, projectRows, budgetRows, monthTransactions] =
    await Promise.all([
      db
        .select()
        .from(financialItems)
        .where(
          and(
            eq(financialItems.userId, userId),
            eq(financialItems.type, "RECURRING_BILL"),
            eq(financialItems.status, "ACTIVE")
          )
        )
        .orderBy(desc(financialItems.createdAt)),
      db
        .select()
        .from(financialItems)
        .where(
          and(
            eq(financialItems.userId, userId),
            eq(financialItems.type, "SUBSCRIPTION"),
            eq(financialItems.status, "ACTIVE")
          )
        )
        .orderBy(desc(financialItems.createdAt)),
      db
        .select()
        .from(financialAccounts)
        .where(
          and(
            eq(financialAccounts.userId, userId),
            isNull(financialAccounts.archivedAt)
          )
        )
        .orderBy(desc(financialAccounts.createdAt)),
      db
        .select()
        .from(financialCategories)
        .where(eq(financialCategories.userId, userId))
        .orderBy(financialCategories.name),
      db
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
        .limit(100),
      db
        .select()
        .from(areas)
        .where(and(eq(areas.userId, userId), isNull(areas.archivedAt)))
        .orderBy(areas.name),
      db
        .select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(desc(projects.updatedAt)),
      db
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
        .orderBy(desc(budgets.createdAt)),
      db
        .select()
        .from(financialTransactions)
        .where(
          and(
            eq(financialTransactions.userId, userId),
            isNull(financialTransactions.deletedAt),
            gte(financialTransactions.transactionDate, monthStart),
            lt(financialTransactions.transactionDate, monthEnd)
          )
        ),
    ]);

  // Recurring obligations are amortized to true monthly cost.
  const recurringMonthly = recurringMonthlyTotal([...bills, ...subscriptions]);
  const actualMonthExpense = monthTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const actualMonthIncome = monthTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const netWorthTotal = netWorth(accountRows);

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#13141A]">Finance</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <AccountForm />
            <CategoryForm />
            <TransactionForm
              accounts={accountRows}
              categories={categoryRows}
              areas={areaRows}
              projects={projectRows}
            />
            <FinancialItemForm />
          </div>
        </div>

        {/* Summary Card — recurring obligations vs actual spending */}
        <div
          className="rounded-[28px] p-6 mb-6 text-[#13141A] relative overflow-hidden"
          style={{ backgroundColor: "#D0E77F" }}
        >
          <div className="relative z-10 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium opacity-70">
                Recurring obligations
              </p>
              <p className="text-[28px] font-bold tracking-tight mt-1">
                {recurringMonthly.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                <span className="text-base font-normal opacity-70">THB/mo</span>
              </p>
              <p className="text-xs mt-1 opacity-70">
                {bills.length + subscriptions.length} active items
              </p>
            </div>
            <div>
              <p className="text-sm font-medium opacity-70">
                Actual this month
              </p>
              <p className="text-[28px] font-bold tracking-tight mt-1">
                {actualMonthExpense.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                <span className="text-base font-normal opacity-70">spent</span>
              </p>
              <p className="text-xs mt-1 opacity-70">
                {actualMonthIncome.toLocaleString()} income
              </p>
            </div>
            <div>
              <p className="text-sm font-medium opacity-70">Net worth</p>
              <p className="text-[28px] font-bold tracking-tight mt-1">
                {netWorthTotal.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-xs mt-1 opacity-70">
                across {accountRows.length} accounts
              </p>
            </div>
          </div>
          <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full border-2 border-[#13141A]/10" />
          <div className="absolute -right-4 -top-4 w-36 h-36 rounded-full border-2 border-[#13141A]/8" />
          <div className="absolute right-4 -bottom-4 w-24 h-24 rounded-full border-2 border-[#13141A]/6" />
        </div>

        {/* Item Lists */}
        <Tabs defaultValue="bills" dir="ltr">
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto bg-white rounded-full p-1 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger
              value="bills"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#6B7280] data-[state=active]:bg-[#13141A] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Bills ({bills.length})
            </TabsTrigger>
            <TabsTrigger
              value="subscriptions"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#6B7280] data-[state=active]:bg-[#13141A] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Subscriptions ({subscriptions.length})
            </TabsTrigger>
            <TabsTrigger
              value="transactions"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#6B7280] data-[state=active]:bg-[#13141A] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Transactions
            </TabsTrigger>
            <TabsTrigger
              value="accounts"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#6B7280] data-[state=active]:bg-[#13141A] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Accounts ({accountRows.length})
            </TabsTrigger>
            <TabsTrigger
              value="budgets"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#6B7280] data-[state=active]:bg-[#13141A] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Budgets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="mt-4">
            {bills.length === 0 ? (
              <div className="rounded-[20px] bg-white p-8 text-center">
                <p className="text-[#6B7280]">No recurring bills yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bills.map((bill) => (
                  <FinancialItemCard key={bill.id} item={bill} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="subscriptions" className="mt-4">
            {subscriptions.length === 0 ? (
              <div className="rounded-[20px] bg-white p-8 text-center">
                <p className="text-[#6B7280]">No subscriptions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => (
                  <FinancialItemCard key={sub.id} item={sub} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transactions" className="mt-4 space-y-3">
            <p className="flex items-center gap-1 text-xs text-[#7A847E]">
              <ArrowLeftRight className="h-3 w-3" />
              Regular income and expenses — distinct from recurring obligations
              above.
            </p>
            {transactionRows.length === 0 ? (
              <div className="rounded-[20px] bg-white p-8 text-center">
                <p className="text-[#6B7280]">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactionRows.map(
                  ({ transaction: txn, accountName, categoryName, areaName, projectName }) => (
                    <div
                      key={txn.id}
                      className="rounded-[20px] bg-white p-4 flex items-center gap-4"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          txn.type === "INCOME" ? "bg-[#D0E77F]" : "bg-[#FBD4E6]"
                        }`}
                      >
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#13141A] text-sm truncate">
                          {txn.description ?? txn.merchant ?? txn.type}
                        </p>
                        <p className="text-xs text-[#6B7280] mt-0.5 truncate">
                          {txn.transactionDate.toLocaleDateString()} ·{" "}
                          {accountName}
                          {categoryName ? ` · ${categoryName}` : ""}
                          {areaName ? ` · ${areaName}` : ""}
                          {projectName ? ` · ${projectName}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <p
                          className={`font-bold ${
                            txn.type === "INCOME" ? "text-[#5B713B]" : "text-[#13141A]"
                          }`}
                        >
                          {txn.type === "INCOME" ? "+" : "−"}
                          {parseFloat(txn.amount).toLocaleString()}
                        </p>
                        <DeleteTransactionButton id={txn.id} />
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="accounts" className="mt-4">
            {accountRows.length === 0 ? (
              <div className="rounded-[20px] bg-white p-8 text-center">
                <p className="text-[#6B7280]">
                  No accounts yet. Add one to start recording transactions.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {accountRows.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-[20px] bg-white p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#ACCDFF] flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#13141A] text-sm truncate">
                        {account.name}
                      </p>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {account.type.replace(/_/g, " ")} · opening{" "}
                        {parseFloat(account.openingBalance).toLocaleString()}
                      </p>
                    </div>
                    <p className="font-bold text-[#13141A] text-sm shrink-0">
                      {parseFloat(account.currentBalance).toLocaleString()}{" "}
                      <span className="text-xs font-normal text-[#6B7280]">
                        {account.currency}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="budgets" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <BudgetForm categories={categoryRows} areas={areaRows} />
            </div>
            {budgetRows.length === 0 ? (
              <div className="rounded-[20px] bg-white p-8 text-center">
                <p className="text-[#6B7280]">
                  No budgets yet. Set a monthly limit per category or area.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {budgetRows.map(({ budget, categoryName, areaName }) => {
                  const vs = budgetVsActual(budget, monthTransactions, monthStart, monthEnd);
                  return (
                    <div key={budget.id} className="rounded-[20px] bg-white p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-[#13141A] text-sm flex items-center gap-2">
                          <PiggyBank className="h-4 w-4 text-[#7A847E]" />
                          {categoryName ?? areaName ?? "Budget"}
                        </p>
                        <p className="text-sm text-[#6B7280]">
                          {vs.actual.toLocaleString()} /{" "}
                          {vs.budget.toLocaleString()} {budget.currency}
                        </p>
                      </div>
                      <Progress
                        value={vs.percentUsed}
                        className={vs.remaining < 0 ? "bg-red-100" : undefined}
                      />
                      <p
                        className={`text-xs ${
                          vs.remaining < 0 ? "text-red-500" : "text-[#6B7280]"
                        }`}
                      >
                        {vs.remaining < 0
                          ? `Over budget by ${Math.abs(vs.remaining).toLocaleString()}`
                          : `${vs.remaining.toLocaleString()} remaining · ${Math.round(vs.percentUsed)}% used`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function FinancialItemCard({
  item,
}: {
  item: typeof financialItems.$inferSelect;
}) {
  const Icon =
    item.type === "SUBSCRIPTION" ? getSubscriptionIcon(item.name) : Receipt;
  return (
    <div className="rounded-[20px] bg-white p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0 overflow-hidden">
        <BillLogo logoUrl={item.logoUrl} fallbackIcon={Icon} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#13141A] truncate">{item.name}</p>
          {item.autoRenew && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#D0E77F] text-[#13141A] shrink-0">
              Auto-renew
            </span>
          )}
        </div>
        <p className="text-xs text-[#6B7280] mt-0.5 truncate">
          {item.billingCycle} ·{" "}
          {item.description || item.type.replace("_", " ")}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-[#13141A]">
          {parseFloat(item.amount).toLocaleString()}{" "}
          <span className="text-xs font-normal text-[#6B7280]">
            {item.currency}
          </span>
        </p>
        {item.billingDay && (
          <p className="text-xs text-[#6B7280] mt-0.5">
            Day {item.billingDay}
          </p>
        )}
      </div>
    </div>
  );
}
