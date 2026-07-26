# Subscription Edit, Logo & Swipe Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the `/subscriptions` page, let users edit an existing subscription, set a logo image URL for it, and reach Edit/Delete by swiping a subscription card left.

**Architecture:** Add a nullable `logo_url` column to `financial_items`; extend the existing create-only `SubscriptionFormDialog` to also handle edit (calling the existing `updateFinancialItem` action); replace the static subscription rows with a `SubscriptionCard` client component that implements swipe-to-reveal via Pointer Events, backed by a new `DeleteSubscriptionDialog` confirmation dialog. `SubscriptionList` becomes the state owner coordinating which card is open and which dialogs are shown.

**Tech Stack:** Next.js App Router (Server Actions), Drizzle ORM + Neon Postgres, React Hook Form + Zod, Radix UI (`Dialog`, `Switch`, `Select`), Tailwind CSS, lucide-react icons. No test framework is configured in this repo — verification is TypeScript compilation (`npx tsc --noEmit`) plus manual checks against the running dev server, per repo convention.

## Global Constraints

- No new npm dependencies. Logo is a pasted image URL only (no upload/storage provider); reuse the existing `Dialog` primitives for the delete confirmation (no new AlertDialog dependency).
- Touch only `/subscriptions` and its supporting files (`src/lib/actions/finance.ts`, `src/db/schema.ts`). Do not modify `/finance`, `upcoming-payments.tsx`, or `financial-item-form.tsx`.
- Edit/Delete are reached only by swiping the card left to reveal the action buttons — no 3-dot menu, no always-visible icon buttons.
- Deleting a subscription always requires confirming in a dialog first; there is no undo.
- Match existing code style: Tailwind utility classes against the app's fixed hex palette (`#13141A` text, `#6B7280` muted text, `#EEF0F5` neutral fill, `#E5DBFE` purple fill, `rounded-[20px]` cards / `rounded-[14px]` inputs), React Hook Form + Zod for forms, Server Actions in `src/lib/actions/finance.ts` for mutations, `router.refresh()` after a mutation completes.

---

### Task 1: Add `logoUrl` column to the schema

**Files:**
- Modify: `src/db/schema.ts:298-300`

**Interfaces:**
- Produces: `financialItems.logoUrl` column (`text`, nullable), available on every `InferSelectModel<typeof financialItems>` value used by later tasks.

- [ ] **Step 1: Add the column**

In `src/db/schema.ts`, the `financialItems` table currently reads:

```ts
    name: text("name").notNull(),
    description: text("description"),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
```

Change it to:

```ts
    name: text("name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (the new column is purely additive).

- [ ] **Step 3: Push the schema change to the database**

Run: `npx drizzle-kit push`
Expected: drizzle-kit reports it is adding the `logo_url` column to `financial_items` (a plain `ADD COLUMN`, no destructive/ambiguous changes, so it should apply without an interactive rename prompt). Confirm the command exits 0.

If it does prompt (e.g. asks whether this is a rename of an existing column), choose the "create column" option — this is a brand-new column, not a rename.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts
git commit -m "Add logoUrl column to financial_items"
```

---

### Task 2: Persist and revalidate `logoUrl` in the finance actions

**Files:**
- Modify: `src/lib/actions/finance.ts:14-26` (schema), `:43-72` (create), `:74-95` (update), `:97-108` (delete)

**Interfaces:**
- Consumes: `financialItems.logoUrl` from Task 1.
- Produces: `createFinancialItem(data)` and `updateFinancialItem(id, data)` now accept an optional `logoUrl: string` in `data`; all three mutation actions (`createFinancialItem`, `updateFinancialItem`, `deleteFinancialItem`) revalidate `/subscriptions` in addition to `/finance` and `/`.

- [ ] **Step 1: Add `logoUrl` to the shared schema**

In `src/lib/actions/finance.ts`, change:

```ts
const financialItemSchema = z.object({
  type: z.enum(["RECURRING_BILL", "SUBSCRIPTION"]),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  amount: z.string(),
  currency: z.string(),
  billingCycle: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]),
  billingDay: z.number().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  paymentMethodId: z.string().optional(),
  autoRenew: z.boolean(),
});
```

to:

```ts
const financialItemSchema = z.object({
  type: z.enum(["RECURRING_BILL", "SUBSCRIPTION"]),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  amount: z.string(),
  currency: z.string(),
  billingCycle: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]),
  billingDay: z.number().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  paymentMethodId: z.string().optional(),
  autoRenew: z.boolean(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});
```

