"use server";

import { requireUserId } from "@/lib/guards";
import { getDb } from "@/db";
import { captureItems } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { classifyCapture } from "@/lib/capture/classify";
import type {
  CaptureSuggestion,
  CaptureSuggestionType,
} from "@/lib/capture/classify";
import { saveCaptureCore, type SaveCaptureInput } from "@/lib/services/capture";

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

export async function saveCapture(data: SaveCaptureInput) {
  const userId = await requireUserId();
  const result = await saveCaptureCore(userId, data);

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
