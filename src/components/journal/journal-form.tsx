"use client";

import { useState, useTransition } from "react";
import { createJournalEntry } from "@/lib/actions/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

const MOODS = ["GREAT", "GOOD", "OKAY", "LOW", "STRESSED"];

function todayLocalISO() {
  // Format the local date directly — an ISO round-trip would shift the
  // calendar day for users east of UTC (e.g. Thailand).
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function JournalForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    entryDate: todayLocalISO(),
    title: "",
    content: "",
    mood: "OKAY",
    energyLevel: "3",
    wins: "",
    concerns: "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createJournalEntry({
          entryDate: form.entryDate,
          title: form.title || undefined,
          content: form.content || undefined,
          mood: form.mood,
          energyLevel: Number(form.energyLevel),
          wins: form.wins || undefined,
          concerns: form.concerns || undefined,
        });
        setForm((f) => ({
          entryDate: todayLocalISO(),
          title: "",
          content: "",
          mood: "OKAY",
          energyLevel: "3",
          wins: "",
          concerns: "",
        }));
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save entry");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" aria-label="New journal entry" className="rounded-full">
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Daily reflection</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="journal-date">Date</Label>
              <Input
                id="journal-date"
                type="date"
                value={form.entryDate}
                onChange={(e) => set("entryDate")(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Mood</Label>
              <Select value={form.mood} onValueChange={set("mood")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Energy level (1–5)</Label>
            <Select value={form.energyLevel} onValueChange={set("energyLevel")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="journal-title">Title</Label>
            <Input id="journal-title" value={form.title} onChange={(e) => set("title")(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="journal-content">What happened today?</Label>
            <Textarea
              id="journal-content"
              className="min-h-[120px]"
              value={form.content}
              onChange={(e) => set("content")(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="journal-wins">Wins</Label>
              <Textarea id="journal-wins" value={form.wins} onChange={(e) => set("wins")(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="journal-concerns">Concerns</Label>
              <Textarea
                id="journal-concerns"
                value={form.concerns}
                onChange={(e) => set("concerns")(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
