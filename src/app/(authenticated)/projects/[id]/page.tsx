import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  projects,
  areas,
  todos,
  notes,
  goals,
  financialTransactions,
  entityLinks,
} from "@/db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { EntityLinkPicker } from "@/components/projects/link-entity-form";
import type { LinkableEntity, ExistingLink } from "@/components/projects/link-entity-form";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatAppDate } from "@/lib/dates";
import {
  ListTodo,
  FileText,
  Target,
  Receipt,
  ArrowLeft,
} from "lucide-react";


export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const db = await getDb();

  // Ownership first: a crafted project id must 404, not leak another user's data.
  const [row] = await db
    .select({ project: projects, areaName: areas.name })
    .from(projects)
    .leftJoin(areas, eq(projects.areaId, areas.id))
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  if (!row) notFound();

  const [linkedTodos, linkedNotes, linkedGoals, linkedExpenses, links] =
    await Promise.all([
      db
        .select()
        .from(todos)
        .where(
          and(
            eq(todos.projectId, id),
            eq(todos.userId, userId),
            isNull(todos.archivedAt)
          )
        )
        .orderBy(desc(todos.createdAt)),
      db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.projectId, id),
            eq(notes.userId, userId),
            isNull(notes.archivedAt)
          )
        )
        .orderBy(desc(notes.createdAt)),
      db
        .select()
        .from(goals)
        .where(and(eq(goals.projectId, id), eq(goals.userId, userId)))
        .orderBy(desc(goals.createdAt)),
      db
        .select({
          id: financialTransactions.id,
          amount: financialTransactions.amount,
          currency: financialTransactions.currency,
          description: financialTransactions.description,
          merchant: financialTransactions.merchant,
          transactionDate: financialTransactions.transactionDate,
        })
        .from(financialTransactions)
        .where(
          and(
            eq(financialTransactions.projectId, id),
            eq(financialTransactions.userId, userId),
            isNull(financialTransactions.deletedAt),
            eq(financialTransactions.type, "EXPENSE")
          )
        )
        .orderBy(desc(financialTransactions.transactionDate))
        .limit(10),
      db
        .select()
        .from(entityLinks)
        .where(
          and(
            eq(entityLinks.userId, userId),
            sql`(${entityLinks.sourceId} = ${id} OR ${entityLinks.targetId} = ${id})`
          )
        )
        .orderBy(desc(entityLinks.createdAt)),
    ]);

  // Candidates for the link picker: everything the user owns, minus what is
  // already linked to this project.
  const linkedOtherIds = new Set(
    links.flatMap((l) => (l.sourceId === id ? [l.targetId] : [l.sourceId]))
  );
  const [candidateTodos, candidateNotes, candidateGoals, candidateTransactions] =
    await Promise.all([
      db
        .select({ id: todos.id, title: todos.title })
        .from(todos)
        .where(and(eq(todos.userId, userId), isNull(todos.archivedAt)))
        .orderBy(desc(todos.createdAt))
        .limit(50),
      db
        .select({ id: notes.id, title: notes.title })
        .from(notes)
        .where(and(eq(notes.userId, userId), isNull(notes.archivedAt)))
        .orderBy(desc(notes.createdAt))
        .limit(50),
      db
        .select({ id: goals.id, title: goals.title })
        .from(goals)
        .where(and(eq(goals.userId, userId)))
        .orderBy(desc(goals.createdAt))
        .limit(50),
      db
        .select({
          id: financialTransactions.id,
          description: financialTransactions.description,
          amount: financialTransactions.amount,
        })
        .from(financialTransactions)
        .where(
          and(
            eq(financialTransactions.userId, userId),
            isNull(financialTransactions.deletedAt)
          )
        )
        .orderBy(desc(financialTransactions.transactionDate))
        .limit(50),
    ]);

  const linkableEntities: LinkableEntity[] = [
    ...candidateTodos.map((t) => ({
      id: t.id,
      entityType: "TODO" as const,
      title: t.title,
    })),
    ...candidateNotes.map((n) => ({
      id: n.id,
      entityType: "NOTE" as const,
      title: n.title,
    })),
    ...candidateGoals.map((g) => ({
      id: g.id,
      entityType: "GOAL" as const,
      title: g.title,
    })),
    ...candidateTransactions.map((t) => ({
      id: t.id,
      entityType: "TRANSACTION" as const,
      title: `${t.description ?? "Transaction"} (${parseFloat(t.amount).toLocaleString()})`,
    })),
  ].filter((e) => !linkedOtherIds.has(e.id));

  const existingLinks: ExistingLink[] = links;
  const totalExpenses = linkedExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount),
    0
  );

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-[#69736D] hover:text-[#18201C]"
        >
          <ArrowLeft className="h-4 w-4" /> All projects
        </Link>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#D0E77F] text-[#13141A] border-0">
              {row.project.status}
            </Badge>
            {row.areaName && (
              <Badge className="bg-[#E5DBFE] text-[#13141A] border-0">
                {row.areaName}
              </Badge>
            )}
            <Badge className="bg-[#EEF0F5] text-[#6B7280] border-0">
              {row.project.priority}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-[#18201C]">{row.project.name}</h1>
          {row.project.description && (
            <p className="text-sm text-[#69736D] mt-1">{row.project.description}</p>
          )}
          <p className="text-xs text-[#7A847E] mt-2">
            {row.project.startDate
              ? `Started ${formatAppDate(row.project.startDate)}`
              : "No start date"}
            {row.project.targetDate
              ? ` · target ${formatAppDate(row.project.targetDate)}`
              : ""}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Tasks", value: linkedTodos.length, icon: ListTodo, bg: "#FBD4E6" },
            { label: "Notes", value: linkedNotes.length, icon: FileText, bg: "#D0E77F" },
            { label: "Goals", value: linkedGoals.length, icon: Target, bg: "#E5DBFE" },
            {
              label: "Expenses",
              value: totalExpenses.toLocaleString(),
              icon: Receipt,
              bg: "#ACCDFF",
            },
          ].map(({ label, value, icon: Icon, bg }) => (
            <div key={label} className="rounded-2xl p-4" style={{ backgroundColor: bg }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium opacity-70">{label}</p>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xl font-bold text-[#13141A]">{value}</p>
            </div>
          ))}
        </div>

        {/* Linked entities */}
        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#13141A]">Tasks</h2>
            {linkedTodos.length === 0 ? (
              <p className="text-sm text-[#69736D]">No tasks linked yet.</p>
            ) : (
              linkedTodos.map((todo) => (
                <div key={todo.id} className="rounded-xl bg-white p-3 text-sm">
                  <p className="font-medium text-[#13141A] truncate">{todo.title}</p>
                  <p className="text-xs text-[#6B7280]">
                    {todo.status} · {todo.priority}
                  </p>
                </div>
              ))
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#13141A]">Notes</h2>
            {linkedNotes.length === 0 ? (
              <p className="text-sm text-[#69736D]">No notes linked yet.</p>
            ) : (
              linkedNotes.map((note) => (
                <div key={note.id} className="rounded-xl bg-white p-3 text-sm">
                  <p className="font-medium text-[#13141A] truncate">{note.title}</p>
                  <p className="text-xs text-[#6B7280]">
                    {note.noteType} · {formatAppDate(note.createdAt)}
                  </p>
                </div>
              ))
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#13141A]">Goals</h2>
            {linkedGoals.length === 0 ? (
              <p className="text-sm text-[#69736D]">No goals linked yet.</p>
            ) : (
              linkedGoals.map((goal) => (
                <div key={goal.id} className="rounded-xl bg-white p-3 text-sm">
                  <p className="font-medium text-[#13141A] truncate">{goal.title}</p>
                  <p className="text-xs text-[#6B7280]">
                    {goal.status}
                    {goal.targetValue
                      ? ` · ${parseFloat(goal.currentValue ?? "0").toLocaleString()} / ${parseFloat(goal.targetValue).toLocaleString()} ${goal.unit ?? ""}`
                      : ""}
                  </p>
                </div>
              ))
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#13141A]">Recent expenses</h2>
            {linkedExpenses.length === 0 ? (
              <p className="text-sm text-[#69736D]">No expenses linked yet.</p>
            ) : (
              linkedExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="rounded-xl bg-white p-3 text-sm flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[#13141A] truncate">
                      {expense.description ?? expense.merchant ?? "Expense"}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {formatAppDate(expense.transactionDate)}
                    </p>
                  </div>
                  <p className="font-bold text-[#13141A] shrink-0">
                    {parseFloat(expense.amount).toLocaleString()}{" "}
                    <span className="text-xs font-normal text-[#6B7280]">
                      {expense.currency}
                    </span>
                  </p>
                </div>
              ))
            )}
          </section>
        </div>

        {/* Link picker */}
        <section className="rounded-2xl bg-white/70 p-4 space-y-3">
          <h2 className="text-lg font-bold text-[#13141A]">Link entities</h2>
          <p className="text-xs text-[#6B7280]">
            Connect any task, note, goal or transaction to this project.
          </p>
          <EntityLinkPicker
            projectId={id}
            linkableEntities={linkableEntities}
            existingLinks={existingLinks}
          />
        </section>
      </div>
    </div>
  );
}
