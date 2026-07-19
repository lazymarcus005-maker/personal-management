"use client";

import type { InferSelectModel } from "drizzle-orm";
import type { notes as notesTable } from "@/db/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
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

const noteTypeColors: Record<string, BadgeProps["variant"]> = {
  GENERAL: "secondary",
  FINANCE: "success",
  IDEA: "info",
  REFERENCE: "warning",
  MEETING: "destructive",
};

export function NoteCard({ note }: { note: Note }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="group min-h-[180px] transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{note.title}</CardTitle>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-[#69736D]"
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
              className="h-8 w-8 rounded-full text-[#69736D]"
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
            variant={noteTypeColors[note.noteType]}
            className="rounded-full px-2 py-0.5 text-[10px]"
          >
            {note.noteType}
          </Badge>
          <span className="text-xs text-[#98A09B]">
            {format(note.createdAt, "MMM d")}
          </span>
        </div>
      </CardHeader>
      {note.content && (
        <CardContent className="pb-3">
          <p className="line-clamp-3 text-sm leading-6 text-[#5E6962]">
            {note.content}
          </p>
        </CardContent>
      )}
      <div className="mt-auto flex items-center gap-1 px-4 pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-[#98A09B]"
          onClick={() => startTransition(() => void archiveNote(note.id))}
          disabled={isPending}
        >
          <Archive className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-[#98A09B] hover:text-red-500"
          onClick={() => startTransition(() => void deleteNote(note.id))}
          disabled={isPending}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