- [ ] **Step 2: Persist `logoUrl` on create and revalidate `/subscriptions`**

In the same file, change `createFinancialItem`:

```ts
  const parsed = financialItemSchema.parse(data);
  const [item] = await db
    .insert(financialItems)
    .values({
      userId: session.user.id,
      type: parsed.type,
      name: parsed.name,
      description: parsed.description,
      amount: parsed.amount,
      currency: parsed.currency,
      billingCycle: parsed.billingCycle,
      billingDay: parsed.billingDay,
      startDate: new Date(parsed.startDate),
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      paymentMethodId: parsed.paymentMethodId || null,
      autoRenew: parsed.autoRenew,
    })
    .returning();

  revalidatePath("/finance");
  revalidatePath("/");
  return item;
```

to:

```ts
  const parsed = financialItemSchema.parse(data);
  const [item] = await db
    .insert(financialItems)
    .values({
      userId: session.user.id,
      type: parsed.type,
      name: parsed.name,
      description: parsed.description,
      amount: parsed.amount,
      currency: parsed.currency,
      billingCycle: parsed.billingCycle,
      billingDay: parsed.billingDay,
      startDate: new Date(parsed.startDate),
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      paymentMethodId: parsed.paymentMethodId || null,
      autoRenew: parsed.autoRenew,
      logoUrl: parsed.logoUrl || null,
    })
    .returning();

  revalidatePath("/finance");
  revalidatePath("/subscriptions");
  revalidatePath("/");
  return item;
```

- [ ] **Step 3: Revalidate `/subscriptions` on update**

Change `updateFinancialItem`'s tail:

```ts
  const [item] = await db
    .update(financialItems)
    .set(updateData as any)
    .where(and(eq(financialItems.id, id), eq(financialItems.userId, session.user.id)))
    .returning();

  revalidatePath("/finance");
  revalidatePath("/");
  return item;
```

to:

```ts
  const [item] = await db
    .update(financialItems)
    .set(updateData as any)
    .where(and(eq(financialItems.id, id), eq(financialItems.userId, session.user.id)))
    .returning();

  revalidatePath("/finance");
  revalidatePath("/subscriptions");
  revalidatePath("/");
  return item;
```

- [ ] **Step 4: Revalidate `/subscriptions` on delete**

Change `deleteFinancialItem`:

```ts
  await db
    .delete(financialItems)
    .where(and(eq(financialItems.id, id), eq(financialItems.userId, session.user.id)));

  revalidatePath("/finance");
  revalidatePath("/");
}
```

to:

```ts
  await db
    .delete(financialItems)
    .where(and(eq(financialItems.id, id), eq(financialItems.userId, session.user.id)));

  revalidatePath("/finance");
  revalidatePath("/subscriptions");
  revalidatePath("/");
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/finance.ts
git commit -m "Persist subscription logoUrl and revalidate /subscriptions on mutations"
```

---

### Task 3: Extend `SubscriptionFormDialog` for edit mode and a logo URL field

**Files:**
- Modify: `src/app/(authenticated)/subscriptions/subscription-form-dialog.tsx` (full rewrite)

**Interfaces:**
- Consumes: `updateFinancialItem(id, data)` and `createFinancialItem(data)` from Task 2; `InferSelectModel<typeof financialItems>` (includes `logoUrl` from Task 1).
- Produces: `SubscriptionFormDialog({ open, onOpenChange, subscription? })` — when `subscription` is provided (and non-null), the dialog opens pre-filled and submits via `updateFinancialItem`; otherwise it behaves as the existing create flow. This is the exact prop shape Task 4's `SubscriptionList` will call.

- [ ] **Step 1: Replace the file contents**

Replace the full contents of `src/app/(authenticated)/subscriptions/subscription-form-dialog.tsx` with:

