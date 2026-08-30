"use server";

import { requireUserId } from "@/lib/guards";
import { getDb } from "@/db";
import {
  captureItems,
  todos,
  notes,
  journalEntries,
  financialTransactions,
  areas,
} from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { classifyCapture } from "@/lib/capture/classify";
import type { CaptureSuggestion } from "@/lib/capture/classify";
import { isEntityType } from "@/lib/entity-registry";

/**
 * Classifies raw text without persisting anything so the user can review and
 * override the suggestion before saving (manual classification before save).
 */
export async function classifyCaptureText(
  rawText: string
): Promise<CaptureSuggestion> {
  await requireUserId();
  const trimmed = z.string().min(1).max(2000).parse(rawText);
  return classifyCapture(trimmed);
}

const saveCaptureSchema = z.object({
  rawText: z.string().min(1).max(2000),
  type: z.string(),
  title: z.string().min(1).max(300),
  amount: z.number().positive().optional().nullable(),
  currency: z.string().max(10).optional(),
  dueDate: z.string().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  areaId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
});

export async function saveCapture(data: z.infer<typeof saveCaptureSchema>) {
  const userId = await requireUserId();
  const db = await getDb();
  const parsed = saveCaptureSchema.parse(data);

  if (!isEntityType(parsed.type)) {
    throw new Error(`Unsupported capture type: ${parsed.type}`);
  }

  // Duplicate guard: the same raw text must not create two records while the
  // previous capture is still unprocessed in the inbox.
  const [duplicate] = await db
    .select({ id: captureItems.id })
    .from(captureItems)
    .where(
      and(
        eq(captureItems.userId, userId),
        eq(captureItems.rawText, parsed.rawText),
        eq(captureItems.status, "NEW")
      )
    );
  if (duplicate) return { captureId: duplicate.id, entityId: null, duplicate: true };

  if (parsed.areaId) {
    const [area] = await db
      .select({ id: areas.id })
      .from(areas)
      .where(and(eq(areas.id, parsed.areaId), eq(areas.userId, userId)));
    if (!area) throw new Error("Area not found");
  }

  // Parent entity and inbox record are created atomically.
  const result = await db.transaction(async (tx) => {
    let entityType: string = parsed.type;
    let entityId: string | null = null;

    if (parsed.type === "TODO") {
      const [todo] = await tx
        .insert(todos)
        .values({
          userId,
          title: parsed.title,
          status: "TODO",
          priority: "MEDIUM",
          dueAt: parsed.dueDate ? new Date(parsed.dueDate) : null,
          areaId: parsed.areaId ?? null,
          projectId: parsed.projectId ?? null,
        })
        .returning();
      entityId = todo.id;
    } else if (parsed.type === "EXPENSE" || parsed.type === "INCOME" || parsed.type === "TRANSACTION") {
      if (!parsed.accountId || !parsed.amount) {
        throw new Error("Account and amount are required for transactions");
      }
      entityType = "TRANSACTION";
      const [txn] = await tx
        .insert(financialTransactions)
        .values({
          userId,
          accountId: parsed.accountId,
          type: parsed.type === "INCOME" ? "INCOME" : "EXPENSE",
          amount: parsed.amount.toFixed(2),
          currency: parsed.currency ?? "THB",
          transactionDate: new Date(),
          description: parsed.title,
          areaId: parsed.areaId ?? null,
          projectId: parsed.projectId ?? null,
        })
        .returning();
      entityId = txn.id;
    } else if (parsed.type === "JOURNAL_ENTRY") {
      const [entry] = await tx
        .insert(journalEntries)
        .values({
          userId,
          entryDate: new Date(),
          content: parsed.rawText,
          title: parsed.title.slice(0, 300),
        })
        .returning();
      entityId = entry.id;
    } else {
      // NOTE and IDEA both become notes; IDEA carries the note type.
      const [note] = await tx
        .insert(notes)
        .values({
          userId,
          title: parsed.title,
          content: parsed.rawText,
          noteType: parsed.type === "IDEA" ? "IDEA" : "GENERAL",
          areaId: parsed.areaId ?? null,
          projectId: parsed.projectId ?? null,
        })
        .returning();
      entityId = note.id;
      entityType = "NOTE";
    }

    const [capture] = await tx
      .insert(captureItems)
      .values({
        userId,
        rawText: parsed.rawText,
        suggestedType: parsed.type,
        payload: {
          title: parsed.title,
          amount: parsed.amount ?? null,
          currency: parsed.currency ?? "THB",
          dueDate: parsed.dueDate ?? null,
        },
        status: "CONVERTED",
        convertedEntityType: entityType,
        convertedEntityId: entityId,
      })
      .returning();

    return { captureId: capture.id, entityId, duplicate: false };
  });

  revalidatePath("/capture");
  revalidatePath("/todos");
  revalidatePath("/notes");
  revalidatePath("/journal");
  revalidatePath("/finance");
  revalidatePath("/");
  return result;
}

export async function getCaptureItems() {
  const userId = await requireUserId();
  const db = await getDb();

  return db
    .select()
    .from(captureItems)
    .where(eq(captureItems.userId, userId))
    .orderBy(desc(captureItems.createdAt))
    .limit(50);
}

export async function getInboxItems() {
  const userId = await requireUserId();
  const db = await getDb();

  return db
    .select()
    .from(captureItems)
    .where(and(eq(captureItems.userId, userId), eq(captureItems.status, "NEW")))
    .orderBy(desc(captureItems.createdAt));
}

/** Saves a raw text straight to the inbox without converting to an entity. */
export async function saveToInbox(rawText: string) {
  const userId = await requireUserId();
  const db = await getDb();
  const trimmed = z.string().min(1).max(2000).parse(rawText);

  const [existing] = await db
    .select({ id: captureItems.id })
    .from(captureItems)
    .where(
      and(
        eq(captureItems.userId, userId),
        eq(captureItems.rawText, trimmed),
        eq(captureItems.status, "NEW")
      )
    );
  if (existing) return existing;

  const suggestion = classifyCapture(trimmed);
  const [capture] = await db
    .insert(captureItems)
    .values({
      userId,
      rawText: trimmed,
      suggestedType: suggestion.type,
      payload: {
        title: suggestion.title,
        amount: suggestion.amount,
        currency: suggestion.currency,
        dueDate: suggestion.dueDate,
        suggestedTags: suggestion.suggestedTags,
        areaHint: suggestion.areaHint,
      },
      status: "NEW",
    })
    .returning();

  revalidatePath("/capture");
  revalidatePath("/");
  return capture;
}

export async function dismissCaptureItem(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  const [item] = await db
    .update(captureItems)
    .set({ status: "DISMISSED", updatedAt: new Date() })
    .where(
      and(
        eq(captureItems.id, id),
        eq(captureItems.userId, userId),
        eq(captureItems.status, "NEW")
      )
    )
    .returning();

  revalidatePath("/capture");
  return item;
}

export async function deleteCaptureItem(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  await db
    .delete(captureItems)
    .where(and(eq(captureItems.id, id), eq(captureItems.userId, userId)));

  revalidatePath("/capture");
}

/** Unconverted inbox count for dashboard/badge display. */
export async function getInboxCount() {
  const userId = await requireUserId();
  const db = await getDb();

  const rows = await db
    .select({ id: captureItems.id })
    .from(captureItems)
    .where(
      and(eq(captureItems.userId, userId), eq(captureItems.status, "NEW"))
    );
  return rows.length;
}
