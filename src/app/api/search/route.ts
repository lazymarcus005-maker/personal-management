import { auth } from "@/auth";
import { db } from "@/db";
import { todos, notes, financialItems } from "@/db/schema";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") || "";
  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  const userId = session.user.id;
  const searchTerm = `%${q}%`;

  const [todoResults, noteResults, financeResults] = await Promise.all([
    db
      .select({
        id: todos.id,
        title: todos.title,
        type: sql`'todo'`.as("type"),
      })
      .from(todos)
      .where(
        and(
          eq(todos.userId, userId),
          or(
            ilike(todos.title, searchTerm),
            ilike(todos.description ?? "", searchTerm)
          )
        )
      )
      .limit(5),
    db
      .select({
        id: notes.id,
        title: notes.title,
        type: sql`'note'`.as("type"),
      })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          or(
            ilike(notes.title, searchTerm),
            ilike(notes.content ?? "", searchTerm)
          )
        )
      )
      .limit(5),
    db
      .select({
        id: financialItems.id,
        title: financialItems.name,
        type: sql`'finance'`.as("type"),
      })
      .from(financialItems)
      .where(
        and(
          eq(financialItems.userId, userId),
          or(
            ilike(financialItems.name, searchTerm),
            ilike(financialItems.description ?? "", searchTerm)
          )
        )
      )
      .limit(5),
  ]);

  return Response.json({
    results: [...todoResults, ...noteResults, ...financeResults],
  });
}
