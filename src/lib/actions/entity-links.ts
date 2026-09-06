"use server";

import { requireUserId } from "@/lib/guards";
import { getDb } from "@/db";
import {
  entityLinks,
  todos,
  notes,
  projects,
  goals,
  journalEntries,
  financialItems,
  financialTransactions,
} from "@/db/schema";
import { and, eq, or, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isEntityType, isRelationType } from "@/lib/entity-registry";

/**
 * Polymorphic link endpoints have no database FK, so every endpoint id is
 * verified against the mapped table AND scoped to the current user.
 */
const OWNERSHIP_TABLES = {
  TODO: todos,
  NOTE: notes,
  PROJECT: projects,
  GOAL: goals,
  JOURNAL_ENTRY: journalEntries,
  BILL: financialItems,
  SUBSCRIPTION: financialItems,
  TRANSACTION: financialTransactions,
} as const;

type LinkableType = keyof typeof OWNERSHIP_TABLES;

function isLinkableType(type: string): type is LinkableType {
  return type in OWNERSHIP_TABLES;
}

const linkSchema = z.object({
  sourceType: z.string(),
  sourceId: z.string().uuid(),
  targetType: z.string(),
  targetId: z.string().uuid(),
  relationType: z.string().default("RELATED_TO"),
});

async function assertEntityOwned(
  db: Awaited<ReturnType<typeof getDb>>,
  type: string,
  id: string,
  userId: string
) {
  if (!isEntityType(type) || !isLinkableType(type)) {
    throw new Error(`Unsupported entity type: ${type}`);
  }
  // financialItems covers both BILL and SUBSCRIPTION types.
  const table = OWNERSHIP_TABLES[type as LinkableType];
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId)));
  if (!row) throw new Error("Entity not found");
}

export async function createEntityLink(data: z.infer<typeof linkSchema>) {
  const userId = await requireUserId();
  const db = await getDb();
  const parsed = linkSchema.parse(data);

  if (!isRelationType(parsed.relationType)) {
    throw new Error(`Unsupported relation type: ${parsed.relationType}`);
  }
  if (parsed.sourceType === parsed.targetType && parsed.sourceId === parsed.targetId) {
    throw new Error("Cannot link an entity to itself");
  }

  await assertEntityOwned(db, parsed.sourceType, parsed.sourceId, userId);
  await assertEntityOwned(db, parsed.targetType, parsed.targetId, userId);

  // Idempotent: skip duplicate links instead of creating duplicates.
  const [existing] = await db
    .select({ id: entityLinks.id })
    .from(entityLinks)
    .where(
      and(
        eq(entityLinks.userId, userId),
        eq(entityLinks.sourceType, parsed.sourceType),
        eq(entityLinks.sourceId, parsed.sourceId),
        eq(entityLinks.targetType, parsed.targetType),
        eq(entityLinks.targetId, parsed.targetId),
        eq(entityLinks.relationType, parsed.relationType)
      )
    );
  if (existing) return { ...existing, duplicate: true };

  const [link] = await db
    .insert(entityLinks)
    .values({
      userId,
      sourceType: parsed.sourceType,
      sourceId: parsed.sourceId,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      relationType: parsed.relationType,
    })
    .returning();

  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.sourceId}`);
  revalidatePath(`/projects/${parsed.targetId}`);
  return link;
}

export async function deleteEntityLink(id: string) {
  const userId = await requireUserId();
  const db = await getDb();

  await db
    .delete(entityLinks)
    .where(and(eq(entityLinks.id, id), eq(entityLinks.userId, userId)));

  revalidatePath("/projects");
}

export async function getLinksFor(
  entityType: string,
  entityId: string
) {
  const userId = await requireUserId();
  const db = await getDb();

  if (!isEntityType(entityType)) throw new Error("Unsupported entity type");

  return db
    .select()
    .from(entityLinks)
    .where(
      and(
        eq(entityLinks.userId, userId),
        or(
          and(
            eq(entityLinks.sourceType, entityType),
            eq(entityLinks.sourceId, entityId)
          ),
          and(
            eq(entityLinks.targetType, entityType),
            eq(entityLinks.targetId, entityId)
          )
        )
      )
    )
    .orderBy(desc(entityLinks.createdAt));
}
