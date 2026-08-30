"use client";

import { useState, useTransition } from "react";
import { createGoal, updateGoalProgress } from "@/lib/actions/goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

type AreaOption = { id: string; name: string };
type ProjectOption = { id: string; name: string };

export function GoalForm({
  areas,
  projects,
}: {
  areas: AreaOption[];
  projects: ProjectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    areaId: "",
    projectId: "",
    targetValue: "",
    currentValue: "0",
    unit: "",
    targetDate: "",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createGoal({
          title: form.title,
          description: form.description || undefined,
          areaId: form.areaId || null,
          projectId: form.projectId || null,
          status: "ACTIVE",
          targetValue: form.targetValue || null,
          currentValue: form.currentValue || "0",
          unit: form.unit || undefined,
          targetDate: form.targetDate || null,
        });
        setForm({
          title: "",
          description: "",
          areaId: "",
          projectId: "",
          targetValue: "",
          currentValue: "0",
          unit: "",
          targetDate: "",
        });
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create goal");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" aria-label="Create goal" className="rounded-full">
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>New goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Area</Label>
              <Select
                value={form.areaId || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, areaId: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No area</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select
                value={form.projectId || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, projectId: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target value</Label>
              <Input
                id="goal-target"
                type="number"
                step="0.01"
                min="0"
                value={form.targetValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetValue: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-current">Current</Label>
              <Input
                id="goal-current"
                type="number"
                step="0.01"
                min="0"
                value={form.currentValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currentValue: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-unit">Unit</Label>
              <Input
                id="goal-unit"
                placeholder="km, THB, books…"
                value={form.unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-date">Target date</Label>
            <Input
              id="goal-date"
              type="date"
              value={form.targetDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, targetDate: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-desc">Description</Label>
            <Textarea
              id="goal-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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

/** Inline current-value updater shown on each goal card. */
export function GoalProgressInput({
  goalId,
  currentValue,
  unit,
}: {
  goalId: string;
  currentValue: string | null;
  unit: string | null;
}) {
  const [value, setValue] = useState(currentValue ?? "0");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await updateGoalProgress(goalId, value || "0");
        });
      }}
    >
      <Input
        type="number"
        step="0.01"
        min="0"
        className="h-8 w-24"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Current value"
      />
      <span className="text-xs text-[#6B7280]">{unit ?? ""}</span>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Saving…" : "Update"}
      </Button>
    </form>
  );
}

/** Renders a progress bar from goal values. */
export function GoalProgressBar({
  targetValue,
  currentValue,
}: {
  targetValue: string | null;
  currentValue: string | null;
}) {
  const target = parseFloat(targetValue ?? "0");
  const current = parseFloat(currentValue ?? "0");
  const percent =
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  if (target <= 0) return null;
  return (
    <div className="space-y-1">
      <Progress value={percent} className="h-2" />
      <p className="text-xs text-[#6B7280]">
        {percent}% of target {target.toLocaleString()}
      </p>
    </div>
  );
}
