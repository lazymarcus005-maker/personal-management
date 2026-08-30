"use server";

import { requireUserId } from "@/lib/guards";
import { getDb } from "@/db";
import { journalEntries } from "@/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const journalSchema = z.object({
  entryDate: z.string(),
  title: z.string().max(300).optional(),
  content: z.string().optional(),
  mood: z.string().max(30).optional(),
  energyLevel: z.number().int().min(1).max(5).optional(),
  wins: z.string().optional(),
  concerns: z.string().optional(),
});

export async function getJournalEntries(from?: string, to?: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const conditions = [eq(journalEntries.userId, userId)];
  if (from) conditions.push(gte(journalEntries.entryDate, new Date(from)));
  if (to) conditions.push(lte(journalEntries.entryDate, new Date(to)));

  return db
    .select()
    .from(journalEntries)
    .where(and(...conditions))
    .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt));
}

export async function createJournalEntry(data: z.infer<typeof journalSchema>) {
  const userId = await requireUserId();
  const db = await getDb();
  const parsed = journalSchema.parse(data);

  const [entry] = await db
    .insert(journalEntries)
    .values({
      userId,
      entryDate: new Date(parsed.entryDate),
      title: parsed.title,
      content: parsed.content,
      mood: parsed.mood,
      energyLevel: parsed.energyLevel,
      wins: parsed.wins,
      concerns: parsed.concerns,
    })
    .returning();

  revalidatePath("/journal");
  revalidatePath("/");
  return entry;
}

export async function updateJournalEntry(
  id: string,
  data: Partial<z.infer<typeof journalSchema>>
) {
  const userId = await requireUserId();
  const db = await getDb();

  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (typeof updateData.entryDate === "string")
    updateData.entryDate = new Date(updateData.entryDate);

  const [entry] = await db
    .update(journalEntries)
    .set(updateData as any)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
    .returning();

  revalidatePath("/journal");
  return entry;
}

export async function deleteJournalEntry(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));

  revalidatePath("/journal");
  revalidatePath("/");
}
