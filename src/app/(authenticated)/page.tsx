import { auth } from "@/auth";
import { db } from "@/db";
import { todos, financialItems, creditCards, notes } from "@/db/schema";
import { eq, and, isNull, lte, desc, asc, sql } from "drizzle-orm";
import {
  FileText,
  ListTodo,
  Receipt,
  CreditCard,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  bgColor,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  bgColor: string;
}) {
  return (
    <div
      className="rounded-[20px] p-4 text-[#13141A]"
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium opacity-70">{title}</p>
        <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

const priorityDot: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-neutral-300",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const name = session.user.name || "User";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const [todoToday, overdueTodos, upcomingBills, latestNotes] =
    await Promise.all([
      db
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.userId, userId),
            eq(todos.status, "TODO"),
            lte(todos.dueAt, today)
          )
        )
        .orderBy(desc(todos.priority)),
      db
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.userId, userId),
            eq(todos.status, "TODO"),
            sql`${todos.dueAt} IS NOT NULL AND ${todos.dueAt} < ${today}`
          )
        )
        .orderBy(asc(todos.dueAt)),
      db
        .select()
        .from(financialItems)
        .where(
          and(
            eq(financialItems.userId, userId),
            eq(financialItems.status, "ACTIVE")
          )
        )
        .orderBy(desc(financialItems.createdAt)),
      db
        .select()
        .from(notes)
        .where(and(eq(notes.userId, userId), isNull(notes.archivedAt)))
        .orderBy(desc(notes.createdAt))
        .limit(5),
    ]);

  const activeSubscriptions = upcomingBills.filter(
    (b) => b.type === "SUBSCRIPTION"
  );
  const totalMonthlySubscriptions = activeSubscriptions.reduce(
    (sum, b) => sum + parseFloat(b.amount),
    0
  );

  const activeCreditCards = await db
    .select()
    .from(creditCards)
    .where(
      and(eq(creditCards.userId, userId), eq(creditCards.status, "ACTIVE"))
    );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#EEF0F5" }}>
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#13141A]">
              Welcome, {name.split(" ")[0]}!
            </h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{dateStr}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#E5DBFE] flex items-center justify-center text-sm font-semibold text-[#13141A] shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Hero Card */}
        <div
          className="rounded-[28px] p-6 mb-6 text-[#13141A] relative overflow-hidden"
          style={{ backgroundColor: "#D0E77F" }}
        >
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-70 mb-1">
              Tasks Due Today
            </p>
            <p className="text-xs opacity-60 mb-1">{dateStr}</p>
            <p className="text-[32px] font-bold tracking-tight mt-2">
              {todoToday.length}{" "}
              <span className="text-lg font-normal opacity-70">tasks</span>
            </p>
            <p className="text-sm mt-1 opacity-70">
              {overdueTodos.length} overdue ·{" "}
              {totalMonthlySubscriptions.toLocaleString()} THB/mo subscriptions
            </p>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full border-2 border-[#13141A]/10" />
          <div className="absolute -right-4 -top-4 w-36 h-36 rounded-full border-2 border-[#13141A]/8" />
          <div className="absolute right-4 -bottom-4 w-24 h-24 rounded-full border-2 border-[#13141A]/6" />
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MetricCard
            title="Tasks Today"
            value={todoToday.length}
            sub={`${overdueTodos.length} overdue`}
            icon={ListTodo}
            bgColor="#FBD4E6"
          />
          <MetricCard
            title="Subscriptions"
            value={totalMonthlySubscriptions.toLocaleString()}
            sub={`${activeSubscriptions.length} active · THB/mo`}
            icon={Receipt}
            bgColor="#E5DBFE"
          />
          <MetricCard
            title="Active Cards"
            value={activeCreditCards.length}
            sub="credit cards"
            icon={CreditCard}
            bgColor="#ACCDFF"
          />
          <MetricCard
            title="Recent Notes"
            value={latestNotes.length}
            sub="latest notes"
            icon={FileText}
            bgColor="#D0E77F"
          />
        </div>

        {/* Content Sections */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tasks Today */}
          <section>
            <h2 className="text-lg font-bold text-[#13141A] mb-3">
              Tasks Today
            </h2>
            {todoToday.length === 0 ? (
              <div className="rounded-[20px] bg-white p-6 text-center">
                <p className="text-sm text-[#6B7280]">No tasks due today</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {todoToday.map((todo) => (
                  <div
                    key={todo.id}
                    className="rounded-[20px] bg-white p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          priorityDot[todo.priority] ?? priorityDot.LOW
                        }`}
                      />
                    </div>
                    <p className="flex-1 min-w-0 font-semibold text-[#13141A] text-sm truncate">
                      {todo.title}
                    </p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EEF0F5] text-[#6B7280] shrink-0">
                      {todo.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Overdue Tasks */}
          <section>
            <h2 className="text-lg font-bold text-[#13141A] mb-3">
              Overdue Tasks
            </h2>
            {overdueTodos.length === 0 ? (
              <div className="rounded-[20px] bg-white p-6 text-center">
                <p className="text-sm text-[#6B7280]">No overdue tasks</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {overdueTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="rounded-[20px] bg-white p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#FFD4D4] flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#13141A] text-sm truncate">
                        {todo.title}
                      </p>
                      {todo.dueAt && (
                        <p className="text-xs text-red-500 mt-0.5">
                          Due {todo.dueAt.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Active Bills & Subscriptions */}
          <section>
            <h2 className="text-lg font-bold text-[#13141A] mb-3">
              Active Bills &amp; Subscriptions
            </h2>
            {upcomingBills.length === 0 ? (
              <div className="rounded-[20px] bg-white p-6 text-center">
                <p className="text-sm text-[#6B7280]">No active items</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {upcomingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="rounded-[20px] bg-white p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4 text-[#13141A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#13141A] text-sm truncate">
                        {bill.name}
                      </p>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {bill.billingCycle} ·{" "}
                        {bill.type === "SUBSCRIPTION" ? "Subscription" : "Bill"}
                      </p>
                    </div>
                    <p className="font-bold text-[#13141A] text-sm shrink-0">
                      {parseFloat(bill.amount).toLocaleString()}{" "}
                      <span className="text-xs font-normal text-[#6B7280]">
                        {bill.currency}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Notes */}
          <section>
            <h2 className="text-lg font-bold text-[#13141A] mb-3">
              Recent Notes
            </h2>
            {latestNotes.length === 0 ? (
              <div className="rounded-[20px] bg-white p-6 text-center">
                <p className="text-sm text-[#6B7280]">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {latestNotes.map((note) => (
                  <Link
                    key={note.id}
                    href="/notes"
                    className="rounded-[20px] bg-white p-4 flex items-center gap-4 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-[#13141A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[#13141A] text-sm truncate">
                          {note.title}
                        </p>
                        {note.isPinned && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E5DBFE] text-[#13141A] shrink-0">
                            Pinned
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {note.noteType} · {note.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
