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
  index,
  uniqueIndex,
  bigint,
  jsonb,
  real,
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
    userIdIdx: index("account_user_id_idx").on(account.userId),
  })
);

export const sessions = pgTable(
  "session",
  {
    sessionToken: text("sessionToken").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_user_id_idx").on(session.userId),
  })
);

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

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    tokenHashIdx: index("password_reset_tokens_token_hash_idx").on(
      t.tokenHash
    ),
    userIdIdx: index("password_reset_tokens_user_id_idx").on(t.userId),
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

export const reminders = pgTable(
  "reminders",
  {
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
  },
  (reminder) => ({
    userIdIdx: index("reminders_user_id_idx").on(reminder.userId),
    statusIdx: index("reminders_status_idx").on(reminder.status),
    remindAtIdx: index("reminders_remind_at_idx").on(reminder.remindAt),
  })
);

// ============================================================
// Payment Methods
// ============================================================

export const paymentMethods = pgTable(
  "payment_methods",
  {
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
  },
  (pm) => ({
    userIdIdx: index("payment_methods_user_id_idx").on(pm.userId),
  })
);

// ============================================================
// Todos
// ============================================================

export const todos = pgTable(
  "todos",
  {
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
    recurrenceRuleId: uuid("recurrence_rule_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { mode: "date" }),
  },
  (todo) => ({
    userIdIdx: index("todos_user_id_idx").on(todo.userId),
    userStatusIdx: index("todos_user_status_idx").on(todo.userId, todo.status),
    dueAtIdx: index("todos_due_at_idx").on(todo.dueAt),
  })
);

export const todoChecklistItems = pgTable(
  "todo_checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    todoId: uuid("todo_id")
      .notNull()
      .references(() => todos.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isCompleted: boolean("is_completed").default(false),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (item) => ({
    todoIdIdx: index("todo_checklist_items_todo_id_idx").on(item.todoId),
  })
);

// ============================================================
// Financial Items (Recurring Bills & Subscriptions)
// ============================================================

export const financialItems = pgTable(
  "financial_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: financialItemTypeEnum("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
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
    recurrenceRuleId: uuid("recurrence_rule_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (item) => ({
    userIdIdx: index("financial_items_user_id_idx").on(item.userId),
    userStatusIdx: index("financial_items_user_status_idx").on(
      item.userId,
      item.status
    ),
    typeIdx: index("financial_items_type_idx").on(item.type),
  })
);

export const financialOccurrences = pgTable(
  "financial_occurrences",
  {
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
    status: financialOccurrenceStatusEnum("status")
      .default("UPCOMING")
      .notNull(),
    paidAt: timestamp("paid_at", { mode: "date" }),
    creditCardTransactionId: uuid("credit_card_transaction_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (occ) => ({
    financialItemIdIdx: index("financial_occurrences_item_id_idx").on(
      occ.financialItemId
    ),
    dueDateIdx: index("financial_occurrences_due_date_idx").on(occ.dueDate),
    statusIdx: index("financial_occurrences_status_idx").on(occ.status),
  })
);

// ============================================================
// Credit Cards
// ============================================================

export const creditCards = pgTable(
  "credit_cards",
  {
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
  },
  (card) => ({
    userIdIdx: index("credit_cards_user_id_idx").on(card.userId),
    userStatusIdx: index("credit_cards_user_status_idx").on(
      card.userId,
      card.status
    ),
  })
);

export const creditCardStatements = pgTable(
  "credit_card_statements",
  {
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
  },
  (statement) => ({
    creditCardIdIdx: index("credit_card_statements_card_id_idx").on(
      statement.creditCardId
    ),
    statusIdx: index("credit_card_statements_status_idx").on(statement.status),
  })
);

export const creditCardTransactions = pgTable(
  "credit_card_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creditCardId: uuid("credit_card_id")
      .notNull()
      .references(() => creditCards.id, { onDelete: "cascade" }),
    statementId: uuid("statement_id").references(() => creditCardStatements.id),
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
  },
  (txn) => ({
    creditCardIdIdx: index("credit_card_transactions_card_id_idx").on(
      txn.creditCardId
    ),
    statementIdIdx: index("credit_card_transactions_statement_id_idx").on(
      txn.statementId
    ),
    transactionDateIdx: index("credit_card_transactions_date_idx").on(
      txn.transactionDate
    ),
  })
);

