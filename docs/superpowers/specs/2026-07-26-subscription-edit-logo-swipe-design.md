# Subscriptions: Edit, Logo, Swipe Actions — Design

## Goal

On the `/subscriptions` page, let users:
1. Edit an existing subscription.
2. Set a logo (image) for a subscription.
3. Reveal Edit/Delete actions by swiping a subscription card left, instead of only being able to create new subscriptions.

Scope is limited to the subscriptions page and its supporting actions/schema. No new infrastructure (no file upload/storage provider) is introduced.

## Data model

Add one nullable column to `financial_items` (`src/db/schema.ts`):

```ts
logoUrl: text("logo_url"),
```

Applied directly via `drizzle-kit push` (this repo edits `schema.ts` and pushes directly — no generated SQL migration files are tracked; confirmed by prior schema change in commit `f1ec344`).

## Server actions (`src/lib/actions/finance.ts`)

- Add `logoUrl: z.string().url().optional().or(z.literal(""))` to `financialItemSchema`.
- `createFinancialItem` and `updateFinancialItem` pass `logoUrl` through to the insert/update payload (empty string treated as `null`).
- Add `revalidatePath("/subscriptions")` to `createFinancialItem`, `updateFinancialItem`, and `deleteFinancialItem`. This is currently missing, which is why edits/deletes wouldn't reflect on the subscriptions page without a manual refresh.

No changes needed to `src/lib/actions/subscriptions.ts` — it only reads data.

## Form dialog (`subscriptions/subscription-form-dialog.tsx`)

Reused for both create and edit flows:

- New optional prop `subscription?: Subscription`. When provided:
  - Form fields are pre-filled from the record via `reset()`/`defaultValues`.
  - Submit calls `updateFinancialItem(subscription.id, data)` instead of `createFinancialItem(data)`.
  - Dialog title reads "Edit Subscription" and submit button reads "Save Changes" (vs. "Add Subscription" when creating).
- New "Logo URL" optional text input (`logoUrl`), with a small live circular image preview next to it. If the URL is empty or fails to load, the preview silently falls back to nothing (no broken-image icon) — the row itself falls back to the existing icon avatar.
- The header's existing "Add" trigger continues to use this dialog in create mode (no `subscription` prop passed).

## Swipeable list

### `subscriptions/subscription-list.tsx` (parent, client component)

Becomes the state owner:
- `openCardId: string | null` — which card (if any) currently has its actions revealed. Passed to each card along with a setter, so opening one card closes any other.
- `editingSubscription: Subscription | null` — controls the shared `SubscriptionFormDialog` in edit mode.
- `deletingSubscription: Subscription | null` — controls a shared delete-confirmation dialog.
- Renders one `SubscriptionFormDialog` and one confirmation `Dialog` at the list level (not per-card), fed by the above state.
- Maps subscriptions to `SubscriptionCard`, passing `onEdit`/`onDelete` callbacks that set the above state.

### `subscriptions/subscription-card.tsx` (new, client component)

- Renders the existing row content (icon/logo, name, description, amount) as the swipeable foreground layer.
- Behind it (absolutely positioned, right-aligned): two action buttons — Edit (pencil icon, neutral background) and Delete (trash icon, red background), each `~76px` wide.
- Drag handled via Pointer Events (`onPointerDown/Move/Up/Cancel`) on the foreground layer, supporting both touch and mouse:
  - Track drag delta, clamp translateX between `-152px` (both buttons revealed) and `0`.
  - No CSS transition while actively dragging; snap open/closed with a transition on release, based on a drag-distance threshold (~40% of full reveal).
  - `touch-action: pan-y` on the foreground layer so vertical page scroll isn't blocked.
- Tapping the foreground layer while a card is open closes it (does not open the edit dialog).
- Logo/icon avatar: renders `<img src={subscription.logoUrl}>` in a rounded container when `logoUrl` is set; otherwise falls back to the current name-derived Lucide icon.

### Delete confirmation

Reuses the existing `Dialog` primitives (no new dependency): "Delete {name}?" with Cancel / Delete buttons. Confirm calls `deleteFinancialItem(id)` (via `useTransition`), then `router.refresh()`, then clears `deletingSubscription`.

## Out of scope

- File upload / image hosting (logo is a pasted URL only, per explicit decision).
- Swipe actions on `upcoming-payments.tsx` or the generic `/finance` page — only `/subscriptions` is touched.
- Any bulk edit/delete.
