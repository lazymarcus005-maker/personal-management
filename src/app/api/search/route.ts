import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  todos,
  notes,
  financialItems,
  projects,
  goals,
  journalEntries,
  financialTransactions,
  financialAccounts,
  areas,
  tags,
} from "@/db/schema";
import {
  eq,
  and,
  ilike,
  or,
  sql,
  isNull,
  type SQL,
} from "drizzle-orm";
import { NextRequest } from "next/server";
import { isEntityType } from "@/lib/entity-registry";

export interface UnifiedSearchResult {
  id: string;
  entity_type: string;
  title: string;
  snippet: string | null;
  area: string | null;
  project: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Unified search across every user-owned entity type. All queries are scoped
 * by the authenticated user id; area/project/type/date filters are pushed
 * into the database queries before any limit so filters can't hide matching
 * rows behind an arbitrary result window.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const q = params.get("q") || "";
  const typeFilter = params.get("type");
  const areaFilter = params.get("area");
  const projectFilter = params.get("project");
  const from = params.get("from");
  const to = params.get("to");

  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  const userId = session.user.id;
  const db = await getDb();
  const searchTerm = `%${q}%`;
  const limit = 5;

  const userScope = (table: { userId: unknown }) => eq(table.userId as never, userId);

  // Optional context predicates, pushed into each query before its limit.
  const areaPredicate = (areaName: typeof areas.name): SQL | undefined =>
    areaFilter ? eq(areaName, areaFilter) : undefined;
  const projectPredicate = (projectName: typeof projects.name): SQL | undefined =>
    projectFilter ? eq(projectName, projectFilter) : undefined;

  const createdRange = (qualifiedName: string): SQL[] => {
    const conditions: SQL[] = [];
    if (from) conditions.push(gteSql(qualifiedName, from));
    if (to) conditions.push(ltSqlNextDay(qualifiedName, to));
    return conditions;
  };

  // Small helpers because drizzle needs raw sql for string date params here.
  // Table and column are quoted separately so the identifier is valid SQL.
  function gteSql(qualifiedName: string, value: string): SQL {
    const [table, column] = qualifiedName.split(".");
    return sql`${sql.raw(`"${table}"."${column}"`)} >= ${new Date(value)}`;
  }
  // The `to` date picker sends midnight of the selected day; use an
  // exclusive bound at the start of the next day so the whole day matches.
  function ltSqlNextDay(qualifiedName: string, value: string): SQL {
    const [table, column] = qualifiedName.split(".");
    const nextDay = new Date(value);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return sql`${sql.raw(`"${table}"."${column}"`)} < ${nextDay}`;
  }

  const wants = (t: string) => !typeFilter || typeFilter === t;

