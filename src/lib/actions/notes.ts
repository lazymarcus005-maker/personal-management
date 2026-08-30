"use server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { notes, areas, projects } from "@/db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const noteSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().optional(),
  noteType: z.enum(["GENERAL", "FINANCE", "IDEA", "REFERENCE", "MEETING"]),
  areaId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
});

/** Related ids must be owned by the user before they can be referenced. */
async function assertContextOwned(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  areaId?: string | null,
  projectId?: string | null
) {
  if (areaId) {
    const [area] = await db
      .select({ id: areas.id })
      .from(areas)
      .where(and(eq(areas.id, areaId), eq(areas.userId, userId)));
    if (!area) throw new Error("Area not found");
  }
  if (projectId) {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!project) throw new Error("Project not found");
  }
}

export async function getNotes(includeArchived = false) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const conditions = [eq(notes.userId, session.user.id)];
  if (!includeArchived) conditions.push(isNull(notes.archivedAt));

  return db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(desc(notes.isPinned), desc(notes.createdAt));
}

export async function getNoteById(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)));
  return note;
}

export async function createNote(data: z.infer<typeof noteSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const parsed = noteSchema.parse(data);
  await assertContextOwned(db, session.user.id, parsed.areaId, parsed.projectId);
  const [note] = await db
    .insert(notes)
    .values({
      userId: session.user.id,
      title: parsed.title,
      content: parsed.content,
      noteType: parsed.noteType,
      areaId: parsed.areaId ?? null,
      projectId: parsed.projectId ?? null,
    })
    .returning();

  revalidatePath("/notes");
  revalidatePath("/");
  return note;
}

export async function updateNote(
  id: string,
  data: Partial<z.infer<typeof noteSchema> & { isPinned: boolean; isFavorite: boolean }>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();
  await assertContextOwned(
    db,
    session.user.id,
    data.areaId as string | null | undefined,
    data.projectId as string | null | undefined
  );

  const [note] = await db
    .update(notes)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))
    .returning();

  revalidatePath("/notes");
  revalidatePath("/");
  return note;
}

export async function togglePin(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)));

  if (!existing) throw new Error("Not found");

  const [note] = await db
    .update(notes)
    .set({ isPinned: !existing.isPinned, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))
    .returning();

  revalidatePath("/notes");
  return note;
}

export async function toggleFavorite(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const [existing] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)));

  if (!existing) throw new Error("Not found");

  const [note] = await db
    .update(notes)
    .set({ isFavorite: !existing.isFavorite, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))
    .returning();

  revalidatePath("/notes");
  return note;
}

export async function archiveNote(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const [note] = await db
    .update(notes)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))
    .returning();

  revalidatePath("/notes");
  revalidatePath("/");
  return note;
}

export async function unarchiveNote(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  const [note] = await db
    .update(notes)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))
    .returning();

  revalidatePath("/notes");
  return note;
}

export async function deleteNote(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const db = await getDb();

  await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)));

  revalidatePath("/notes");
  revalidatePath("/");
}
