import { auth } from "@/auth";
import { db } from "@/db";
import {
  todos,
  financialItems,
  financialOccurrences,
  creditCards,
  creditCardStatements,
  notes,
} from "@/db/schema";
import { eq, and, isNull, lte, gte, desc, sql } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ListTodo, Receipt, CreditCard } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

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
        .where(
          and(eq(notes.userId, userId), isNull(notes.archivedAt))
        )
        .orderBy(desc(notes.createdAt))
        .limit(5),
    ]);

  const totalMonthlySubscriptions = upcomingBills
    .filter((b) => b.type === "SUBSCRIPTION")
    .reduce((sum, b) => sum + parseFloat(b.amount), 0);

  const activeCreditCards = await db
    .select()
    .from(creditCards)
    .where(
      and(eq(creditCards.userId, userId), eq(creditCards.status, "ACTIVE"))
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          Welcome back, {session.user.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasks Today</CardTitle>
            <ListTodo className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todoToday.length}</div>
            <p className="text-xs text-neutral-500 mt-1">
              {overdueTodos.length} overdue
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Subscriptions
            </CardTitle>
            <Receipt className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalMonthlySubscriptions.toLocaleString()} THB
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {upcomingBills.filter((b) => b.type === "SUBSCRIPTION").length}{" "}
              active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Cards
            </CardTitle>
            <CreditCard className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCreditCards.length}</div>
            <p className="text-xs text-neutral-500 mt-1">credit cards</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Recent Notes
            </CardTitle>
            <FileText className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestNotes.length}</div>
            <p className="text-xs text-neutral-500 mt-1">latest notes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tasks Today</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              {todoToday.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No tasks due today
                </p>
              ) : (
                <div className="space-y-2">
                  {todoToday.map((todo) => (
                    <div
                      key={todo.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${
                          todo.priority === "URGENT"
                            ? "bg-red-500"
                            : todo.priority === "HIGH"
                              ? "bg-orange-500"
                              : todo.priority === "MEDIUM"
                                ? "bg-blue-500"
                                : "bg-neutral-300"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {todo.title}
                        </p>
                      </div>
                      <Badge
                        variant={
                          todo.status === "TODO"
                            ? "outline"
                            : todo.status === "IN_PROGRESS"
                              ? "info"
                              : "success"
                        }
                      >
                        {todo.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overdue Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              {overdueTodos.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No overdue tasks
                </p>
              ) : (
                <div className="space-y-2">
                  {overdueTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-900 p-3"
                    >
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {todo.title}
                        </p>
                        {todo.dueAt && (
                          <p className="text-xs text-red-500">
                            Due: {todo.dueAt.toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Active Bills &amp; Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              {upcomingBills.length === 0 ? (
                <p className="text-sm text-neutral-500">No active items</p>
              ) : (
                <div className="space-y-2">
                  {upcomingBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{bill.name}</p>
                        <p className="text-xs text-neutral-500">
                          {bill.billingCycle} - {bill.type === "SUBSCRIPTION" ? "Subscription" : "Bill"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {parseFloat(bill.amount).toLocaleString()} {bill.currency}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              {latestNotes.length === 0 ? (
                <p className="text-sm text-neutral-500">No notes yet</p>
              ) : (
                <div className="space-y-2">
                  {latestNotes.map((note) => (
                    <Link
                      key={note.id}
                      href={`/notes`}
                      className="block rounded-lg border p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate flex-1">
                          {note.title}
                        </p>
                        {note.isPinned && (
                          <Badge variant="secondary">Pinned</Badge>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        {note.noteType} -{" "}
                        {note.createdAt.toLocaleDateString()}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function asc(column: any) {
  return sql`${column} ASC`;
}
