import { auth } from "@/auth";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { NoteForm } from "@/components/notes/note-form";
import { NoteCard } from "@/components/notes/note-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function NotesPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const [allNotes, pinnedNotes] = await Promise.all([
    db
      .select()
      .from(notes)
      .where(
        and(eq(notes.userId, userId), isNull(notes.archivedAt))
      )
      .orderBy(desc(notes.isPinned), desc(notes.createdAt)),
    db
      .select()
      .from(notes)
      .where(
        and(eq(notes.userId, userId), eq(notes.isPinned, true), isNull(notes.archivedAt))
      )
      .orderBy(desc(notes.createdAt)),
  ]);

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">Library</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#18201C] sm:text-3xl">Notes</h1>
          <p className="mt-1 text-sm text-[#69736D]">
            Ideas and details, kept close.
          </p>
        </div>
        <NoteForm />
      </div>

      <Tabs defaultValue="all">
        <TabsList className="h-auto rounded-full bg-white p-1 shadow-sm">
          <TabsTrigger className="rounded-full px-4 data-[state=active]:bg-[#18201C] data-[state=active]:text-white" value="all">All ({allNotes.length})</TabsTrigger>
          <TabsTrigger className="rounded-full px-4 data-[state=active]:bg-[#18201C] data-[state=active]:text-white" value="pinned">Pinned ({pinnedNotes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          {allNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#CDD3CD] bg-white/60 py-14 text-center text-[#69736D]">
              No notes yet. Create your first note!
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {allNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="pinned" className="mt-4">
          {pinnedNotes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#CDD3CD] bg-white/60 py-14 text-center text-[#69736D]">
              No pinned notes
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pinnedNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
