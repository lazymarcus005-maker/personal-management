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
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { CaptureSuggestionType } from "@/lib/capture/classify";

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

export const saveCaptureSchema = z.object({
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

export type SaveCaptureInput = z.infer<typeof saveCaptureSchema>;

export interface SaveCaptureResult {
  captureId: string;
  entityId: string;
  duplicate: boolean;
}

/**
 * Creates the entity for a capture plus its (converted) inbox record,
 * atomically. Shared by the `saveCapture` server action and the MCP
 * `create_capture_item` tool; both must produce identical results.
 */
export async function saveCaptureCore(
  userId: string,
  data: SaveCaptureInput
): Promise<SaveCaptureResult> {
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

  // No exchange-rate conversion exists in this system, so a capture whose
  // detected currency differs from the account's must be rejected instead of
  // silently relabeling the numeric amount and corrupting the balance.
  const isTransactionType = parsed.type === "EXPENSE" || parsed.type === "INCOME";
  if (
    isTransactionType &&
    parsed.amount &&
    accountCurrency &&
    parsed.currency &&
    parsed.currency !== accountCurrency
  ) {
    throw new Error(
      `Amount is in ${parsed.currency} but account "${parsed.accountId}" is in ${accountCurrency}. ` +
        `Enter the amount in ${accountCurrency} or pick an account in ${parsed.currency}.`
    );
  }

  // Parent entity and inbox record are created atomically.
  return db.transaction(async (tx) => {
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
    } else if (parsed.type === "EXPENSE" || parsed.type === "INCOME") {
      if (!parsed.accountId || !parsed.amount) {
        throw new Error("Account and amount are required for transactions");
      }
      entityType = "TRANSACTION";
      const txnType = parsed.type === "INCOME" ? "INCOME" : "EXPENSE";
      // Currencies were verified to match above, so the amount applies to
      // the balance in its own denomination.
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
}
