import { auth } from "@/auth";
import { db } from "@/db";
import { todos } from "@/db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { TodoList } from "@/components/todos/todo-list";
import { TodoForm } from "@/components/todos/todo-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sun,
  CalendarDays,
  CheckCheck,
  ListTodo,
  type LucideIcon,
} from "lucide-react";

function TodoMetricCard({
  title,
  value,
  icon: Icon,
  bgColor,
}: {
  title: string;
  value: number;
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
    </div>
  );
}

export default async function TodosPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
        .where(and(eq(todos.userId, userId), eq(todos.status, "DONE")))
        .orderBy(desc(todos.completedAt))
        .limit(20),
    ]);

  const pendingCount = allTodos.filter(
    (t) => t.status !== "DONE" && t.status !== "CANCELLED"
  ).length;

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#13141A]">Todos</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{dateStr}</p>
          </div>
          <TodoForm />
        </div>

        {/* Summary Card */}
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
              {todayTodos.length}{" "}
              <span className="text-lg font-normal opacity-70">tasks</span>
            </p>
            <p className="text-sm mt-1 opacity-70">
              {pendingCount} pending in total
            </p>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full border-2 border-[#13141A]/10" />
          <div className="absolute -right-4 -top-4 w-36 h-36 rounded-full border-2 border-[#13141A]/8" />
          <div className="absolute right-4 -bottom-4 w-24 h-24 rounded-full border-2 border-[#13141A]/6" />
        </div>

        {/* Metric Cards Grid */}
        <div className="mobile-carousel grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
          <TodoMetricCard
            title="Today"
            value={todayTodos.length}
            icon={Sun}
            bgColor="#FBD4E6"
          />
          <TodoMetricCard
            title="Upcoming"
            value={upcomingTodos.length}
            icon={CalendarDays}
            bgColor="#E5DBFE"
          />
          <TodoMetricCard
            title="Completed"
            value={completedTodos.length}
            icon={CheckCheck}
            bgColor="#ACCDFF"
          />
          <TodoMetricCard
            title="All Tasks"
            value={allTodos.length}
            icon={ListTodo}
            bgColor="#D0E77F"
          />
        </div>

        {/* Task Lists */}
        <Tabs defaultValue="all" dir="ltr" className="w-full">
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto bg-white rounded-full p-1 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger
              value="all"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#6B7280] data-[state=active]:bg-[#13141A] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              All ({allTodos.length})
            </TabsTrigger>
            <TabsTrigger
              value="today"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#6B7280] data-[state=active]:bg-[#13141A] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Today ({todayTodos.length})
            </TabsTrigger>
            <TabsTrigger
              value="upcoming"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#6B7280] data-[state=active]:bg-[#13141A] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Upcoming ({upcomingTodos.length})
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#9CA3AF] data-[state=active]:bg-[#6B7280] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Completed ({completedTodos.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-4">
            <TodoList todos={todayTodos} emptyMessage="No tasks due today" />
          </TabsContent>
          <TabsContent value="upcoming" className="mt-4">
            <TodoList todos={upcomingTodos} emptyMessage="No upcoming tasks" />
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
    </div>
  );
}
