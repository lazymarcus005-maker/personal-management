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

  const [allNotes, pinnedNotes, archivedNotes] = await Promise.all([
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
    db
      .select()
      .from(notes)
      .where(
        and(eq(notes.userId, userId), isNull(notes.archivedAt), eq(notes.isPinned, false))
      )
      .orderBy(desc(notes.createdAt)),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Write and manage your notes
          </p>
        </div>
        <NoteForm />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({allNotes.length})</TabsTrigger>
          <TabsTrigger value="pinned">Pinned ({pinnedNotes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          {allNotes.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              No notes yet. Create your first note!
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="pinned" className="mt-4">
          {pinnedNotes.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              No pinned notes
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pinnedNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
