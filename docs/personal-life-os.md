# Personal Life OS — Architecture & User Flows

Implements [#11](https://github.com/lazymarcus005-maker/personal-management/issues/11).
The Life OS turns the existing finance app into a unified command center built
around **Areas → Projects → Goals**, a single **Capture** entry point, a
configurable **Today** dashboard, a **Journal**, a **Review** loop, and an
expanded finance model — without rewriting any existing module.

## Navigation

| Route | Purpose |
|---|---|
| `/` (Today) | Configurable widget dashboard |
| `/capture` | Quick capture + inbox |
| `/explore` | Unified search with filters |
| `/projects` | Projects, Goals, Areas (tabs) + project detail pages |
| `/finance` | Bills, Subscriptions, Transactions, Accounts, Budgets (tabs) |
| `/review` | Weekly / monthly review |
| `/journal` | Daily reflections |

## Schema (migration `drizzle/0002_personal_life_os.sql`)

All tables are user-scoped (`user_id` FK, cascade delete) and indexed on the
columns used by user-scoped queries.

### Context layer

- **`areas`** — Work / Personal / Finance / Health / Hobby / Learning / Family.
  Fields: `name`, `type`, `description`, `color`, `icon`, `sort_order`,
  `archived_at` (soft archive).
- **`projects`** — `area_id` FK (set null), `name`, `description`,
  `status` enum `PLANNING|ACTIVE|PAUSED|COMPLETED|ARCHIVED`, `priority`
  (shares the `todo_priority` enum), `start_date`, `target_date`.
- **`goals`** — `area_id` + `project_id` FKs, `status` enum
  `ACTIVE|COMPLETED|PAUSED|CANCELLED`, `target_value`/`current_value`
  (numeric 12,2) + `unit`, `target_date`.
- **`entity_links`** — polymorphic typed links: `source_type/source_id →
  target_type/target_id` with `relation_type`
  (`PART_OF|RELATED_TO|SUPPORTS|BLOCKS|PAID_FOR|GENERATED_FROM|INSPIRED_BY`).
  No DB FK on the endpoints (polymorphic); the owning server action verifies
  both endpoints against the mapped table and the current user id.

### Journal & capture

- **`journal_entries`** — `entry_date`, `title`, `content`, `mood`,
  `energy_level` (1–5), `wins`, `concerns`. Multiple entries per day are
  allowed.
- **`capture_items`** — the capture inbox: `raw_text`, `suggested_type`,
  `payload` (jsonb: title/amount/currency/dueDate/tags/areaHint), `status`
  enum `NEW|CONVERTED|DISMISSED`, `converted_entity_type/_id`.

### Finance expansion

Recurring bills/subscriptions stay in `financial_items` (its free-text
`status` column is now the `financial_item_status` enum
`ACTIVE|PAUSED|CANCELLED`). Everything else is typed separately:

- **`financial_accounts`** — `type` enum
  `BANK|CASH|WALLET|INVESTMENT|CREDIT_CARD`, `opening_balance`,
  `current_balance`, `archived_at`.
- **`financial_categories`** — user-defined spending categories.
- **`financial_transactions`** — `account_id` FK (cascade), `category_id` /
  `project_id` / `area_id` FKs (set null), `type` enum
  `INCOME|EXPENSE|TRANSFER`, `amount`, `transaction_date`, `merchant`,
  `description`, `deleted_at` (**soft delete** — financial history is never
  hard-deleted). Creating a transaction updates the account balance in the
  same DB transaction.
- **`budgets`** — monthly (or yearly) `amount` per `category_id` or `area_id`.

### Additive changes to existing tables

- `todos.area_id`, `todos.project_id` (FKs, set null)
- `notes.area_id`, `notes.project_id` (FKs, set null)
- `todos.recurrence_rule_id`, `financial_items.recurrence_rule_id`,
  `financial_items.payment_method_id` now have real FKs (`set null`)
  — Phase 0 hardening
- `entity_tags` gained `tag_id` and `(entity_type, entity_id)` indexes

## Domain logic (no business logic in page components)

- **Ownership guards** — `src/lib/guards.ts`: `requireUserId()` (every action
  starts here) and `assertOwnership()` (row exists **and** belongs to the
  caller — used everywhere a related id arrives from the client: area/project
  on todos & notes, payment methods on bills, account/category/area/project on
  transactions and budgets, both endpoints of entity links).
- **Capture classifier** — `src/lib/capture/classify.ts`: pure, deterministic
  rule-based classifier (Thai + English). Returns `{ type, title, amount,
  currency, dueDate, suggestedTags, areaHint }`. AI classification can replace
  it later without touching callers.
- **Finance summaries** — `src/lib/services/finance-summary.ts`: pure
  functions for recurring → monthly/yearly amortization, monthly income &
  expense, spending by category/area/project, budget vs actual, net worth.
  Shared by the finance page, review page, and tests.
- **Entity registry** — `src/lib/entity-registry.ts`: canonical entity type +
  relation type lists shared by links, search, and the picker.

## User flows

### Quick capture

1. Type raw text anywhere via **Capture** (or the Capture button on Today).
2. `classifyCaptureText` suggests a type without persisting anything.
3. The user edits the classification (type, title, amount, account, due date,
   area, project) and confirms — **manual classification before save**.
   Alternatively "Save to inbox" defers it (status `NEW`).
4. `saveCapture` creates the entity **and** the inbox record in one DB
   transaction. Duplicate guard: identical raw text with an existing `NEW`
   inbox item is skipped — **no duplicate records**.

### Project detail

`/projects/[id]` shows linked tasks, notes, goals and expenses (via direct
`project_id` FKs), stats cards, and the reusable **EntityLinkPicker** to link
any owned entity through `entity_links` (idempotent — duplicate links are
skipped).

### Today dashboard

Widgets are server components in `src/components/dashboard/widgets.tsx`
(tasks due today, overdue, inbox, bills, active projects, goal progress,
journal prompt, reminders, notes, expenses, and a health widget that only
renders when Strava/Apple Health is connected). `DashboardGrid` lets each user
reorder and show/hide sections (localStorage-backed via
`useSyncExternalStore`).

### Review

`/review?period=week|month` aggregates tasks completed/created, journal
entries, actual income/expense vs recurring monthly obligations, and top
spending by category and area.

## Security rules enforced

- Every query is scoped by the authenticated user id.
- Related entity ids are ownership-checked before insert/update.
- A user cannot read or mutate another user's entity by changing an id
  (project detail 404s, link creation rejects foreign endpoints).
- Financial transactions use soft deletion; Zod validates all mutation input.

## Testing

- `src/lib/capture/__tests__/classify.test.ts` — all four handoff examples
  (Thai expense, tomorrow reminder, idea, journal reflection) plus edge cases.
- `src/lib/services/__tests__/finance-summary.test.ts` — recurring
  amortization, monthly totals, grouped spending, budget vs actual, net worth.
- `src/lib/__tests__/guards.test.ts` — auth guard + cross-user ownership
  boundary (`assertOwnership` never leaks rows across users).

## Applying the migration

```bash
npm run db:push        # or: apply drizzle/0002_personal_life_os.sql directly
```

The migration is additive; existing Finance, Subscription, Todo, Notes, and
Health flows keep working unchanged.