```tsx
"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFinancialItem, updateFinancialItem } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import type { InferSelectModel } from "drizzle-orm";
import type { financialItems as financialItemsTable } from "@/db/schema";

type Subscription = InferSelectModel<typeof financialItemsTable>;

const formSchema = z.object({
  type: z.enum(["RECURRING_BILL", "SUBSCRIPTION"]),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  currency: z.string(),
  billingCycle: z.enum([
    "WEEKLY",
    "MONTHLY",
    "QUARTERLY",
    "YEARLY",
    "CUSTOM",
  ]),
  billingDay: z.number().min(1).max(31).optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  autoRenew: z.boolean(),
  logoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

const emptyDefaults: FormData = {
  type: "SUBSCRIPTION",
  name: "",
  description: "",
  amount: "",
  currency: "THB",
  billingCycle: "MONTHLY",
  billingDay: undefined,
  startDate: "",
  endDate: "",
  autoRenew: false,
  logoUrl: "",
};

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function subscriptionToFormData(subscription: Subscription): FormData {
  return {
    type: subscription.type,
    name: subscription.name,
    description: subscription.description ?? "",
    amount: subscription.amount,
    currency: subscription.currency ?? "THB",
    billingCycle: subscription.billingCycle,
    billingDay: subscription.billingDay ?? undefined,
    startDate: toDateInputValue(subscription.startDate),
    endDate: toDateInputValue(subscription.endDate),
    autoRenew: subscription.autoRenew ?? false,
    logoUrl: subscription.logoUrl ?? "",
  };
}

export function SubscriptionFormDialog({
  open,
  onOpenChange,
  subscription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription?: Subscription | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEditing = Boolean(subscription);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (open) {
      reset(subscription ? subscriptionToFormData(subscription) : emptyDefaults);
    }
  }, [open, subscription, reset]);

  const logoUrl = watch("logoUrl");

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      if (subscription) {
        await updateFinancialItem(subscription.id, data);
      } else {
        await createFinancialItem(data);
      }
      reset();
      onOpenChange(false);
      router.refresh();
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-[20px]">
        <DialogHeader>
          <DialogTitle className="text-[#13141A]">
            {isEditing ? "Edit Subscription" : "Add Subscription"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Service Name</Label>
            <Input
              id="name"
              placeholder="e.g. Netflix, Spotify"
              {...register("name")}
              className="rounded-[14px]"
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Optional"
              {...register("description")}
              className="rounded-[14px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <div className="flex items-center gap-3">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover shrink-0 bg-[#EEF0F5]"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                  onLoad={(e) => {
                    e.currentTarget.style.visibility = "visible";
                  }}
                />
              )}
              <Input
                id="logoUrl"
                placeholder="https://example.com/logo.png"
                {...register("logoUrl")}
                className="rounded-[14px]"
              />
            </div>
            {errors.logoUrl && (
              <p className="text-xs text-red-500">{errors.logoUrl.message}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("amount")}
                className="rounded-[14px]"
              />
              {errors.amount && (
                <p className="text-xs text-red-500">
                  {errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Billing Cycle</Label>
              <Select
                defaultValue={subscription?.billingCycle ?? "MONTHLY"}
                onValueChange={(v) =>
                  setValue(
                    "billingCycle",
                    v as "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM"
                  )
                }
              >
                <SelectTrigger className="rounded-[14px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billingDay">Billing Day</Label>
              <Input
                id="billingDay"
                type="number"
                min={1}
                max={31}
                placeholder="15"
                {...register("billingDay", { valueAsNumber: true })}
                className="rounded-[14px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                {...register("startDate")}
                className="rounded-[14px]"
              />
              {errors.startDate && (
                <p className="text-xs text-red-500">
                  {errors.startDate.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="autoRenew"
              defaultChecked={subscription?.autoRenew ?? false}
              onCheckedChange={(v) => setValue("autoRenew", v)}
            />
            <Label htmlFor="autoRenew">Auto Renew</Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-[14px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-[14px] bg-[#13141A] hover:bg-[#13141A]/90"
            >
              {isPending
                ? isEditing
                  ? "Saving..."
                  : "Adding..."
                : isEditing
                  ? "Save Changes"
                  : "Add Subscription"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify the create flow still works (regression check)**

Run: `npm run dev`, open `/subscriptions` in the browser, click the `+` button in the header.
Expected: dialog title reads "Add Subscription", a new "Logo URL" field is visible below Description, submit button reads "Add Subscription". Paste an image URL (e.g. `https://logo.clearbit.com/netflix.com`) into Logo URL — a small circular preview appears next to the input. Fill in Service Name/Amount/Start Date and submit; the dialog closes and the new subscription appears in the list (as before — its avatar still shows the icon, not the logo, until Task 4 wires that up).

