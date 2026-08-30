import { auth } from "@/auth";
import { getDb } from "@/db";
import { areas, projects, financialAccounts, captureItems } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { formatAppDate } from "@/lib/dates";
import {
  CaptureComposer,
  DismissInboxItemButton,
} from "@/components/capture/capture-composer";
import { Badge } from "@/components/ui/badge";
import { Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const db = await getDb();
  const [areaRows, projectRows, accountRows, inboxRows, historyRows] =
    await Promise.all([
      db
        .select()
        .from(areas)
        .where(and(eq(areas.userId, userId), isNull(areas.archivedAt)))
        .orderBy(areas.name),
      db
        .select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(desc(projects.updatedAt))
        .limit(50),
      db
        .select()
        .from(financialAccounts)
        .where(
          and(
            eq(financialAccounts.userId, userId),
            isNull(financialAccounts.archivedAt)
          )
        )
        .orderBy(desc(financialAccounts.createdAt)),
      db
        .select()
        .from(captureItems)
        .where(
          and(eq(captureItems.userId, userId), eq(captureItems.status, "NEW"))
        )
        .orderBy(desc(captureItems.createdAt)),
      db
        .select()
        .from(captureItems)
        .where(
          and(
            eq(captureItems.userId, userId),
            eq(captureItems.status, "CONVERTED")
          )
        )
        .orderBy(desc(captureItems.createdAt))
        .limit(20),
    ]);

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">
            Life OS
          </p>
          <h1 className="text-2xl font-bold text-[#18201C]">Capture</h1>
          <p className="text-sm text-[#69736D] mt-0.5">
            One entry point for everything. Type naturally — we&apos;ll suggest
            what it is; you stay in control.
          </p>
        </div>

        <CaptureComposer
          areas={areaRows.map((a) => ({ id: a.id, name: a.name }))}
          projects={projectRows.map((p) => ({ id: p.id, name: p.name }))}
          accounts={accountRows.map((a) => ({
            id: a.id,
            name: a.name,
            currency: a.currency,
          }))}
        />

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[#13141A] flex items-center gap-2">
            <Inbox className="h-5 w-5" /> Inbox
            {inboxRows.length > 0 && (
              <Badge className="bg-[#FBD4E6] text-[#13141A] border-0">
                {inboxRows.length} new
              </Badge>
            )}
          </h2>
          {inboxRows.length === 0 ? (
            <p className="text-sm text-[#69736D]">
              Inbox is empty. Items saved without classification land here.
            </p>
          ) : (
            <ul className="space-y-2">
              {inboxRows.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl bg-white p-3 flex items-center gap-3 text-sm"
                >
                  <Badge className="bg-[#E5DBFE] text-[#13141A] border-0 shrink-0">
                    {item.suggestedType}
                  </Badge>
                  <span className="flex-1 min-w-0 truncate text-[#13141A]">
                    {item.rawText}
                  </span>
                  <span className="text-xs text-[#7A847E] shrink-0">
                    {formatAppDate(item.createdAt)}
                  </span>
                  <DismissInboxItemButton id={item.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {historyRows.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#7A847E]">
              Recently captured
            </h2>
            <ul className="space-y-1.5">
              {historyRows.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl bg-white/60 px-3 py-2 flex items-center gap-3 text-sm"
                >
                  <span className="flex-1 min-w-0 truncate text-[#3D4540]">
                    {item.rawText}
                  </span>
                  <span className="text-xs text-[#7A847E] shrink-0">
                    → {item.convertedEntityType}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
