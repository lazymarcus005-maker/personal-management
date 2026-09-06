import { auth } from "@/auth";
import { getDb } from "@/db";
import { journalEntries } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { formatAppDate } from "@/lib/dates";
import { JournalForm } from "@/components/journal/journal-form";
import { Badge } from "@/components/ui/badge";
import { NotebookPen } from "lucide-react";

export const dynamic = "force-dynamic";

const moodColor: Record<string, string> = {
  GREAT: "bg-[#D0E77F] text-[#13141A]",
  GOOD: "bg-[#E4EED7] text-[#13141A]",
  OKAY: "bg-[#EEF0F5] text-[#6B7280]",
  LOW: "bg-[#ACCDFF] text-[#13141A]",
  STRESSED: "bg-[#FBD4E6] text-[#13141A]",
};

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;
  const db = await getDb();

  const entries = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
    .limit(100);

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">
              Life OS
            </p>
            <h1 className="text-2xl font-bold text-[#18201C]">Journal</h1>
            <p className="text-sm text-[#69736D] mt-0.5">
              A lightweight daily reflection — mood, energy, wins and concerns.
            </p>
          </div>
          <JournalForm />
        </div>

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#CDD3CD] bg-white/60 py-14 text-center text-[#69736D]">
            <NotebookPen className="h-8 w-8 mx-auto mb-2 text-[#AEB6AE]" />
            No journal entries yet. Capture today&apos;s reflection to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl bg-white p-4 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#13141A]">
                    {formatAppDate(entry.entryDate, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {entry.mood && (
                      <Badge
                        className={`${moodColor[entry.mood] ?? "bg-[#EEF0F5] text-[#6B7280]"} border-0`}
                      >
                        {entry.mood}
                      </Badge>
                    )}
                    {entry.energyLevel !== null && (
                      <Badge className="bg-[#E5DBFE] text-[#13141A] border-0">
                        ⚡ {entry.energyLevel}/5
                      </Badge>
                    )}
                  </div>
                </div>
                {entry.title && (
                  <p className="font-semibold text-[#13141A]">{entry.title}</p>
                )}
                {entry.content && (
                  <p className="text-sm text-[#3D4540] whitespace-pre-wrap">
                    {entry.content}
                  </p>
                )}
                {(entry.wins || entry.concerns) && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {entry.wins && (
                      <div className="rounded-xl bg-[#F4F8EC] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5B713B] mb-1">
                          Wins
                        </p>
                        <p className="text-xs text-[#3D4540] whitespace-pre-wrap">
                          {entry.wins}
                        </p>
                      </div>
                    )}
                    {entry.concerns && (
                      <div className="rounded-xl bg-[#FDF1F6] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#A34D6E] mb-1">
                          Concerns
                        </p>
                        <p className="text-xs text-[#3D4540] whitespace-pre-wrap">
                          {entry.concerns}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