Note: edit-mode pre-fill (title "Edit Subscription", fields populated from an existing record) has no UI trigger yet — it is exercised end-to-end in Task 4's verification once `SubscriptionCard`/`SubscriptionList` pass a `subscription` prop in.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/subscriptions/subscription-form-dialog.tsx"
git commit -m "Support edit mode and logo URL in SubscriptionFormDialog"
```

---

### Task 4: Swipeable subscription card, delete confirmation, and list wiring

**Files:**
- Create: `src/app/(authenticated)/subscriptions/subscription-card.tsx`
- Create: `src/app/(authenticated)/subscriptions/delete-subscription-dialog.tsx`
- Modify: `src/app/(authenticated)/subscriptions/subscription-list.tsx` (full rewrite)

**Interfaces:**
- Consumes: `SubscriptionFormDialog` from Task 3; `deleteFinancialItem` and `financialItems.logoUrl` from Tasks 1–2.
- Produces:
  - `SubscriptionCard({ subscription, isOpen, onOpenChange, onEdit, onDelete })` — renders one row; swiping left past 40% of the reveal width (or dragging past it) opens the actions, calling `onOpenChange(true)`; tapping the row while open calls `onOpenChange(false)`.
  - `DeleteSubscriptionDialog({ subscription, onOpenChange })` — `subscription === null` means closed; renders a confirm dialog when non-null.
  - `SubscriptionList({ subscriptions })` — unchanged public props; internally owns `openCardId`, `editingSubscription`, `deletingSubscription` state.

- [ ] **Step 1: Create `subscription-card.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pencil,
  Trash2,
  Film,
  Wifi,
  Zap,
  Smartphone,
  Cloud,
  Music,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { financialItems as financialItemsTable } from "@/db/schema";

type Subscription = InferSelectModel<typeof financialItemsTable>;

const iconMap: Record<string, LucideIcon> = {
  netflix: Film,
  spotify: Music,
  youtube: Film,
  cloud: Cloud,
  internet: Wifi,
  mobile: Smartphone,
  electricity: Zap,
  chatgpt: BookOpen,
  copilot: BookOpen,
  default: Film,
};

function getIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(iconMap)) {
    if (lower.includes(key)) return icon;
  }
  return iconMap.default;
}