// ============================================================
// Notes
// ============================================================

export const notes = pgTable(
  "notes",
  {
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
  },
  (note) => ({
    userIdIdx: index("notes_user_id_idx").on(note.userId),
    archivedAtIdx: index("notes_archived_at_idx").on(note.archivedAt),
  })
);

// ============================================================
// Strava integration
// ============================================================

export const stravaConnectionStatusEnum = pgEnum("strava_connection_status", [
  "PENDING",
  "CONNECTED",
  "EXPIRED",
  "REVOKED",
  "ERROR",
]);

export const stravaSyncJobTypeEnum = pgEnum("strava_sync_job_type", [
  "BACKFILL",
  "INCREMENTAL",
  "RECONCILE",
  "SINGLE_ACTIVITY",
]);

export const stravaSyncJobStatusEnum = pgEnum("strava_sync_job_status", [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export const stravaWebhookEventStatusEnum = pgEnum(
  "strava_webhook_event_status",
  ["RECEIVED", "PROCESSING", "PROCESSED", "IGNORED", "FAILED"]
);

export const stravaConnections = pgTable(
  "strava_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stravaAthleteId: bigint("strava_athlete_id", { mode: "number" }).notNull(),
    status: stravaConnectionStatusEnum("status")
      .default("PENDING")
      .notNull(),
    scopes: text("scopes"),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenType: text("token_type"),
    tokenExpiresAt: timestamp("token_expires_at", { mode: "date" }),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
    lastError: text("last_error"),
    disconnectedAt: timestamp("disconnected_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (conn) => ({
    userIdx: uniqueIndex("strava_connections_user_id_idx").on(conn.userId),
    stravaAthleteIdx: uniqueIndex(
      "strava_connections_strava_athlete_id_idx"
    ).on(conn.stravaAthleteId),
    statusIdx: index("strava_connections_status_idx").on(conn.status),
  })
);

export const stravaAthletes = pgTable(
  "strava_athletes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => stravaConnections.id, { onDelete: "cascade" }),
    stravaAthleteId: bigint("strava_athlete_id", { mode: "number" }).notNull(),
    username: text("username"),
    firstname: text("firstname"),
    lastname: text("lastname"),
    bio: text("bio"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    sex: text("sex"),
    weight: real("weight"),
    profile: text("profile"),
    profileMedium: text("profile_medium"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (athlete) => ({
    stravaAthleteIdx: uniqueIndex("strava_athletes_strava_athlete_id_idx").on(
      athlete.stravaAthleteId
    ),
    connectionIdx: index("strava_athletes_connection_id_idx").on(
      athlete.connectionId
    ),
  })
);

export const stravaActivities = pgTable(
  "strava_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => stravaConnections.id, { onDelete: "cascade" }),
    athleteId: uuid("athlete_id").references(() => stravaAthletes.id),
    stravaActivityId: bigint("strava_activity_id", {
      mode: "number",
    }).notNull(),
    name: text("name").notNull(),
    sportType: text("sport_type"),
    type: text("type"),
    startDate: timestamp("start_date", { mode: "date" }),
    startDateLocal: text("start_date_local"),
    timezone: text("timezone"),
    distance: real("distance"),
    movingTime: integer("moving_time"),
    elapsedTime: integer("elapsed_time"),
    totalElevationGain: real("total_elevation_gain"),
    averageSpeed: real("average_speed"),
    maxSpeed: real("max_speed"),
    averageHeartrate: real("average_heartrate"),
    maxHeartrate: real("max_heartrate"),
    averageWatts: real("average_watts"),
    maxWatts: real("max_watts"),
    weightedAverageWatts: real("weighted_average_watts"),
    kilojoules: real("kilojoules"),
    deviceWatts: boolean("device_watts"),
    calories: real("calories"),
    averageCadence: real("average_cadence"),
    prCount: integer("pr_count"),
    kudosCount: integer("kudos_count"),
    commentCount: integer("comment_count"),
    achievementCount: integer("achievement_count"),
    commute: boolean("commute"),
    trainer: boolean("trainer"),
    manual: boolean("manual"),
    private: boolean("private"),
    visibility: text("visibility"),
    gearId: text("gear_id"),
    externalId: text("external_id"),
    summaryPolyline: text("summary_polyline"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (activity) => ({
    stravaActivityIdx: uniqueIndex(
      "strava_activities_strava_activity_id_idx"
    ).on(activity.stravaActivityId),
    connectionIdx: index("strava_activities_connection_id_idx").on(
      activity.connectionId
    ),
    athleteIdx: index("strava_activities_athlete_id_idx").on(
      activity.athleteId
    ),
    startDateIdx: index("strava_activities_start_date_idx").on(
      activity.startDate
    ),
    sportTypeIdx: index("strava_activities_sport_type_idx").on(
      activity.sportType
    ),
  })
);

export const stravaActivityStreams = pgTable(
  "strava_activity_streams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => stravaActivities.id, { onDelete: "cascade" }),
    streamType: text("stream_type").notNull(),
    data: jsonb("data"),
    seriesType: text("series_type"),
    originalSize: integer("original_size"),
    resolution: text("resolution"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (stream) => ({
    activityTypeIdx: uniqueIndex(
      "strava_activity_streams_activity_type_idx"
    ).on(stream.activityId, stream.streamType),
    activityIdx: index("strava_activity_streams_activity_id_idx").on(
      stream.activityId
    ),
  })
);

export const stravaWebhookEvents = pgTable(
  "strava_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventKey: text("event_key").notNull(),
    objectType: text("object_type"),
    objectId: bigint("object_id", { mode: "number" }),
    aspectType: text("aspect_type"),
    ownerResourceId: bigint("owner_resource_id", { mode: "number" }),
    subscriptionId: integer("subscription_id"),
    updates: jsonb("updates"),
    eventTime: timestamp("event_time", { mode: "date" }),
    status: stravaWebhookEventStatusEnum("status")
      .default("RECEIVED")
      .notNull(),
    processedAt: timestamp("processed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (event) => ({
    eventKeyIdx: uniqueIndex("strava_webhook_events_event_key_idx").on(
      event.eventKey
    ),
    statusIdx: index("strava_webhook_events_status_idx").on(event.status),
    ownerIdx: index("strava_webhook_events_owner_id_idx").on(
      event.ownerResourceId
    ),
  })
);

export const stravaSyncJobs = pgTable(
  "strava_sync_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => stravaConnections.id, { onDelete: "cascade" }),
    type: stravaSyncJobTypeEnum("type").notNull(),
    status: stravaSyncJobStatusEnum("status").default("QUEUED").notNull(),
    trigger: text("trigger"),
    startedAt: timestamp("started_at", { mode: "date" }),
    finishedAt: timestamp("finished_at", { mode: "date" }),
    activitiesProcessed: integer("activities_processed").default(0),
    error: text("error"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (job) => ({
    connectionIdx: index("strava_sync_jobs_connection_id_idx").on(
      job.connectionId
    ),
    statusIdx: index("strava_sync_jobs_status_idx").on(job.status),
    createdAtIdx: index("strava_sync_jobs_created_at_idx").on(job.createdAt),
  })
);

// ============================================================
// Apple Health integration
// ============================================================

export const appleHealthConnectionStatusEnum = pgEnum(
  "apple_health_connection_status",
  ["PENDING", "CONNECTED", "ERROR"]
);

export const appleHealthImportJobStatusEnum = pgEnum(
  "apple_health_import_job_status",
  ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]
);

export const appleHealthConnections = pgTable(
  "apple_health_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: appleHealthConnectionStatusEnum("status")
      .default("PENDING")
      .notNull(),
    deviceName: text("device_name"),
    exportDate: timestamp("export_date", { mode: "date" }),
    lastImportedAt: timestamp("last_imported_at", { mode: "date" }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (conn) => ({
    userIdx: uniqueIndex("apple_health_connections_user_id_idx").on(
      conn.userId
    ),
    statusIdx: index("apple_health_connections_status_idx").on(conn.status),
  })
);

export const appleHealthImportJobs = pgTable(
  "apple_health_import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => appleHealthConnections.id, { onDelete: "cascade" }),
    status: appleHealthImportJobStatusEnum("status")
      .default("QUEUED")
      .notNull(),
    trigger: text("trigger"),
    startedAt: timestamp("started_at", { mode: "date" }),
    finishedAt: timestamp("finished_at", { mode: "date" }),
    workoutsInserted: integer("workouts_inserted").default(0),
    samplesInserted: integer("samples_inserted").default(0),
    streamsInserted: integer("streams_inserted").default(0),
    duplicatesSkipped: integer("duplicates_skipped").default(0),
    error: text("error"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (job) => ({
    connectionIdx: index("apple_health_import_jobs_connection_id_idx").on(
      job.connectionId
    ),
    statusIdx: index("apple_health_import_jobs_status_idx").on(job.status),
    createdAtIdx: index("apple_health_import_jobs_created_at_idx").on(
      job.createdAt
    ),
  })
);

export const appleHealthWorkouts = pgTable(
  "apple_health_workouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => appleHealthConnections.id, { onDelete: "cascade" }),
    dedupKey: text("dedup_key").notNull(),
    activityType: text("activity_type").notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    duration: real("duration"),
    durationUnit: text("duration_unit"),
    totalDistance: real("total_distance"),
    distanceUnit: text("distance_unit"),
    totalEnergyBurned: real("total_energy_burned"),
    energyUnit: text("energy_unit"),
    sourceName: text("source_name"),
    sourceVersion: text("source_version"),
    deviceName: text("device_name"),
    creationDate: timestamp("creation_date", { mode: "date" }),
    metadata: jsonb("metadata"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (workout) => ({
    dedupKeyIdx: uniqueIndex("apple_health_workouts_dedup_key_idx").on(
      workout.dedupKey
    ),
    connectionIdx: index("apple_health_workouts_connection_id_idx").on(
      workout.connectionId
    ),
    startDateIdx: index("apple_health_workouts_start_date_idx").on(
      workout.startDate
    ),
    activityTypeIdx: index("apple_health_workouts_activity_type_idx").on(
      workout.activityType
    ),
  })
);

export const appleHealthSamples = pgTable(
  "apple_health_samples",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => appleHealthConnections.id, { onDelete: "cascade" }),
    dedupKey: text("dedup_key").notNull(),
    recordType: text("record_type").notNull(),
    startDate: timestamp("start_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    value: real("value"),
    unit: text("unit"),
    sourceName: text("source_name"),
    sourceVersion: text("source_version"),
    deviceName: text("device_name"),
    creationDate: timestamp("creation_date", { mode: "date" }),
    metadata: jsonb("metadata"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (sample) => ({
    dedupKeyIdx: uniqueIndex("apple_health_samples_dedup_key_idx").on(
      sample.dedupKey
    ),
    connectionIdx: index("apple_health_samples_connection_id_idx").on(
      sample.connectionId
    ),
    recordTypeIdx: index("apple_health_samples_record_type_idx").on(
      sample.recordType
    ),
    startDateIdx: index("apple_health_samples_start_date_idx").on(
      sample.startDate
    ),
  })
);

export const appleHealthWorkoutStreams = pgTable(
  "apple_health_workout_streams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => appleHealthWorkouts.id, { onDelete: "cascade" }),
    streamType: text("stream_type").notNull(),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (stream) => ({
    workoutTypeIdx: uniqueIndex(
      "apple_health_workout_streams_workout_type_idx"
    ).on(stream.workoutId, stream.streamType),
    workoutIdx: index("apple_health_workout_streams_workout_id_idx").on(
      stream.workoutId
    ),
  })
);
