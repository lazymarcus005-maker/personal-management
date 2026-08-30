"use server";

import { requireUserId } from "@/lib/guards";
import { getDb } from "@/db";
import {
  captureItems,
  todos,
  notes,
  journalEntries,
  financialTransactions,
  financialAccounts,
  areas,
  projects,
} from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { classifyCapture } from "@/lib/capture/classify";
import type {
  CaptureSuggestion,
  CaptureSuggestionType,
} from "@/lib/capture/classify";

/**
 * Types the capture flow (classifier + composer) produces. These are capture
 * vocabulary, not registry entity names — EXPENSE/INCOME become transactions
 * and IDEA becomes an idea note only at persistence time.
 */
const CAPTURE_TYPES: readonly CaptureSuggestionType[] = [
  "TODO",
  "EXPENSE",
  "INCOME",
  "JOURNAL_ENTRY",
  "IDEA",
  "NOTE",
];

function isCaptureType(value: string): value is CaptureSuggestionType {
  return (CAPTURE_TYPES as readonly string[]).includes(value);
}

/**
 * Classifies raw text without persisting anything so the user can review and
 * override the suggestion before saving (manual classification before save).
 *
 * `timezone` is the browser's IANA zone so date-relative suggestions like
 * "tomorrow" are computed on the user's calendar, not the server's.
 */
export async function classifyCaptureText(
  rawText: string,
  timezone?: string
): Promise<CaptureSuggestion> {
  await requireUserId();
  const trimmed = z.string().min(1).max(2000).parse(rawText);
  const now = clientNow(timezone);
  return classifyCapture(trimmed, now);
}

/** Shifts "now" into the client's timezone for local calendar math. */
function clientNow(timezone?: string): Date {
  if (!timezone) return new Date();
  try {
    return new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
  } catch {
    return new Date();
  }
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

  if (!isCaptureType(parsed.type)) {
    throw new Error(`Unsupported capture type: ${parsed.type}`);
  }

  // Duplicate guard: if the same raw text is still sitting unprocessed in
  // the inbox, this save converts that existing row instead of creating a
  // second capture record (or silently refusing to create the entity).
  const [pendingInboxItem] = await db
    .select({ id: captureItems.id })
    .from(captureItems)
    .where(
      and(
        eq(captureItems.userId, userId),
        eq(captureItems.rawText, parsed.rawText),
        eq(captureItems.status, "NEW")
      )
    );

  if (parsed.areaId) {
    const [area] = await db
      .select({ id: areas.id })
      .from(areas)
      .where(and(eq(areas.id, parsed.areaId), eq(areas.userId, userId)));
    if (!area) throw new Error("Area not found");
  }
  if (parsed.projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, parsed.projectId), eq(projects.userId, userId)));
    if (!project) throw new Error("Project not found");
  }
  // Keep the account currency: the balance adjustment must happen in the
  // same currency the balance is denominated in, or net worth corrupts.
  let accountCurrency: string | null = null;
  if (parsed.accountId) {
    const [account] = await db
      .select({ id: financialAccounts.id, currency: financialAccounts.currency })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.id, parsed.accountId),
          eq(financialAccounts.userId, userId)
        )
      );
    if (!account) throw new Error("Account not found");
    accountCurrency = account.currency ?? null;
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
      const txnType = parsed.type === "INCOME" ? "INCOME" : "EXPENSE";
      // The amount is applied to the account balance, so record it in the
      // account's currency — a classifier-detected foreign currency would
      // otherwise add an unconverted amount to the balance.
      const currency = accountCurrency ?? parsed.currency ?? "THB";
      const [txn] = await tx
        .insert(financialTransactions)
        .values({
          userId,
          accountId: parsed.accountId,
          type: txnType,
          amount: parsed.amount.toFixed(2),
          currency,
          transactionDate: new Date(),
          description: parsed.title,
          areaId: parsed.areaId ?? null,
          projectId: parsed.projectId ?? null,
        })
        .returning();
      // Keep the account balance in sync, same as createTransaction.
      await tx
        .update(financialAccounts)
        .set({
          currentBalance: sql`${financialAccounts.currentBalance} + ${txnType === "INCOME" ? parsed.amount.toFixed(2) : `-${parsed.amount.toFixed(2)}`}`,
          updatedAt: new Date(),
        })
        .where(eq(financialAccounts.id, parsed.accountId));
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

    let captureId: string;
    if (pendingInboxItem) {
      // Convert the deferred inbox row: it becomes the record for this entity.
      const [updated] = await tx
        .update(captureItems)
        .set({
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
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(captureItems.id, pendingInboxItem.id),
            eq(captureItems.userId, userId)
          )
        )
        .returning();
      captureId = updated.id;
    } else {
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
      captureId = capture.id;
    }

    return { captureId, entityId, duplicate: false };
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