  const [
    todoResults,
    noteResults,
    projectResults,
    goalResults,
    journalResults,
    billResults,
    transactionResults,
    accountResults,
    areaResults,
    tagResults,
  ] = await Promise.all([
    wants("TODO")
      ? db
          .select({
            id: todos.id,
            title: todos.title,
            snippet: todos.description,
            createdAt: todos.createdAt,
            updatedAt: todos.updatedAt,
            areaName: areas.name,
            projectName: projects.name,
          })
          .from(todos)
          .leftJoin(areas, eq(todos.areaId, areas.id))
          .leftJoin(projects, eq(todos.projectId, projects.id))
          .where(
            and(
              userScope(todos),
              or(ilike(todos.title, searchTerm), ilike(todos.description, searchTerm)),
              ...createdRange("todos.created_at"),
              areaPredicate(areas.name),
              projectPredicate(projects.name)
            )
          )
          .limit(limit)
      : Promise.resolve([]),
    wants("NOTE")
      ? db
          .select({
            id: notes.id,
            title: notes.title,
            snippet: notes.content,
            createdAt: notes.createdAt,
            updatedAt: notes.updatedAt,
            areaName: areas.name,
            projectName: projects.name,
          })
          .from(notes)
          .leftJoin(areas, eq(notes.areaId, areas.id))
          .leftJoin(projects, eq(notes.projectId, projects.id))
          .where(
            and(
              userScope(notes),
              isNull(notes.archivedAt),
              or(ilike(notes.title, searchTerm), ilike(notes.content, searchTerm)),
              ...createdRange("notes.created_at"),
              areaPredicate(areas.name),
              projectPredicate(projects.name)
            )
          )
          .limit(limit)
      : Promise.resolve([]),
    wants("PROJECT")
      ? db
          .select({
            id: projects.id,
            title: projects.name,
            snippet: projects.description,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
            areaName: areas.name,
          })
          .from(projects)
          .leftJoin(areas, eq(projects.areaId, areas.id))
          .where(
            and(
              userScope(projects),
              or(ilike(projects.name, searchTerm), ilike(projects.description, searchTerm)),
              ...createdRange("projects.created_at"),
              areaPredicate(areas.name)
            )
          )
          .limit(limit)
      : Promise.resolve([]),
    wants("GOAL")
      ? db
          .select({
            id: goals.id,
            title: goals.title,
            snippet: goals.description,
            createdAt: goals.createdAt,
            updatedAt: goals.updatedAt,
            areaName: areas.name,
            projectName: projects.name,
          })
          .from(goals)
          .leftJoin(areas, eq(goals.areaId, areas.id))
          .leftJoin(projects, eq(goals.projectId, projects.id))
          .where(
            and(
              userScope(goals),
              or(ilike(goals.title, searchTerm), ilike(goals.description, searchTerm)),
              ...createdRange("goals.created_at"),
              areaPredicate(areas.name),
              projectPredicate(projects.name)
            )
          )
          .limit(limit)
      : Promise.resolve([]),
    wants("JOURNAL_ENTRY")
      ? db
          .select({
            id: journalEntries.id,
            title: journalEntries.title,
            snippet: journalEntries.content,
            createdAt: journalEntries.createdAt,
            updatedAt: journalEntries.updatedAt,
          })
          .from(journalEntries)
          .where(
            and(
              userScope(journalEntries),
              or(
                ilike(journalEntries.title, searchTerm),
                ilike(journalEntries.content, searchTerm)
              ),
              ...createdRange("journal_entries.created_at")
            )
          )
          .limit(limit)
      : Promise.resolve([]),
    wants("BILL") || wants("SUBSCRIPTION")
      ? db
          .select({
            id: financialItems.id,
            title: financialItems.name,
            snippet: financialItems.description,
            type: financialItems.type,
            createdAt: financialItems.createdAt,
            updatedAt: financialItems.updatedAt,
          })
          .from(financialItems)
          .where(
            and(
              userScope(financialItems),
              // Respect the requested subtype so a Bill search doesn't return
              // subscriptions and vice versa.
              typeFilter === "BILL" || typeFilter === "SUBSCRIPTION"
                ? eq(
                    financialItems.type,
                    typeFilter === "BILL" ? "RECURRING_BILL" : "SUBSCRIPTION"
                  )
                : undefined,
              or(
                ilike(financialItems.name, searchTerm),
                ilike(financialItems.description, searchTerm)
              ),
              ...createdRange("financial_items.created_at")
            )
          )
          .limit(limit)
      : Promise.resolve([]),
    wants("TRANSACTION")
      ? db
          .select({
            id: financialTransactions.id,
            snippet: financialTransactions.description,
            merchant: financialTransactions.merchant,
            createdAt: financialTransactions.createdAt,
            updatedAt: financialTransactions.updatedAt,
            areaName: areas.name,
            projectName: projects.name,
          })
          .from(financialTransactions)
          .leftJoin(areas, eq(financialTransactions.areaId, areas.id))
          .leftJoin(projects, eq(financialTransactions.projectId, projects.id))
          .where(
            and(
              userScope(financialTransactions),
              isNull(financialTransactions.deletedAt),
              or(
                ilike(financialTransactions.description, searchTerm),
                ilike(financialTransactions.merchant, searchTerm)
              ),
              ...createdRange("financial_transactions.created_at"),
              areaPredicate(areas.name),
              projectPredicate(projects.name)
            )
          )
          .limit(limit)
      : Promise.resolve([]),
    wants("ACCOUNT")
      ? db
          .select({
            id: financialAccounts.id,
            title: financialAccounts.name,
            type: financialAccounts.type,
            createdAt: financialAccounts.createdAt,
            updatedAt: financialAccounts.updatedAt,
          })
          .from(financialAccounts)
          .where(
            and(
              userScope(financialAccounts),
              or(
                ilike(financialAccounts.name, searchTerm),
                // `type` is a PostgreSQL enum — cast to text or ILIKE fails
                // with an operator-resolution error.
                sql`${financialAccounts.type}::text ILIKE ${searchTerm}`
              ),
              ...createdRange("financial_accounts.created_at")
            )
          )
          .limit(limit)
      : Promise.resolve([]),
    wants("AREA")
      ? db
          .select({
            id: areas.id,
            title: areas.name,
            snippet: areas.description,
            createdAt: areas.createdAt,
            updatedAt: areas.updatedAt,
          })
          .from(areas)
          .where(
            and(
              userScope(areas),
              ilike(areas.name, searchTerm),
              ...createdRange("areas.created_at")
            )
          )
          .limit(limit)
      : Promise.resolve([]),
    wants("TAG")
      ? db
          .select({
            id: tags.id,
            title: tags.name,
            createdAt: tags.createdAt,
          })
          .from(tags)
          .where(
            and(
              userScope(tags),
              ilike(tags.name, searchTerm)
            )
          )
          .limit(limit)
      : Promise.resolve([]),
  ]);

