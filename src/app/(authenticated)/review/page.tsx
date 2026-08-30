import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  todos,
  journalEntries,
  financialTransactions,
  financialItems,
  projects,
  financialCategories,
  areas,
} from "@/db/schema";
import { and, eq, gte, lt, isNull, desc } from "drizzle-orm";
import { appDayStart, appDayEnd, appMonthStart, formatAppDate } from "@/lib/dates";
import Link from "next/link";
import {
  spendingByCategory,
  spendingByArea,
  recurringMonthlyTotal,
} from "@/lib/services/finance-summary";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = periodParam === "month" ? "month" : "week";

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;
  const db = await getDb();

  // Wall-clock boundaries in the app timezone so the review window matches
  // the days the user actually lived, not the server's calendar.
  const now = new Date();
  const periodStart =
    period === "week"
      ? appDayStart(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)) // last 7 days incl. today
      : appMonthStart(); // calendar month to date
  const periodEnd = appDayEnd();

  const [
    completedTodos,
    createdTodos,
    journals,
    transactions,
    recurringItems,
    activeProjects,
    categoryRows,
    areaRows,
  ] = await Promise.all([
    db
      .select({ id: todos.id })
      .from(todos)
      .where(
        and(
          eq(todos.userId, userId),
          eq(todos.status, "DONE"),
          gte(todos.completedAt, periodStart)
        )
      ),
    db
      .select({ id: todos.id })
      .from(todos)
      .where(
        and(
          eq(todos.userId, userId),
          gte(todos.createdAt, periodStart),
          lt(todos.createdAt, periodEnd)
        )
      ),
    db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          gte(journalEntries.entryDate, periodStart)
        )
      )
      .orderBy(desc(journalEntries.entryDate)),
    db
      .select()
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.userId, userId),
          isNull(financialTransactions.deletedAt),
          gte(financialTransactions.transactionDate, periodStart),
          // Exclude future-dated transactions so period totals match the
          // category/area breakdowns, which already bound by periodEnd.
          lt(financialTransactions.transactionDate, periodEnd)
        )
      ),
    db
      .select()
      .from(financialItems)
      .where(
        and(
          eq(financialItems.userId, userId),
          eq(financialItems.status, "ACTIVE")
        )
      ),
    db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.status, "ACTIVE"))),
    db
      .select()
      .from(financialCategories)
      .where(eq(financialCategories.userId, userId)),
    db
      .select()
      .from(areas)
      .where(and(eq(areas.userId, userId), isNull(areas.archivedAt))),
  ]);

  const income = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const expense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const byCategory = spendingByCategory(transactions, periodStart, periodEnd);
  const byArea = spendingByArea(transactions, periodStart, periodEnd);
  const recurring = recurringMonthlyTotal(recurringItems);

  const categoryName = (id: string) =>
    categoryRows.find((c) => c.id === id)?.name ?? "Unknown";
  const areaName = (id: string) =>
    areaRows.find((a) => a.id === id)?.name ?? "Unknown";
  const topCategories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topAreas = [...byArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategory = topCategories[0]?.[1] ?? 1;

  const stats = [
    { label: "Tasks completed", value: completedTodos.length },
    { label: "Tasks created", value: createdTodos.length },
    { label: "Journal entries", value: journals.length },
    { label: "Active projects", value: activeProjects.length },
  ];

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">
              Life OS
            </p>
            <h1 className="text-2xl font-bold text-[#18201C]">Review</h1>
            <p className="text-sm text-[#69736D] mt-0.5">
              {period === "week" ? "Last 7 days" : "This month"} — what moved,
              what spent, what felt.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm">
            <Link
              href="/review?period=week"
              className={`rounded-full px-3 py-1.5 text-sm ${
                period === "week"
                  ? "bg-[#18201C] text-white"
                  : "text-[#6B7280]"
              }`}
            >
              Week
            </Link>
            <Link
              href="/review?period=month"
              className={`rounded-full px-3 py-1.5 text-sm ${
                period === "month"
                  ? "bg-[#18201C] text-white"
                  : "text-[#6B7280]"
              }`}
            >
              Month
            </Link>
          </div>
        </div>

        {/* Period stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[20px] bg-white p-4 shadow-sm">
              <p className="text-2xl font-bold text-[#13141A]">{stat.value}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Money review */}
        <section className="rounded-[20px] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#13141A]">Money</h2>
            <Link
              href="/finance"
              className="text-xs text-[#69736D] hover:text-[#18201C] flex items-center gap-0.5"
            >
              Finance <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-lg font-bold text-[#5B713B]">
                +{income.toLocaleString()}
              </p>
              <p className="text-xs text-[#6B7280]">Income</p>
            </div>
            <div>
              <p className="text-lg font-bold text-[#13141A]">
                −{expense.toLocaleString()}
              </p>
              <p className="text-xs text-[#6B7280]">Expenses (actual)</p>
            </div>
            <div>
              <p className="text-lg font-bold text-[#13141A]">
                {recurring.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-[#6B7280]">Recurring / month</p>
            </div>
          </div>

          {topCategories.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7A847E]">
                Spending by category
              </p>
              {topCategories.map(([id, amount]) => (
                <div key={id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#13141A]">{categoryName(id)}</span>
                    <span className="text-[#6B7280]">{amount.toLocaleString()}</span>
                  </div>
                  <Progress
                    value={(amount / maxCategory) * 100}
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          )}

          {topAreas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7A847E]">
                Spending by area
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topAreas.map(([id, amount]) => (
                  <span
                    key={id}
                    className="rounded-full bg-[#EEF0F5] px-3 py-1 text-xs text-[#13141A]"
                  >
                    {areaName(id)}: {amount.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Reflection review */}
        <section className="rounded-[20px] bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#13141A]">Reflections</h2>
            <Link
              href="/journal"
              className="text-xs text-[#69736D] hover:text-[#18201C] flex items-center gap-0.5"
            >
              Journal <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {journals.length === 0 ? (
            <p className="text-sm text-[#AEB6AE]">
              No journal entries this period.
            </p>
          ) : (
            <ul className="space-y-2">
              {journals.slice(0, 5).map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 text-sm">
                  <ArrowLeft className="h-3 w-3 rotate-180 text-[#AEB6AE]" />
                  <span className="flex-1 min-w-0 truncate text-[#13141A]">
                    {entry.title ?? entry.content ?? "Entry"}
                  </span>
                  <span className="text-[10px] text-[#7A847E] shrink-0">
                    {formatAppDate(entry.entryDate)} · {entry.mood ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
