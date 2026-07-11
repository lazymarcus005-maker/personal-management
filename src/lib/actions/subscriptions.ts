"use server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { financialItems, financialOccurrences } from "@/db/schema";
import { eq, and, desc, sql, lte, gte } from "drizzle-orm";

export async function getSubscriptions() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  return db
    .select()
    .from(financialItems)
    .where(
      and(
        eq(financialItems.userId, session.user.id),
        eq(financialItems.type, "SUBSCRIPTION"),
        eq(financialItems.status, "ACTIVE")
      )
    )
    .orderBy(desc(financialItems.createdAt));
}

export async function getSubscriptionStats() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const subscriptions = await db
    .select()
    .from(financialItems)
    .where(
      and(
        eq(financialItems.userId, session.user.id),
        eq(financialItems.type, "SUBSCRIPTION"),
        eq(financialItems.status, "ACTIVE")
      )
    );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const monthOccurrences = await db
    .select()
    .from(financialOccurrences)
    .where(
      and(
        lte(financialOccurrences.dueDate, monthEnd),
        gte(financialOccurrences.dueDate, monthStart)
      )
    );

  const totalMonthly = subscriptions.reduce(
    (sum, s) => sum + parseFloat(s.amount),
    0
  );

  const paidThisMonth = monthOccurrences.filter(
    (o) => o.status === "PAID"
  ).length;

  return {
    total: subscriptions.length,
    totalMonthly,
    paidThisMonth,
    upcomingPayments: monthOccurrences.filter(
      (o) => o.status === "UPCOMING" || o.status === "DUE"
    ).length,
    subscriptions,
  };
}

export async function getSubscriptionOccurrences() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const now = new Date();
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const twoMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  return db
    .select({
      occurrence: financialOccurrences,
      subscription: financialItems,
    })
    .from(financialOccurrences)
    .innerJoin(
      financialItems,
      eq(financialOccurrences.financialItemId, financialItems.id)
    )
    .where(
      and(
        eq(financialItems.userId, session.user.id),
        eq(financialItems.type, "SUBSCRIPTION"),
        gte(financialOccurrences.dueDate, twoMonthsAgo),
        lte(financialOccurrences.dueDate, twoMonthsAhead)
      )
    )
    .orderBy(desc(financialOccurrences.dueDate));
}

export async function getUpcomingSubscriptionPayments() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return db
    .select({
      occurrence: financialOccurrences,
      subscription: financialItems,
    })
    .from(financialOccurrences)
    .innerJoin(
      financialItems,
      eq(financialOccurrences.financialItemId, financialItems.id)
    )
    .where(
      and(
        eq(financialItems.userId, session.user.id),
        eq(financialItems.type, "SUBSCRIPTION"),
        eq(financialItems.status, "ACTIVE"),
        lte(financialOccurrences.dueDate, thirtyDays),
        gte(financialOccurrences.dueDate, now)
      )
    )
    .orderBy(financialOccurrences.dueDate);
}
