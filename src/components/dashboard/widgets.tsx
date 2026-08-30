import { getDb } from "@/db";
import {
  todos,
  financialItems,
  notes,
  projects,
  goals,
  journalEntries,
  captureItems,
  financialTransactions,
  stravaConnections,
  appleHealthConnections,
  stravaActivities,
  appleHealthWorkouts,
} from "@/db/schema";
import { and, eq, isNull, lte, gte, desc, asc, sql, count } from "drizzle-orm";
import Link from "next/link";
import { BillLogo } from "@/components/finance/bill-logo";
import { GoalProgressBar } from "@/components/projects/goal-form";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ListTodo,
  Receipt,
  Repeat,
  FolderKanban,
  Target,
  NotebookPen,
  FileText,
  Zap,
  HeartPulse,
} from "lucide-react";

export interface WidgetShellProps {
  title: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
}

/** Shared card chrome so every widget looks consistent. */
export function WidgetShell({
  title,
  href,
  icon: Icon,
  children,
  isEmpty,
  emptyMessage = "Nothing here yet.",
}: WidgetShellProps) {
  return (
    <section className="rounded-[20px] bg-white p-4 shadow-sm h-fit">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#13141A]">
          {Icon && <Icon className="h-4 w-4 text-[#7A847E]" />}
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="text-xs text-[#69736D] hover:text-[#18201C] flex items-center gap-0.5"
          >
            View <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {isEmpty ? (
        <p className="text-xs text-[#AEB6AE] py-4 text-center">{emptyMessage}</p>
      ) : (
        children
      )}
    </section>
  );
}

const priorityDot: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-neutral-300",
};

