"use server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  tags,
  entityTags,
  todos,
  todoChecklistItems,
  financialItems,
  financialOccurrences,
  paymentMethods,
  creditCards,
  creditCardStatements,
  creditCardTransactions,
  notes,
  reminders,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const EXPORT_VERSION = 1;

const exportDataSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  data: z.object({
    tags: z.array(z.any()),
    entityTags: z.array(z.any()),
    todos: z.array(z.any()),
    todoChecklistItems: z.array(z.any()),
    financialItems: z.array(z.any()),
    financialOccurrences: z.array(z.any()),
    paymentMethods: z.array(z.any()),
    creditCards: z.array(z.any()),
    creditCardStatements: z.array(z.any()),
    creditCardTransactions: z.array(z.any()),
    notes: z.array(z.any()),
    reminders: z.array(z.any()),
  }),
});

export async function exportData() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();
  const userId = session.user.id;

  const allTags = await db
    .select()
    .from(tags)
    .where(eq(tags.userId, userId));

  const tagIds = allTags.map((t) => t.id);
  const allEntityTags = tagIds.length > 0
    ? await db
        .select()
        .from(entityTags)
        .where(inArray(entityTags.tagId, tagIds))
    : [];

  const allTodos = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, userId));

  const todoIds = allTodos.map((t) => t.id);
  const allChecklistItems = todoIds.length > 0
    ? await db
        .select()
        .from(todoChecklistItems)
        .where(inArray(todoChecklistItems.todoId, todoIds))
    : [];

  const allPaymentMethods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, userId));

  const allFinancialItems = await db
    .select()
    .from(financialItems)
    .where(eq(financialItems.userId, userId));

  const financialItemIds = allFinancialItems.map((f) => f.id);
  const allOccurrences = financialItemIds.length > 0
    ? await db
        .select()
        .from(financialOccurrences)
        .where(inArray(financialOccurrences.financialItemId, financialItemIds))
    : [];

  const allCreditCards = await db
    .select()
    .from(creditCards)
    .where(eq(creditCards.userId, userId));

  const creditCardIds = allCreditCards.map((c) => c.id);
  const allStatements = creditCardIds.length > 0
    ? await db
        .select()
        .from(creditCardStatements)
        .where(inArray(creditCardStatements.creditCardId, creditCardIds))
    : [];

  const statementIds = allStatements.map((s) => s.id);
  const allTransactions = creditCardIds.length > 0
    ? await db
        .select()
        .from(creditCardTransactions)
        .where(inArray(creditCardTransactions.creditCardId, creditCardIds))
    : [];

  const allNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId));

  const allReminders = await db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, userId));

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      tags: allTags,
      entityTags: allEntityTags,
      todos: allTodos,
      todoChecklistItems: allChecklistItems,
      financialItems: allFinancialItems,
      financialOccurrences: allOccurrences,
      paymentMethods: allPaymentMethods,
      creditCards: allCreditCards,
      creditCardStatements: allStatements,
      creditCardTransactions: allTransactions,
      notes: allNotes,
      reminders: allReminders,
    },
  };
}

export type ImportPreviewCategory = {
  count: number;
  samples: Record<string, string | number | boolean | null>[];
};

export type ImportPreview = {
  version: number;
  exportedAt: string;
  categories: Record<string, ImportPreviewCategory>;
  totalRecords: number;
};

const SAMPLE_FIELDS: Record<string, string[]> = {
  tags: ["id", "name", "color"],
  entityTags: ["id", "tagId", "entityType", "entityId"],
  paymentMethods: ["id", "name", "type"],
  todos: ["id", "title", "status", "priority"],
  todoChecklistItems: ["id", "text", "completed", "todoId"],
  financialItems: ["id", "name", "amount", "category"],
  financialOccurrences: ["id", "amount", "periodStart", "periodEnd", "paidAt"],
  creditCards: ["id", "name", "bankName", "last4Digits"],
  creditCardStatements: ["id", "creditCardId", "statementDate", "totalAmount"],
  creditCardTransactions: ["id", "description", "amount", "transactionDate"],
  notes: ["id", "title", "type"],
  reminders: ["id", "title", "remindAt", "entityType"],
};

function pickSample(
  record: Record<string, unknown>,
  fields: string[],
): Record<string, string | number | boolean | null> {
  const sample: Record<string, string | number | boolean | null> = {};
  for (const f of fields) {
    const val = record[f];
    if (val instanceof Date) {
      sample[f] = val.toISOString();
    } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean" || val === null) {
      sample[f] = val;
    } else if (val !== undefined) {
      sample[f] = String(val);
    }
  }
  return sample;
}