  const results: UnifiedSearchResult[] = [
    ...todoResults.map((r) => ({
      id: r.id,
      entity_type: "TODO",
      title: r.title,
      snippet: r.snippet,
      area: r.areaName,
      project: r.projectName,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
    ...noteResults.map((r) => ({
      id: r.id,
      entity_type: "NOTE",
      title: r.title,
      snippet: r.snippet,
      area: r.areaName,
      project: r.projectName,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
    ...projectResults.map((r) => ({
      id: r.id,
      entity_type: "PROJECT",
      title: r.title,
      snippet: r.snippet,
      area: r.areaName,
      project: null,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
    ...goalResults.map((r) => ({
      id: r.id,
      entity_type: "GOAL",
      title: r.title,
      snippet: r.snippet,
      area: r.areaName,
      project: r.projectName,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
    ...journalResults.map((r) => ({
      id: r.id,
      entity_type: "JOURNAL_ENTRY",
      title: r.title ?? "Journal entry",
      snippet: r.snippet,
      area: null,
      project: null,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
    ...billResults.map((r) => ({
      id: r.id,
      entity_type: r.type === "SUBSCRIPTION" ? "SUBSCRIPTION" : "BILL",
      title: r.title,
      snippet: r.snippet,
      area: null,
      project: null,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
    ...transactionResults.map((r) => ({
      id: r.id,
      entity_type: "TRANSACTION",
      title: r.merchant ?? "Transaction",
      snippet: r.snippet,
      area: r.areaName,
      project: r.projectName,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
    ...accountResults.map((r) => ({
      id: r.id,
      entity_type: "ACCOUNT",
      title: r.title,
      snippet: r.type.replace(/_/g, " "),
      area: null,
      project: null,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
    ...areaResults.map((r) => ({
      id: r.id,
      entity_type: "AREA",
      title: r.title,
      snippet: r.snippet,
      area: null,
      project: null,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    })),
    ...tagResults.map((r) => ({
      id: r.id,
      entity_type: "TAG",
      title: `#${r.title}`,
      snippet: null,
      area: null,
      project: null,
      created_at: r.createdAt.toISOString(),
      updated_at: r.createdAt.toISOString(),
    })),
  ].filter((r) => isEntityType(r.entity_type) || r.entity_type === "TAG");

  // Final context check. Queries that have the joins already push these
  // predicates before their limit; this catches the queries without
  // area/project context (journal, bills, accounts, areas, tags) and project
  // results, which must not appear when a context filter is active.
  const filtered = results.filter(
    (r) =>
      (!areaFilter || r.area === areaFilter) &&
      (!projectFilter || r.project === projectFilter)
  );

  return Response.json({ results: filtered });
}
