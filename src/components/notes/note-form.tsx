"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createNote } from "@/lib/actions/notes";
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

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().optional(),
  noteType: z.enum(["GENERAL", "FINANCE", "IDEA", "REFERENCE", "MEETING"]),
});

type FormData = z.infer<typeof formSchema>;

export function NoteForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      noteType: "GENERAL",
    },
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      await createNote(data);
      reset();
      setOpen(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          New Note
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Create Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="noteType">Type</Label>
            <Select
              defaultValue="GENERAL"
              onValueChange={(v) =>
                setValue(
                  "noteType",
                  v as "GENERAL" | "FINANCE" | "IDEA" | "REFERENCE" | "MEETING"
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERAL">General</SelectItem>
                <SelectItem value="FINANCE">Finance</SelectItem>
                <SelectItem value="IDEA">Idea</SelectItem>
                <SelectItem value="REFERENCE">Reference</SelectItem>
                <SelectItem value="MEETING">Meeting</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Content (Markdown)</Label>
            <Textarea
              id="content"
              className="min-h-[200px] font-mono text-sm"
              {...register("content")}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
