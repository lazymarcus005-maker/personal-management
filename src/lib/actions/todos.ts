"use server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { todos, todoChecklistItems } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const todoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueAt: z.string().optional(),
});

export async function getTodos() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();
  return db
    .select()
    .from(todos)
    .where(and(eq(todos.userId, session.user.id), eq(todos.status, "TODO")))
    .orderBy(desc(todos.createdAt));
}

export async function getTodoById(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();
  const [todo] = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)));
  return todo;
}

export async function createTodo(data: z.infer<typeof todoSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = todoSchema.parse(data);
  const db = await getDb();
  const [todo] = await db
    .insert(todos)
    .values({
      userId: session.user.id,
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      priority: parsed.priority,
      dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
    })
    .returning();

  revalidatePath("/todos");
  revalidatePath("/");
  return todo;
}

export async function updateTodo(
  id: string,
  data: Partial<z.infer<typeof todoSchema>>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const updateData: Record<string, any> = { ...data, updatedAt: new Date() };
  if (typeof updateData.dueAt === "string") updateData.dueAt = new Date(updateData.dueAt);

  const db = await getDb();
  const [todo] = await db
    .update(todos)
    .set(updateData as any)
    .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)))
    .returning();

  revalidatePath("/todos");
  revalidatePath("/");
  return todo;
}

export async function toggleTodoStatus(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();
  const [existing] = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)));

  if (!existing) throw new Error("Not found");

  const newStatus = existing.status === "DONE" ? "TODO" : "DONE";
  const [todo] = await db
    .update(todos)
    .set({
      status: newStatus,
      completedAt: newStatus === "DONE" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)))
    .returning();

  revalidatePath("/todos");
  revalidatePath("/");
  return todo;
}

export async function deleteTodo(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();
  await db
    .delete(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)));

  revalidatePath("/todos");
  revalidatePath("/");
}

export async function getChecklistItems(todoId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();
  return db
    .select()
    .from(todoChecklistItems)
    .where(eq(todoChecklistItems.todoId, todoId))
    .orderBy(todoChecklistItems.sortOrder);
}

export async function addChecklistItem(todoId: string, content: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();
  const [item] = await db
    .insert(todoChecklistItems)
    .values({ todoId, content })
    .returning();

  revalidatePath("/todos");
  return item;
}

export async function toggleChecklistItem(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();
  const [existing] = await db
    .select()
    .from(todoChecklistItems)
    .where(eq(todoChecklistItems.id, id));

  if (!existing) throw new Error("Not found");

  const [item] = await db
    .update(todoChecklistItems)
    .set({ isCompleted: !existing.isCompleted })
    .where(eq(todoChecklistItems.id, id))
    .returning();

  revalidatePath("/todos");
  return item;
}

export async function deleteChecklistItem(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const db = await getDb();
  await db
    .delete(todoChecklistItems)
    .where(eq(todoChecklistItems.id, id));

  revalidatePath("/todos");
}