export async function previewImportData(jsonString: string): Promise<ImportPreview> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("Invalid JSON format");
  }

  const validated = exportDataSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("Invalid export file format");
  }

  const { version, exportedAt, data } = validated.data;
  const categories: Record<string, ImportPreviewCategory> = {};
  let totalRecords = 0;

  for (const [key, items] of Object.entries(data)) {
    const fields = SAMPLE_FIELDS[key] ?? Object.keys(items[0] ?? {});
    const count = items.length;
    totalRecords += count;
    categories[key] = {
      count,
      samples: (items as Record<string, unknown>[]).slice(0, 5).map((r) => pickSample(r, fields)),
    };
  }

  return { version, exportedAt, categories, totalRecords };
}

export async function importData(jsonString: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();
  const userId = session.user.id;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("Invalid JSON format");
  }

  const validated = exportDataSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("Invalid export file format");
  }

  const { data } = validated.data;
  const imported: Record<string, number> = {};

  for (const tag of data.tags) {
    const { id, userId: _uid, ...rest } = tag;
    try {
      await db.insert(tags).values({ ...rest, userId, id });
      imported.tags = (imported.tags ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const et of data.entityTags) {
    const { id, ...rest } = et;
    try {
      await db.insert(entityTags).values({ ...rest, id });
      imported.entityTags = (imported.entityTags ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const pm of data.paymentMethods) {
    const { id, userId: _uid, createdAt, updatedAt, ...rest } = pm;
    try {
      await db.insert(paymentMethods).values({ ...rest, userId, id, createdAt: new Date(createdAt), updatedAt: new Date(updatedAt) });
      imported.paymentMethods = (imported.paymentMethods ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const todo of data.todos) {
    const { id, userId: _uid, createdAt, updatedAt, dueAt, completedAt, archivedAt, ...rest } = todo;
    try {
      await db.insert(todos).values({
        ...rest,
        userId,
        id,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
        dueAt: dueAt ? new Date(dueAt) : null,
        completedAt: completedAt ? new Date(completedAt) : null,
        archivedAt: archivedAt ? new Date(archivedAt) : null,
      });
      imported.todos = (imported.todos ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const item of data.todoChecklistItems) {
    const { id, createdAt, ...rest } = item;
    try {
      await db.insert(todoChecklistItems).values({ ...rest, id, createdAt: new Date(createdAt) });
      imported.todoChecklistItems = (imported.todoChecklistItems ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const fi of data.financialItems) {
    const { id, userId: _uid, createdAt, updatedAt, startDate, endDate, ...rest } = fi;
    try {
      await db.insert(financialItems).values({
        ...rest,
        userId,
        id,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      });
      imported.financialItems = (imported.financialItems ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const occ of data.financialOccurrences) {
    const { id, createdAt, periodStart, periodEnd, dueDate, paidAt, ...rest } = occ;
    try {
      await db.insert(financialOccurrences).values({
        ...rest,
        id,
        createdAt: new Date(createdAt),
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        dueDate: new Date(dueDate),
        paidAt: paidAt ? new Date(paidAt) : null,
      });
      imported.financialOccurrences = (imported.financialOccurrences ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const cc of data.creditCards) {
    const { id, userId: _uid, createdAt, updatedAt, ...rest } = cc;
    try {
      await db.insert(creditCards).values({
        ...rest,
        userId,
        id,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
      });
      imported.creditCards = (imported.creditCards ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const stmt of data.creditCardStatements) {
    const { id, createdAt, statementPeriodStart, statementPeriodEnd, statementDate, dueDate, paidAt, ...rest } = stmt;
    try {
      await db.insert(creditCardStatements).values({
        ...rest,
        id,
        createdAt: new Date(createdAt),
        statementPeriodStart: new Date(statementPeriodStart),
        statementPeriodEnd: new Date(statementPeriodEnd),
        statementDate: new Date(statementDate),
        dueDate: new Date(dueDate),
        paidAt: paidAt ? new Date(paidAt) : null,
      });
      imported.creditCardStatements = (imported.creditCardStatements ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const txn of data.creditCardTransactions) {
    const { id, createdAt, transactionDate, ...rest } = txn;
    try {
      await db.insert(creditCardTransactions).values({
        ...rest,
        id,
        createdAt: new Date(createdAt),
        transactionDate: new Date(transactionDate),
      });
      imported.creditCardTransactions = (imported.creditCardTransactions ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const note of data.notes) {
    const { id, userId: _uid, createdAt, updatedAt, archivedAt, ...rest } = note;
    try {
      await db.insert(notes).values({
        ...rest,
        userId,
        id,
        createdAt: new Date(createdAt),
        updatedAt: new Date(updatedAt),
        archivedAt: archivedAt ? new Date(archivedAt) : null,
      });
      imported.notes = (imported.notes ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  for (const reminder of data.reminders) {
    const { id, userId: _uid, createdAt, remindAt, ...rest } = reminder;
    try {
      await db.insert(reminders).values({
        ...rest,
        userId,
        id,
        createdAt: new Date(createdAt),
        remindAt: new Date(remindAt),
      });
      imported.reminders = (imported.reminders ?? 0) + 1;
    } catch {
      // skip duplicates
    }
  }

  return imported;
}
