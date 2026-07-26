"use server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  financialItems,
  financialOccurrences,
  paymentMethods,
} from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const financialItemSchema = z.object({
  type: z.enum(["RECURRING_BILL", "SUBSCRIPTION"]),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  amount: z.string(),
  currency: z.string(),
  billingCycle: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]),
  billingDay: z.number().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  paymentMethodId: z.string().optional(),
  autoRenew: z.boolean(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

export async function getFinancialItems(type?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const conditions = [eq(financialItems.userId, session.user.id)];
  if (type) conditions.push(eq(financialItems.type, type as any));

  return db
    .select()
    .from(financialItems)
    .where(and(...conditions))
    .orderBy(desc(financialItems.createdAt));
}

export async function createFinancialItem(
  data: z.infer<typeof financialItemSchema>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const parsed = financialItemSchema.parse(data);
  const [item] = await db
    .insert(financialItems)
    .values({
      userId: session.user.id,
      type: parsed.type,
      name: parsed.name,
      description: parsed.description,
      amount: parsed.amount,
      currency: parsed.currency,
      billingCycle: parsed.billingCycle,
      billingDay: parsed.billingDay,
      startDate: new Date(parsed.startDate),
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      paymentMethodId: parsed.paymentMethodId || null,
      autoRenew: parsed.autoRenew,
      logoUrl: parsed.logoUrl || null,
    })
    .returning();

  revalidatePath("/finance");
  revalidatePath("/subscriptions");
  revalidatePath("/");
  return item;
}

export async function updateFinancialItem(
  id: string,
  data: Partial<z.infer<typeof financialItemSchema>>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const updateData: Record<string, any> = { ...data, updatedAt: new Date() };
  if (typeof updateData.startDate === "string") updateData.startDate = new Date(updateData.startDate);
  if (typeof updateData.endDate === "string") updateData.endDate = new Date(updateData.endDate);

  const [item] = await db
    .update(financialItems)
    .set(updateData as any)
    .where(and(eq(financialItems.id, id), eq(financialItems.userId, session.user.id)))
    .returning();

  revalidatePath("/finance");
  revalidatePath("/subscriptions");
  revalidatePath("/");
  return item;
}

export async function deleteFinancialItem(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  await db
    .delete(financialItems)
    .where(and(eq(financialItems.id, id), eq(financialItems.userId, session.user.id)));

  revalidatePath("/finance");
  revalidatePath("/subscriptions");
  revalidatePath("/");
}

export async function getOccurrences(financialItemId?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  // Verify ownership through the parent financial item so occurrences can't be
  // read for another user's items via a crafted financialItemId.
  const conditions = [eq(financialItems.userId, session.user.id)];
  if (financialItemId) {
    conditions.push(eq(financialOccurrences.financialItemId, financialItemId));
  }

  return db
    .select({
      occurrence: financialOccurrences,
      item: financialItems,
    })
    .from(financialOccurrences)
    .innerJoin(
      financialItems,
      eq(financialOccurrences.financialItemId, financialItems.id)
    )
    .where(and(...conditions))
    .orderBy(desc(financialOccurrences.dueDate));
}

export async function createOccurrence(data: {
  financialItemId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  expectedAmount: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  // Only allow creating occurrences under a financial item the user owns.
  const [parent] = await db
    .select({ id: financialItems.id })
    .from(financialItems)
    .where(
      and(
        eq(financialItems.id, data.financialItemId),
        eq(financialItems.userId, session.user.id)
      )
    );

  if (!parent) throw new Error("Not found");

  const [occurrence] = await db
    .insert(financialOccurrences)
    .values({
      financialItemId: data.financialItemId,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      dueDate: new Date(data.dueDate),
      expectedAmount: data.expectedAmount,
    })
    .returning();

  revalidatePath("/finance");
  return occurrence;
}

export async function markOccurrencePaid(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  // Verify the occurrence's parent item belongs to the user before updating.
  const [owned] = await db
    .select({ id: financialOccurrences.id })
    .from(financialOccurrences)
    .innerJoin(
      financialItems,
      eq(financialOccurrences.financialItemId, financialItems.id)
    )
    .where(
      and(
        eq(financialOccurrences.id, id),
        eq(financialItems.userId, session.user.id)
      )
    );

  if (!owned) throw new Error("Not found");

  const [occurrence] = await db
    .update(financialOccurrences)
    .set({ status: "PAID", paidAt: new Date() })
    .where(eq(financialOccurrences.id, id))
    .returning();

  revalidatePath("/finance");
  revalidatePath("/");
  return occurrence;
}

export async function getPaymentMethods() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  return db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, session.user.id))
    .orderBy(desc(paymentMethods.createdAt));
}

export async function createPaymentMethod(data: {
  name: string;
  type: string;
  details?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const [method] = await db
    .insert(paymentMethods)
    .values({
      userId: session.user.id,
      name: data.name,
      type: data.type,
      details: data.details,
    })
    .returning();

  revalidatePath("/finance");
  return method;
}
