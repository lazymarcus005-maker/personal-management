import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  decimal,
  boolean,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const todoStatusEnum = pgEnum("todo_status", [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
]);

export const todoPriorityEnum = pgEnum("todo_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

export const financialItemTypeEnum = pgEnum("financial_item_type", [
  "RECURRING_BILL",
  "SUBSCRIPTION",
]);

export const billingCycleEnum = pgEnum("billing_cycle", [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
  "CUSTOM",
]);

export const financialOccurrenceStatusEnum = pgEnum(
  "financial_occurrence_status",
  ["UPCOMING", "DUE", "PAID", "SKIPPED", "OVERDUE"]
);

export const creditCardStatusEnum = pgEnum("credit_card_status", [
  "ACTIVE",
  "INACTIVE",
  "CANCELLED",
]);

export const statementStatusEnum = pgEnum("statement_status", [
  "OPEN",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
]);

export const reminderStatusEnum = pgEnum("reminder_status", [
  "PENDING",
  "SENT",
  "CANCELLED",
]);

export const noteTypeEnum = pgEnum("note_type", [
  "GENERAL",
  "FINANCE",
  "IDEA",
  "REFERENCE",
  "MEETING",
]);

export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
]);

// ============================================================
// Auth tables (next-auth)
// ============================================================

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ============================================================
// Tags
// ============================================================

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").default("#6366f1"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const entityTags = pgTable(
  "entity_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  }
);

// ============================================================
// Recurrence Rules
// ============================================================

export const recurrenceRules = pgTable("recurrence_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  frequency: recurrenceFrequencyEnum("frequency").notNull(),
  interval: integer("interval").default(1).notNull(),
  daysOfWeek: text("days_of_week"),
  dayOfMonth: integer("day_of_month"),
  monthOfYear: integer("month_of_year"),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  endDate: timestamp("end_date", { mode: "date" }),
  nextRunAt: timestamp("next_run_at", { mode: "date" }),
  timezone: text("timezone").default("UTC"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// Reminders
// ============================================================

export const reminders = pgTable("reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  remindAt: timestamp("remind_at", { mode: "date" }).notNull(),
  status: reminderStatusEnum("status").default("PENDING").notNull(),
  type: text("type").default("IN_APP"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// Payment Methods
// ============================================================

export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  details: text("details"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// Todos
// ============================================================

export const todos = pgTable("todos", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: todoStatusEnum("status").default("TODO").notNull(),
  priority: todoPriorityEnum("priority").default("MEDIUM").notNull(),
  dueAt: timestamp("due_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  isRecurring: boolean("is_recurring").default(false),
  recurrenceRuleId: uuid("recurrence_rule_id").references(
    () => recurrenceRules.id
  ),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  archivedAt: timestamp("archived_at", { mode: "date" }),
});

export const todoChecklistItems = pgTable("todo_checklist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  todoId: uuid("todo_id")
    .notNull()
    .references(() => todos.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isCompleted: boolean("is_completed").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// Financial Items (Recurring Bills & Subscriptions)
// ============================================================

export const financialItems = pgTable("financial_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: financialItemTypeEnum("type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("THB"),
  billingCycle: billingCycleEnum("billing_cycle").notNull(),
  billingDay: integer("billing_day"),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  endDate: timestamp("end_date", { mode: "date" }),
  paymentMethodId: uuid("payment_method_id").references(
    () => paymentMethods.id
  ),
  autoRenew: boolean("auto_renew").default(false),
  isVariableAmount: boolean("is_variable_amount").default(false),
  status: text("status").default("ACTIVE"),
  recurrenceRuleId: uuid("recurrence_rule_id").references(
    () => recurrenceRules.id
  ),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const financialOccurrences = pgTable("financial_occurrences", {
  id: uuid("id").defaultRandom().primaryKey(),
  financialItemId: uuid("financial_item_id")
    .notNull()
    .references(() => financialItems.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start", { mode: "date" }).notNull(),
  periodEnd: timestamp("period_end", { mode: "date" }).notNull(),
  dueDate: timestamp("due_date", { mode: "date" }).notNull(),
  expectedAmount: decimal("expected_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),
  actualAmount: decimal("actual_amount", { precision: 12, scale: 2 }),
  status: financialOccurrenceStatusEnum("status").default("UPCOMING").notNull(),
  paidAt: timestamp("paid_at", { mode: "date" }),
  creditCardTransactionId: uuid("credit_card_transaction_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// Credit Cards
// ============================================================

export const creditCards = pgTable("credit_cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bankName: text("bank_name").notNull(),
  lastFourDigits: text("last_four_digits").notNull(),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  statementDay: integer("statement_day").notNull(),
  paymentDueDay: integer("payment_due_day").notNull(),
  status: creditCardStatusEnum("status").default("ACTIVE").notNull(),
  color: text("color").default("#6366f1"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const creditCardStatements = pgTable("credit_card_statements", {
  id: uuid("id").defaultRandom().primaryKey(),
  creditCardId: uuid("credit_card_id")
    .notNull()
    .references(() => creditCards.id, { onDelete: "cascade" }),
  statementPeriodStart: timestamp("statement_period_start", {
    mode: "date",
  }).notNull(),
  statementPeriodEnd: timestamp("statement_period_end", {
    mode: "date",
  }).notNull(),
  statementDate: timestamp("statement_date", { mode: "date" }).notNull(),
  dueDate: timestamp("due_date", { mode: "date" }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  minimumPayment: decimal("minimum_payment", {
    precision: 12,
    scale: 2,
  }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }),
  status: statementStatusEnum("status").default("OPEN").notNull(),
  paidAt: timestamp("paid_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const creditCardTransactions = pgTable("credit_card_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  creditCardId: uuid("credit_card_id")
    .notNull()
    .references(() => creditCards.id, { onDelete: "cascade" }),
  statementId: uuid("statement_id").references(
    () => creditCardStatements.id
  ),
  transactionDate: timestamp("transaction_date", { mode: "date" }).notNull(),
  merchant: text("merchant").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category"),
  installmentNumber: integer("installment_number"),
  installmentTotal: integer("installment_total"),
  financialItemId: uuid("financial_item_id").references(
    () => financialItems.id
  ),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================
// Notes
// ============================================================

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  noteType: noteTypeEnum("note_type").default("GENERAL").notNull(),
  isPinned: boolean("is_pinned").default(false),
  isFavorite: boolean("is_favorite").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  archivedAt: timestamp("archived_at", { mode: "date" }),
});
