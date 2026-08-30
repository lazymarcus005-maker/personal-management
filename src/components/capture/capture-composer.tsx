"use client";

import { useState, useTransition } from "react";
import {
  classifyCaptureText,
  saveCapture,
  saveToInbox,
} from "@/lib/actions/capture";
import type { CaptureSuggestion } from "@/lib/capture/classify";
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
  Zap,
  Inbox,
  Sparkles,
  Check,
  ArchiveX,
} from "lucide-react";

type AreaOption = { id: string; name: string };
type ProjectOption = { id: string; name: string };
type AccountOption = { id: string; name: string; currency: string | null };

const CAPTURE_TYPES = [
  { value: "TODO", label: "Todo" },
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "JOURNAL_ENTRY", label: "Journal entry" },
  { value: "IDEA", label: "Idea (note)" },
  { value: "NOTE", label: "Note" },
];

export function CaptureComposer({
  areas,
  projects,
  accounts,
}: {
  areas: AreaOption[];
  projects: ProjectOption[];
  accounts: AccountOption[];
}) {
  const [rawText, setRawText] = useState("");
  const [suggestion, setSuggestion] = useState<CaptureSuggestion | null>(null);
  const [type, setType] = useState<string>("NOTE");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const applySuggestion = (s: CaptureSuggestion) => {
    setSuggestion(s);
    // Keep the classifier's type — including INCOME — so the sign is right.
    setType(s.type);
    setTitle(s.title);
    setAmount(s.amount !== null ? String(s.amount) : "");
    setDueDate(s.dueDate ? s.dueDate.slice(0, 10) : "");
    setAreaId("");
    setProjectId("");
    if ((s.type === "EXPENSE" || s.type === "INCOME") && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  };

  const onClassify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(null);
    startTransition(async () => {
      try {
        const s = await classifyCaptureText(rawText);
        applySuggestion(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Classification failed");
      }
    });
  };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveCapture({
          rawText,
          type,
          title,
          amount: amount ? Number(amount) : null,
          currency: suggestion?.currency ?? "THB",
          dueDate: type === "TODO" && dueDate ? new Date(dueDate).toISOString() : null,
          accountId: accountId || null,
          areaId: areaId || null,
          projectId: projectId || null,
        });
        if (result.duplicate) {
          setSaved("Already in your inbox — no duplicate created.");
        } else {
          setSaved("Saved!");
        }
        setRawText("");
        setSuggestion(null);
        setTitle("");
        setAmount("");
        setDueDate("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  const onInbox = () => {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      try {
        await saveToInbox(rawText);
        setSaved("Stored in inbox for later.");
        setRawText("");
        setSuggestion(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  const needsAccount = type === "EXPENSE" || type === "INCOME";

  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm space-y-4">
      <form onSubmit={onClassify} className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#18201C]" />
          <h2 className="font-bold text-[#13141A]">Quick capture</h2>
        </div>
        <Textarea
          placeholder={
            "Type anything — e.g.\nซื้อคีย์บอร์ด 2,590 บาท สำหรับ hobby keyboard\nพรุ่งนี้โทรหาคุณ A\nวันนี้ทำงานได้ดี แต่รู้สึกเหนื่อยช่วงบ่าย"
          }
          className="min-h-[90px]"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          required
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending || !rawText.trim()}>
            <Sparkles className="h-4 w-4 mr-1" />
            {isPending ? "Thinking…" : "Classify"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onInbox}
            disabled={isPending || !rawText.trim()}
          >
            <Inbox className="h-4 w-4 mr-1" /> Save to inbox
          </Button>
        </div>
      </form>

      {saved && (
        <p className="text-sm text-[#5B713B] bg-[#F4F8EC] rounded-xl px-3 py-2 flex items-center gap-2">
          <Check className="h-4 w-4" /> {saved}
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {suggestion && (
        <form onSubmit={onSave} className="space-y-3 border-t border-[#EEF0F5] pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7A847E]">
            Suggested: {suggestion.type} — edit before saving
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPTURE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            {needsAccount && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Account</Label>
                  {accounts.length === 0 ? (
                    <p className="text-xs text-red-500">
                      Create a financial account first (Finance → Accounts).
                    </p>
                  ) : (
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </>
            )}
            {type === "TODO" && (
              <div className="space-y-1">
                <Label className="text-xs">Due date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Area</Label>
              <Select value={areaId || "none"} onValueChange={(v) => setAreaId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No area</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {suggestion.areaHint === a.name ? " ★" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Project</Label>
              <Select
                value={projectId || "none"}
                onValueChange={(v) => setProjectId(v === "none" ? "" : v)}
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
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      )}
    </div>
  );
}

export function DismissInboxItemButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7"
      aria-label="Dismiss item"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const { dismissCaptureItem } = await import("@/lib/actions/capture");
          await dismissCaptureItem(id);
        })
      }
    >
      <ArchiveX className="h-3.5 w-3.5" />
    </Button>
  );
}
