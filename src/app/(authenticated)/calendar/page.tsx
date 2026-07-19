import { auth } from "@/auth";
import { db } from "@/db";
import { todos, financialOccurrences, financialItems } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { CalendarDays, CheckCircle2, Receipt } from "lucide-react";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [monthlyTodos, monthlyOccurrences] = await Promise.all([
    db
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.userId, userId),
          sql`${todos.dueAt} >= ${monthStart} AND ${todos.dueAt} <= ${monthEnd}`
        )
      ),
    db
      .select({
        occurrence: financialOccurrences,
        item: financialItems,
      })
      .from(financialOccurrences)
      .innerJoin(
        financialItems,
        eq(financialOccurrences.financialItemId, financialItems.id)
      )
      .where(
        and(
          eq(financialItems.userId, userId),
          sql`${financialOccurrences.dueDate} >= ${monthStart} AND ${financialOccurrences.dueDate} <= ${monthEnd}`
        )
      ),
  ]);

  const daysInMonth = monthEnd.getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), i + 1);
    const dayTodos = monthlyTodos.filter(
      (t) => t.dueAt && t.dueAt.getDate() === i + 1
    );
    const dayPayments = monthlyOccurrences.filter(
      (o) => o.occurrence.dueDate.getDate() === i + 1
    );
    return { date, todos: dayTodos, payments: dayPayments };
  });

  const activeDays = days.filter((day) => day.todos.length || day.payments.length);

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">Schedule</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Calendar</h1>
          <p className="mt-1 text-sm text-[#69736D]">{format(now, "MMMM yyyy")}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E4EED7]">
          <CalendarDays className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {activeDays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#CDD3CD] bg-white/60 p-10 text-center text-sm text-[#69736D]">Nothing scheduled this month.</div>
        ) : activeDays.map(({ date, todos: dayTodos, payments: dayPayments }) => (
          <section key={date.getTime()} className="overflow-hidden rounded-2xl border border-[#E2E6E0] bg-white">
            <div className="flex items-center gap-3 border-b border-[#EEF1EC] px-4 py-3">
              <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[#18201C] text-white">
                <span className="text-[9px] font-semibold uppercase tracking-wide">{format(date, "EEE")}</span>
                <span className="text-lg font-bold leading-none">{date.getDate()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold">{format(date, "EEEE")}</p>
                <p className="text-xs text-[#69736D]">{dayTodos.length + dayPayments.length} items</p>
              </div>
            </div>
            <div className="divide-y divide-[#EEF1EC]">
              {dayTodos.map((todo) => (
                <div key={todo.id} className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6E8B55]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{todo.title}</span>
                  <span className="text-[10px] font-semibold uppercase text-[#7A847E]">Task</span>
                </div>
              ))}
              {dayPayments.map((payment) => (
                <div key={payment.occurrence.id} className="flex items-center gap-3 px-4 py-3">
                  <Receipt className="h-4 w-4 shrink-0 text-[#8A6E4B]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{payment.item.name}</span>
                  <span className="text-sm font-bold">{parseFloat(payment.occurrence.expectedAmount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-2xl border border-[#DDE2DC] bg-[#DDE2DC] md:grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="bg-[#FAFBF8] p-3 text-center text-xs font-semibold text-[#69736D]"
          >
            {day}
          </div>
        ))}
        {Array.from({ length: new Date(now.getFullYear(), now.getMonth(), 1).getDay() }).map(
          (_, i) => (
            <div key={`empty-${i}`} className="min-h-[110px] bg-white p-2" />
          )
        )}
        {days.map(({ date, todos: dayTodos, payments: dayPayments }) => {
          const isToday =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth();
          return (
            <div
              key={date.getTime()}
              className={`min-h-[110px] bg-white p-2 ${
                isToday ? "ring-2 ring-inset ring-[#6E8B55]" : ""
              }`}
            >
              <p
                className={`text-xs font-medium mb-1 ${
                  isToday
                    ? "text-[#18201C]"
                    : "text-[#98A09B]"
                }`}
              >
                {date.getDate()}
              </p>
              <div className="space-y-0.5">
                {dayTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="truncate rounded-md bg-[#E4EED7] px-1.5 py-1 text-[10px] font-medium text-[#405433]"
                  >
                    {todo.title}
                  </div>
                ))}
                {dayPayments.map((p) => (
                  <div
                    key={p.occurrence.id}
                    className="truncate rounded-md bg-[#F3E7D5] px-1.5 py-1 text-[10px] font-medium text-[#725738]"
                  >
                    {p.item.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
