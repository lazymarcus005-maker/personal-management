import { auth } from "@/auth";
import { db } from "@/db";
import { todos, todoChecklistItems } from "@/db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { TodoList } from "@/components/todos/todo-list";
import { TodoForm } from "@/components/todos/todo-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function TodosPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [allTodos, todayTodos, upcomingTodos, completedTodos] =
    await Promise.all([
      db
        .select()
        .from(todos)
        .where(and(eq(todos.userId, userId), isNull(todos.archivedAt)))
        .orderBy(desc(todos.priority), desc(todos.createdAt)),
      db
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.userId, userId),
            eq(todos.status, "TODO"),
            sql`${todos.dueAt} IS NOT NULL AND ${todos.dueAt} <= ${today}`
          )
        )
        .orderBy(desc(todos.priority)),
      db
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.userId, userId),
            sql`${todos.dueAt} IS NULL OR ${todos.dueAt} > ${today}`,
            sql`${todos.status} != 'DONE' AND ${todos.status} != 'CANCELLED'`
          )
        )
        .orderBy(desc(todos.priority)),
      db
        .select()
        .from(todos)
        .where(
          and(eq(todos.userId, userId), eq(todos.status, "DONE"))
        )
        .orderBy(desc(todos.completedAt))
        .limit(20),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Todos</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Manage your tasks
          </p>
        </div>
        <TodoForm />
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList>
          <TabsTrigger value="today">
            Today ({todayTodos.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingTodos.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({allTodos.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedTodos.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4">
          <TodoList todos={todayTodos} emptyMessage="No tasks due today" />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4">
          <TodoList
            todos={upcomingTodos}
            emptyMessage="No upcoming tasks"
          />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <TodoList todos={allTodos} emptyMessage="No tasks yet" />
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <TodoList
            todos={completedTodos}
            emptyMessage="No completed tasks"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
