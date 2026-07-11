import { auth } from "@/auth";
import { db } from "@/db";
import { todos, financialOccurrences, financialItems } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth } from "date-fns";
import Link from "next/link";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          {format(now, "MMMM yyyy")}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-px bg-neutral-200 dark:bg-neutral-800 rounded-lg overflow-hidden">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="bg-neutral-50 dark:bg-neutral-900 p-2 text-center text-xs font-medium text-neutral-500"
          >
            {day}
          </div>
        ))}
        {Array.from({ length: new Date(now.getFullYear(), now.getMonth(), 1).getDay() }).map(
          (_, i) => (
            <div key={`empty-${i}`} className="bg-white dark:bg-neutral-950 min-h-[100px] p-1" />
          )
        )}
        {days.map(({ date, todos: dayTodos, payments: dayPayments }) => {
          const isToday =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth();
          return (
            <div
              key={date.getTime()}
              className={`bg-white dark:bg-neutral-950 min-h-[100px] p-1 ${
                isToday ? "ring-2 ring-inset ring-neutral-900 dark:ring-neutral-50" : ""
              }`}
            >
              <p
                className={`text-xs font-medium mb-1 ${
                  isToday
                    ? "text-neutral-900 dark:text-neutral-50"
                    : "text-neutral-400"
                }`}
              >
                {date.getDate()}
              </p>
              <div className="space-y-0.5">
                {dayTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="text-[10px] truncate rounded bg-blue-100 px-1 py-0.5 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                  >
                    {todo.title}
                  </div>
                ))}
                {dayPayments.map((p) => (
                  <div
                    key={p.occurrence.id}
                    className="text-[10px] truncate rounded bg-green-100 px-1 py-0.5 text-green-800 dark:bg-green-900 dark:text-green-100"
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
  );
}
