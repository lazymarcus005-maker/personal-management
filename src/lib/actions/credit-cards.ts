"use server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  creditCards,
  creditCardStatements,
  creditCardTransactions,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const creditCardSchema = z.object({
  name: z.string().min(1).max(100),
  bankName: z.string().min(1).max(100),
  lastFourDigits: z.string().length(4),
  creditLimit: z.string().optional(),
  statementDay: z.number().min(1).max(31),
  paymentDueDay: z.number().min(1).max(31),
  color: z.string().optional(),
  notes: z.string().optional(),
});

export async function getCreditCards() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();

  return db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.userId, session.user.id), eq(creditCards.status, "ACTIVE")))
    .orderBy(desc(creditCards.createdAt));
}

export async function createCreditCard(data: z.infer<typeof creditCardSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();

  const parsed = creditCardSchema.parse(data);
  const [card] = await db
    .insert(creditCards)
    .values({
      userId: session.user.id,
      name: parsed.name,
      bankName: parsed.bankName,
      lastFourDigits: parsed.lastFourDigits,
      creditLimit: parsed.creditLimit || null,
      statementDay: parsed.statementDay,
      paymentDueDay: parsed.paymentDueDay,
      color: parsed.color,
      notes: parsed.notes,
    })
    .returning();

  revalidatePath("/credit-cards");
  return card;
}

export async function updateCreditCard(
  id: string,
  data: Partial<z.infer<typeof creditCardSchema>>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();

  const [card] = await db
    .update(creditCards)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(creditCards.id, id), eq(creditCards.userId, session.user.id)))
    .returning();

  revalidatePath("/credit-cards");
  return card;
}

export async function deleteCreditCard(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();

  await db
    .delete(creditCards)
    .where(and(eq(creditCards.id, id), eq(creditCards.userId, session.user.id)));

  revalidatePath("/credit-cards");
}

export async function getStatements(creditCardId?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();

  const conditions = [eq(creditCards.userId, session.user.id)];
  if (creditCardId) {
    conditions.push(eq(creditCardStatements.creditCardId, creditCardId));
  }

  return db
    .select({
      statement: creditCardStatements,
      card: creditCards,
    })
    .from(creditCardStatements)
    .innerJoin(creditCards, eq(creditCardStatements.creditCardId, creditCards.id))
    .where(and(...conditions))
    .orderBy(desc(creditCardStatements.statementDate));
}

export async function createStatement(data: {
  creditCardId: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  statementDate: string;
  dueDate: string;
  totalAmount: string;
  minimumPayment: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();

  const [statement] = await db
    .insert(creditCardStatements)
    .values({
      creditCardId: data.creditCardId,
      statementPeriodStart: new Date(data.statementPeriodStart),
      statementPeriodEnd: new Date(data.statementPeriodEnd),
      statementDate: new Date(data.statementDate),
      dueDate: new Date(data.dueDate),
      totalAmount: data.totalAmount,
      minimumPayment: data.minimumPayment,
    })
    .returning();

  revalidatePath("/credit-cards");
  return statement;
}

export async function getTransactions(statementId?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();

  return db
    .select({
      transaction: creditCardTransactions,
    })
    .from(creditCardTransactions)
    .where(
      statementId
        ? eq(creditCardTransactions.statementId, statementId)
        : undefined
    )
    .orderBy(desc(creditCardTransactions.transactionDate));
}