export async function TasksDueTodayWidget({ userId }: { userId: string }) {
  const db = await getDb();
  const today = new Date();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const rows = await db
    .select()
    .from(todos)
    .where(
      and(
        eq(todos.userId, userId),
        eq(todos.status, "TODO"),
        isNull(todos.archivedAt),
        sql`${todos.dueAt} IS NOT NULL AND ${todos.dueAt} < ${endOfDay.toISOString()}`
      )
    )
    .orderBy(asc(todos.dueAt))
    .limit(8);

  return (
    <WidgetShell
      title="Tasks due today"
      href="/todos"
      icon={ListTodo}
      isEmpty={rows.length === 0}
      emptyMessage="No tasks due today 🎉"
    >
      <ul className="space-y-2">
        {rows.map((todo) => (
          <li key={todo.id} className="flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[todo.priority] ?? priorityDot.LOW}`}
            />
            <span className="flex-1 min-w-0 truncate text-[#13141A]">
              {todo.title}
            </span>
            {todo.dueAt && (
              <span className="text-[10px] text-[#7A847E] shrink-0">
                {todo.dueAt.toLocaleDateString()}
              </span>
            )}
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export async function OverdueTasksWidget({ userId }: { userId: string }) {
  const db = await getDb();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const rows = await db
    .select()
    .from(todos)
    .where(
      and(
        eq(todos.userId, userId),
        eq(todos.status, "TODO"),
        sql`${todos.dueAt} IS NOT NULL AND ${todos.dueAt} < ${startOfDay.toISOString()}`
      )
    )
    .orderBy(asc(todos.dueAt))
    .limit(8);

  return (
    <WidgetShell
      title="Overdue tasks"
      href="/todos"
      icon={AlertCircle}
      isEmpty={rows.length === 0}
      emptyMessage="Nothing overdue."
    >
      <ul className="space-y-2">
        {rows.map((todo) => (
          <li key={todo.id} className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="flex-1 min-w-0 truncate text-[#13141A]">
              {todo.title}
            </span>
            {todo.dueAt && (
              <span className="text-[10px] text-red-500 shrink-0">
                {todo.dueAt.toLocaleDateString()}
              </span>
            )}
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export async function UpcomingBillsWidget({ userId }: { userId: string }) {
  const db = await getDb();

  const rows = await db
    .select()
    .from(financialItems)
    .where(
      and(eq(financialItems.userId, userId), eq(financialItems.status, "ACTIVE"))
    )
    .orderBy(asc(financialItems.billingDay))
    .limit(8);

  return (
    <WidgetShell
      title="Upcoming bills & subscriptions"
      href="/finance"
      icon={Repeat}
      isEmpty={rows.length === 0}
      emptyMessage="No active recurring items."
    >
      <ul className="space-y-2">
        {rows.map((bill) => (
          <li key={bill.id} className="flex items-center gap-2 text-sm">
            <BillLogo logoUrl={bill.logoUrl} size="sm" />
            <span className="flex-1 min-w-0 truncate text-[#13141A]">
              {bill.name}
            </span>
            <span className="font-semibold text-[#13141A] text-xs shrink-0">
              {parseFloat(bill.amount).toLocaleString()} {bill.currency}
            </span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export async function ActiveProjectsWidget({ userId }: { userId: string }) {
  const db = await getDb();

  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.status, "ACTIVE")))
    .orderBy(desc(projects.updatedAt))
    .limit(6);

  return (
    <WidgetShell
      title="Active projects"
      href="/projects"
      icon={FolderKanban}
      isEmpty={rows.length === 0}
      emptyMessage="No active projects."
    >
      <ul className="space-y-2">
        {rows.map((project) => (
          <li key={project.id} className="text-sm">
            <Link
              href={`/projects/${project.id}`}
              className="flex items-center justify-between gap-2 group"
            >
              <span className="truncate text-[#13141A] group-hover:underline">
                {project.name}
              </span>
              <span className="text-[10px] text-[#7A847E] shrink-0">
                {project.priority}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export async function GoalProgressWidget({ userId }: { userId: string }) {
  const db = await getDb();

  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, "ACTIVE")))
    .orderBy(desc(goals.updatedAt))
    .limit(4);

  return (
    <WidgetShell
      title="Goal progress"
      href="/projects?tab=goals"
      icon={Target}
      isEmpty={rows.length === 0}
      emptyMessage="No active goals."
    >
      <div className="space-y-3">
        {rows.map((goal) => (
          <div key={goal.id} className="space-y-1">
            <p className="text-sm text-[#13141A] truncate">{goal.title}</p>
            <GoalProgressBar
              targetValue={goal.targetValue}
              currentValue={goal.currentValue}
            />
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export async function JournalPromptWidget({ userId }: { userId: string }) {
  const db = await getDb();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [todayEntry] = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.userId, userId),
        gte(journalEntries.entryDate, startOfDay)
      )
    )
    .limit(1);

  const prompts = [
    "What was the best part of today?",
    "What drained your energy today?",
    "What is one thing you learned today?",
    "What are you grateful for right now?",
    "What would make tomorrow a win?",
  ];
  const prompt = prompts[today.getDate() % prompts.length];

  return (
    <WidgetShell title="Daily reflection" href="/journal" icon={NotebookPen}>
      <p className="text-sm text-[#3D4540] italic mb-3">“{prompt}”</p>
      <Link
        href="/journal"
        className="inline-flex items-center gap-1 rounded-full bg-[#D0E77F] px-3 py-1.5 text-xs font-semibold text-[#13141A] hover:bg-[#c4dd6f]"
      >
        {todayEntry ? "Add another entry" : "Write today's entry"}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </WidgetShell>
  );
}

export async function RecentNotesWidget({ userId }: { userId: string }) {
  const db = await getDb();

  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), isNull(notes.archivedAt)))
    .orderBy(desc(notes.createdAt))
    .limit(5);

  return (
    <WidgetShell
      title="Recent notes"
      href="/notes"
      icon={FileText}
      isEmpty={rows.length === 0}
      emptyMessage="No notes yet."
    >
      <ul className="space-y-2">
        {rows.map((note) => (
          <li key={note.id} className="text-sm">
            <p className="truncate text-[#13141A] font-medium">{note.title}</p>
            <p className="text-[10px] text-[#7A847E]">
              {note.noteType} · {note.createdAt.toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export async function RecentExpensesWidget({ userId }: { userId: string }) {
  const db = await getDb();

  const rows = await db
    .select()
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.userId, userId),
        eq(financialTransactions.type, "EXPENSE"),
        isNull(financialTransactions.deletedAt)
      )
    )
    .orderBy(desc(financialTransactions.transactionDate))
    .limit(5);

  return (
    <WidgetShell
      title="Recent expenses"
      href="/finance"
      icon={Receipt}
      isEmpty={rows.length === 0}
      emptyMessage="No transactions recorded yet."
    >
      <ul className="space-y-2">
        {rows.map((txn) => (
          <li key={txn.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 min-w-0 truncate text-[#13141A]">
              {txn.description ?? txn.merchant ?? "Expense"}
            </span>
            <span className="font-semibold text-xs shrink-0">
              {parseFloat(txn.amount).toLocaleString()} {txn.currency}
            </span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export async function CaptureInboxWidget({ userId }: { userId: string }) {
  const db = await getDb();

  const rows = await db
    .select()
    .from(captureItems)
    .where(and(eq(captureItems.userId, userId), eq(captureItems.status, "NEW")))
    .orderBy(desc(captureItems.createdAt))
    .limit(5);

  return (
    <WidgetShell
      title="Capture inbox"
      href="/capture"
      icon={Zap}
      isEmpty={rows.length === 0}
      emptyMessage="Inbox zero!"
    >
      <ul className="space-y-2">
        {rows.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 min-w-0 truncate text-[#13141A]">
              {item.rawText}
            </span>
            <span className="text-[10px] text-[#7A847E] shrink-0">
              {item.suggestedType}
            </span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

/** Health summary — only rendered when an integration is connected. */
export async function HealthSummaryWidget({ userId }: { userId: string }) {
  const db = await getDb();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [stravaConn] = await db
    .select({ id: stravaConnections.id })
    .from(stravaConnections)
    .where(
      and(eq(stravaConnections.userId, userId), eq(stravaConnections.status, "CONNECTED"))
    )
    .limit(1);

  const [healthConn] = await db
    .select({ id: appleHealthConnections.id })
    .from(appleHealthConnections)
    .where(
      and(
        eq(appleHealthConnections.userId, userId),
        eq(appleHealthConnections.status, "CONNECTED")
      )
    )
    .limit(1);

  if (!stravaConn && !healthConn) return null;

  const [activityStats] = stravaConn
    ? await db
        .select({ total: count() })
        .from(stravaActivities)
        .where(
          and(
            eq(stravaActivities.connectionId, stravaConn.id),
            gte(stravaActivities.startDate, weekAgo)
          )
        )
    : [{ total: 0 }];

  const [workoutStats] = healthConn
    ? await db
        .select({
          total: count(),
          duration: sql<string>`coalesce(sum(${appleHealthWorkouts.duration}), '0')`,
        })
        .from(appleHealthWorkouts)
        .where(
          and(
            eq(appleHealthWorkouts.connectionId, healthConn.id),
            gte(appleHealthWorkouts.startDate, weekAgo)
          )
        )
    : [{ total: 0, duration: "0" }];

  return (
    <WidgetShell title="Health this week" href="/activities" icon={HeartPulse}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xl font-bold text-[#13141A]">{Number(activityStats.total)}</p>
          <p className="text-xs text-[#7A847E]">Strava activities</p>
        </div>
        <div>
          <p className="text-xl font-bold text-[#13141A]">
            {Math.round(parseFloat(workoutStats.duration))}
          </p>
          <p className="text-xs text-[#7A847E]">Health workout minutes</p>
        </div>
      </div>
    </WidgetShell>
  );
}

export async function UpcomingCalendarWidget({ userId }: { userId: string }) {
  // Calendar events are reminders tied to entities; surface pending ones.
  const db = await getDb();
  const { reminders } = await import("@/db/schema");

  const rows = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.status, "PENDING")))
    .orderBy(asc(reminders.remindAt))
    .limit(5);

  return (
    <WidgetShell
      title="Upcoming reminders"
      href="/calendar"
      icon={CalendarDays}
      isEmpty={rows.length === 0}
      emptyMessage="No pending reminders."
    >
      <ul className="space-y-2">
        {rows.map((reminder) => (
          <li key={reminder.id} className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-3.5 w-3.5 text-[#7A847E] shrink-0" />
            <span className="flex-1 min-w-0 truncate text-[#13141A]">
              {reminder.entityType} reminder
            </span>
            <span className="text-[10px] text-[#7A847E] shrink-0">
              {reminder.remindAt.toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
