"use client";

import type { InferSelectModel } from "drizzle-orm";
import type { notes as notesTable } from "@/db/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pin,
  Star,
  Archive,
  Trash2,
  PinOff,
  StarOff,
} from "lucide-react";
import { useTransition } from "react";
import {
  togglePin,
  toggleFavorite,
  archiveNote,
  deleteNote,
} from "@/lib/actions/notes";
import { format } from "date-fns";

type Note = InferSelectModel<typeof notesTable>;

const noteTypeColors: Record<string, string> = {
  GENERAL: "secondary",
  FINANCE: "success",
  IDEA: "info",
  REFERENCE: "warning",
  MEETING: "destructive",
};

export function NoteCard({ note }: { note: Note }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{note.title}</CardTitle>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => startTransition(() => void togglePin(note.id))}
              disabled={isPending}
            >
              {note.isPinned ? (
                <PinOff className="h-3 w-3" />
              ) : (
                <Pin className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => startTransition(() => void toggleFavorite(note.id))}
              disabled={isPending}
            >
              {note.isFavorite ? (
                <StarOff className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              ) : (
                <Star className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={noteTypeColors[note.noteType] as any}
            className="text-[10px] px-1.5 py-0"
          >
            {note.noteType}
          </Badge>
          <span className="text-xs text-neutral-400">
            {format(note.createdAt, "MMM d")}
          </span>
        </div>
      </CardHeader>
      {note.content && (
        <CardContent className="pb-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3">
            {note.content}
          </p>
        </CardContent>
      )}
      <div className="flex items-center gap-1 px-4 pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-neutral-400"
          onClick={() => startTransition(() => void archiveNote(note.id))}
          disabled={isPending}
        >
          <Archive className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-neutral-400 hover:text-red-500"
          onClick={() => startTransition(() => void deleteNote(note.id))}
          disabled={isPending}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
