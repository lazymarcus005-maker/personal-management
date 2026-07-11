import { auth } from "@/auth";
import { db } from "@/db";
import { reminders, todos, financialItems } from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const pendingReminders = await db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.status, "PENDING"),
        lte(reminders.remindAt, next24h),
        eq(reminders.userId, session.user.id)
      )
    );

  return Response.json({
    reminders: pendingReminders.length,
    message: `Found ${pendingReminders.length} pending reminders`,
  });
}