function getCycleLabel(cycle: string): string {
  const map: Record<string, string> = {
    WEEKLY: "/wk",
    MONTHLY: "/mo",
    QUARTERLY: "/qtr",
    YEARLY: "/yr",
    CUSTOM: "",
  };
  return map[cycle] || "";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const ACTION_WIDTH = 76;
const REVEAL_WIDTH = ACTION_WIDTH * 2;
const OPEN_THRESHOLD = REVEAL_WIDTH * 0.4;

export function SubscriptionCard({
  subscription,
  isOpen,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  subscription: Subscription;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [translateX, setTranslateX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ pointerX: 0, startTranslate: 0 });
  // Tracks whether the current pointer interaction moved past a small
  // threshold, so the click event that fires right after a drag-release
  // doesn't immediately re-close the card it just opened.
  const movedRef = useRef(false);

  useEffect(() => {
    if (!dragging) setTranslateX(isOpen ? -REVEAL_WIDTH : 0);
  }, [isOpen, dragging]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { pointerX: e.clientX, startTranslate: translateX };
    movedRef.current = false;
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const delta = e.clientX - dragStartRef.current.pointerX;
    if (Math.abs(delta) > 4) movedRef.current = true;
    setTranslateX(
      clamp(dragStartRef.current.startTranslate + delta, -REVEAL_WIDTH, 0)
    );
  }

  function endDrag() {
    if (!dragging) return;
    setDragging(false);
    onOpenChange(translateX <= -OPEN_THRESHOLD);
  }

  function handleCardClick() {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (isOpen) onOpenChange(false);
  }

  const Icon = getIcon(subscription.name);

  return (
    <div className="relative rounded-[20px] overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={onEdit}
          style={{ width: ACTION_WIDTH }}
          className="h-full flex flex-col items-center justify-center gap-1 bg-[#E5DBFE] text-[#13141A] text-xs font-medium"
        >
          <Pencil className="w-4 h-4" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          style={{ width: ACTION_WIDTH }}
          className="h-full flex flex-col items-center justify-center gap-1 bg-red-500 text-white text-xs font-medium"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleCardClick}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
          touchAction: "pan-y",
        }}
        className="relative z-10 rounded-[20px] bg-white p-4 flex items-center gap-4 select-none"
      >
        <div className="w-12 h-12 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0 overflow-hidden">
          {subscription.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={subscription.logoUrl}
              alt=""
              draggable={false}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Icon className="w-5 h-5 text-[#13141A]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#13141A] truncate">
            {subscription.name}
          </p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {subscription.description || subscription.billingCycle}
            {subscription.autoRenew && " · Auto-renew"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-[#13141A]">
            {parseFloat(subscription.amount).toLocaleString()}
            <span className="text-xs font-normal text-[#6B7280] ml-0.5">
              {getCycleLabel(subscription.billingCycle)}
            </span>
          </p>
          {subscription.billingDay && (
            <p className="text-xs text-[#6B7280] mt-0.5">
              Day {subscription.billingDay}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `delete-subscription-dialog.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFinancialItem } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { InferSelectModel } from "drizzle-orm";
import type { financialItems as financialItemsTable } from "@/db/schema";

type Subscription = InferSelectModel<typeof financialItemsTable>;

export function DeleteSubscriptionDialog({
  subscription,
  onOpenChange,
}: {
  subscription: Subscription | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!subscription) return;
    startTransition(async () => {
      await deleteFinancialItem(subscription.id);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={subscription !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] rounded-[20px]">
        <DialogHeader>
          <DialogTitle className="text-[#13141A]">
            Delete subscription?
          </DialogTitle>
          <DialogDescription>
            {subscription
              ? `"${subscription.name}" will be permanently removed. This can't be undone.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-[14px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleDelete}
            className="rounded-[14px]"
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Rewrite `subscription-list.tsx` to orchestrate cards and dialogs**

Replace the full contents of `src/app/(authenticated)/subscriptions/subscription-list.tsx` with:

```tsx
"use client";

import { useState } from "react";
import type { InferSelectModel } from "drizzle-orm";
import type { financialItems as financialItemsTable } from "@/db/schema";
import { SubscriptionCard } from "./subscription-card";
import { SubscriptionFormDialog } from "./subscription-form-dialog";
import { DeleteSubscriptionDialog } from "./delete-subscription-dialog";

type Subscription = InferSelectModel<typeof financialItemsTable>;

export function SubscriptionList({
  subscriptions,
}: {
  subscriptions: Subscription[];
}) {
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] =
    useState<Subscription | null>(null);
  const [deletingSubscription, setDeletingSubscription] =
    useState<Subscription | null>(null);

  if (subscriptions.length === 0) {
    return (
      <div className="rounded-[20px] bg-white p-8 text-center">
        <p className="text-[#6B7280]">No active subscriptions yet.</p>
        <p className="text-sm text-[#6B7280] mt-1">
          Add your first subscription to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {subscriptions.map((sub) => (
          <SubscriptionCard
            key={sub.id}
            subscription={sub}
            isOpen={openCardId === sub.id}
            onOpenChange={(open) => setOpenCardId(open ? sub.id : null)}
            onEdit={() => {
              setOpenCardId(null);
              setEditingSubscription(sub);
            }}
            onDelete={() => {
              setOpenCardId(null);
              setDeletingSubscription(sub);
            }}
          />
        ))}
      </div>
      <SubscriptionFormDialog
        open={editingSubscription !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSubscription(null);
        }}
        subscription={editingSubscription}
      />
      <DeleteSubscriptionDialog
        subscription={deletingSubscription}
        onOpenChange={(open) => {
          if (!open) setDeletingSubscription(null);
        }}
      />
    </>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no new errors (the `@next/next/no-img-element` rule is pre-empted with inline disable comments on the two new `<img>` tags, matching how a plain image URL is rendered without Next's `<Image>` remote-pattern configuration).

- [ ] **Step 6: Manual end-to-end verification in the browser**

Run: `npm run dev`, open `/subscriptions`.

1. **Logo displays:** the subscription created in Task 3 with a logo URL now shows that image (not the icon) in its avatar circle.
2. **Swipe reveals actions:** on a card, press and drag left (mouse: click-drag; touch: swipe) — the card slides left and the purple Edit / red Delete buttons appear behind it. Release past roughly the halfway point: it snaps fully open. Release before that: it snaps back closed.
3. **Only one card open at a time:** open one card via swipe, then swipe a second card — the first closes automatically.
4. **Tap to close:** with a card open, tap the card body (not the buttons) — it closes.
5. **Edit flow:** swipe a card open, tap Edit — `SubscriptionFormDialog` opens titled "Edit Subscription" with all fields (name, description, logo URL + preview, amount, billing cycle, billing day, start date, auto-renew) pre-filled from that subscription. Change the amount and submit — the dialog closes and the card shows the new amount.
6. **Delete flow:** swipe a card open, tap Delete — a confirmation dialog appears naming the subscription. Click Cancel — dialog closes, subscription still present. Swipe and tap Delete again, click Delete — the subscription is removed from the list.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(authenticated)/subscriptions/subscription-card.tsx" "src/app/(authenticated)/subscriptions/delete-subscription-dialog.tsx" "src/app/(authenticated)/subscriptions/subscription-list.tsx"
git commit -m "Add swipe-to-reveal edit/delete actions to subscription list"
```
