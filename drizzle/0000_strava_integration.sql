CREATE TYPE "public"."billing_cycle" AS ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."credit_card_status" AS ENUM('ACTIVE', 'INACTIVE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."financial_item_type" AS ENUM('RECURRING_BILL', 'SUBSCRIPTION');--> statement-breakpoint
CREATE TYPE "public"."financial_occurrence_status" AS ENUM('UPCOMING', 'DUE', 'PAID', 'SKIPPED', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."note_type" AS ENUM('GENERAL', 'FINANCE', 'IDEA', 'REFERENCE', 'MEETING');--> statement-breakpoint
CREATE TYPE "public"."recurrence_frequency" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('PENDING', 'SENT', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."statement_status" AS ENUM('OPEN', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."strava_connection_status" AS ENUM('PENDING', 'CONNECTED', 'EXPIRED', 'REVOKED', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."strava_sync_job_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."strava_sync_job_type" AS ENUM('BACKFILL', 'INCREMENTAL', 'RECONCILE', 'SINGLE_ACTIVITY');--> statement-breakpoint
CREATE TYPE "public"."strava_webhook_event_status" AS ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."todo_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."todo_status" AS ENUM('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "credit_card_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_card_id" uuid NOT NULL,
	"statement_period_start" timestamp NOT NULL,
	"statement_period_end" timestamp NOT NULL,
	"statement_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"minimum_payment" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2),
	"status" "statement_status" DEFAULT 'OPEN' NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_card_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_card_id" uuid NOT NULL,
	"statement_id" uuid,
	"transaction_date" timestamp NOT NULL,
	"merchant" text NOT NULL,
	"description" text,
	"amount" numeric(12, 2) NOT NULL,
	"category" text,
	"installment_number" integer,
	"installment_total" integer,
	"financial_item_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"bank_name" text NOT NULL,
	"last_four_digits" text NOT NULL,
	"credit_limit" numeric(12, 2),
	"statement_day" integer NOT NULL,
	"payment_due_day" integer NOT NULL,
	"status" "credit_card_status" DEFAULT 'ACTIVE' NOT NULL,
	"color" text DEFAULT '#6366f1',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "financial_item_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo_url" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'THB',
	"billing_cycle" "billing_cycle" NOT NULL,
	"billing_day" integer,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"payment_method_id" uuid,
	"auto_renew" boolean DEFAULT false,
	"is_variable_amount" boolean DEFAULT false,
	"status" text DEFAULT 'ACTIVE',
	"recurrence_rule_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"financial_item_id" uuid NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"expected_amount" numeric(12, 2) NOT NULL,
	"actual_amount" numeric(12, 2),
	"status" "financial_occurrence_status" DEFAULT 'UPCOMING' NOT NULL,
	"paid_at" timestamp,
	"credit_card_transaction_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"note_type" "note_type" DEFAULT 'GENERAL' NOT NULL,
	"is_pinned" boolean DEFAULT false,
	"is_favorite" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"details" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurrence_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"frequency" "recurrence_frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"days_of_week" text,
	"day_of_month" integer,
	"month_of_year" integer,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"next_run_at" timestamp,
	"timezone" text DEFAULT 'UTC',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"remind_at" timestamp NOT NULL,
	"status" "reminder_status" DEFAULT 'PENDING' NOT NULL,
	"type" text DEFAULT 'IN_APP',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"athlete_id" uuid,
	"strava_activity_id" bigint NOT NULL,
	"name" text NOT NULL,
	"sport_type" text,
	"type" text,
	"start_date" timestamp,
	"start_date_local" text,
	"timezone" text,
	"distance" real,
	"moving_time" integer,
	"elapsed_time" integer,
	"total_elevation_gain" real,
	"average_speed" real,
	"max_speed" real,
	"average_heartrate" real,
	"max_heartrate" real,
	"average_watts" real,
	"max_watts" real,
	"weighted_average_watts" real,
	"kilojoules" real,
	"device_watts" boolean,
	"calories" real,
	"average_cadence" real,
	"pr_count" integer,
	"kudos_count" integer,
	"comment_count" integer,
	"achievement_count" integer,
	"commute" boolean,
	"trainer" boolean,
	"manual" boolean,
	"private" boolean,
	"visibility" text,
	"gear_id" text,
	"external_id" text,
	"summary_polyline" text,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_activity_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"stream_type" text NOT NULL,
	"data" jsonb,
	"series_type" text,
	"original_size" integer,
	"resolution" text,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_athletes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"strava_athlete_id" bigint NOT NULL,
	"username" text,
	"firstname" text,
	"lastname" text,
	"bio" text,
	"city" text,
	"state" text,
	"country" text,
	"sex" text,
	"weight" real,
	"profile" text,
	"profile_medium" text,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"strava_athlete_id" bigint NOT NULL,
	"status" "strava_connection_status" DEFAULT 'PENDING' NOT NULL,
	"scopes" text,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_type" text,
	"token_expires_at" timestamp,
	"last_synced_at" timestamp,
	"last_error" text,
	"disconnected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"type" "strava_sync_job_type" NOT NULL,
	"status" "strava_sync_job_status" DEFAULT 'QUEUED' NOT NULL,
	"trigger" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"activities_processed" integer DEFAULT 0,
	"error" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"object_type" text,
	"object_id" bigint,
	"aspect_type" text,
	"owner_resource_id" bigint,
	"subscription_id" integer,
	"updates" jsonb,
	"event_time" timestamp,
	"status" "strava_webhook_event_status" DEFAULT 'RECEIVED' NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todo_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"todo_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_completed" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "todo_status" DEFAULT 'TODO' NOT NULL,
	"priority" "todo_priority" DEFAULT 'MEDIUM' NOT NULL,
	"due_at" timestamp,
	"completed_at" timestamp,
	"is_recurring" boolean DEFAULT false,
	"recurrence_rule_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"password_hash" text
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_statements" ADD CONSTRAINT "credit_card_statements_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_transactions" ADD CONSTRAINT "credit_card_transactions_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_transactions" ADD CONSTRAINT "credit_card_transactions_statement_id_credit_card_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."credit_card_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_transactions" ADD CONSTRAINT "credit_card_transactions_financial_item_id_financial_items_id_fk" FOREIGN KEY ("financial_item_id") REFERENCES "public"."financial_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_items" ADD CONSTRAINT "financial_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_items" ADD CONSTRAINT "financial_items_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_occurrences" ADD CONSTRAINT "financial_occurrences_financial_item_id_financial_items_id_fk" FOREIGN KEY ("financial_item_id") REFERENCES "public"."financial_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD CONSTRAINT "strava_activities_connection_id_strava_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."strava_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activities" ADD CONSTRAINT "strava_activities_athlete_id_strava_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."strava_athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_activity_streams" ADD CONSTRAINT "strava_activity_streams_activity_id_strava_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."strava_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_athletes" ADD CONSTRAINT "strava_athletes_connection_id_strava_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."strava_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_connections" ADD CONSTRAINT "strava_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_sync_jobs" ADD CONSTRAINT "strava_sync_jobs_connection_id_strava_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."strava_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo_checklist_items" ADD CONSTRAINT "todo_checklist_items_todo_id_todos_id_fk" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "credit_card_statements_card_id_idx" ON "credit_card_statements" USING btree ("credit_card_id");--> statement-breakpoint
CREATE INDEX "credit_card_statements_status_idx" ON "credit_card_statements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_card_transactions_card_id_idx" ON "credit_card_transactions" USING btree ("credit_card_id");--> statement-breakpoint
CREATE INDEX "credit_card_transactions_statement_id_idx" ON "credit_card_transactions" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "credit_card_transactions_date_idx" ON "credit_card_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "credit_cards_user_id_idx" ON "credit_cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_cards_user_status_idx" ON "credit_cards" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "financial_items_user_id_idx" ON "financial_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "financial_items_user_status_idx" ON "financial_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "financial_items_type_idx" ON "financial_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "financial_occurrences_item_id_idx" ON "financial_occurrences" USING btree ("financial_item_id");--> statement-breakpoint
CREATE INDEX "financial_occurrences_due_date_idx" ON "financial_occurrences" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "financial_occurrences_status_idx" ON "financial_occurrences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notes_user_id_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_archived_at_idx" ON "notes" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_methods_user_id_idx" ON "payment_methods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reminders_user_id_idx" ON "reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reminders_status_idx" ON "reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reminders_remind_at_idx" ON "reminders" USING btree ("remind_at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "strava_activities_strava_activity_id_idx" ON "strava_activities" USING btree ("strava_activity_id");--> statement-breakpoint
CREATE INDEX "strava_activities_connection_id_idx" ON "strava_activities" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "strava_activities_athlete_id_idx" ON "strava_activities" USING btree ("athlete_id");--> statement-breakpoint
CREATE INDEX "strava_activities_start_date_idx" ON "strava_activities" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "strava_activities_sport_type_idx" ON "strava_activities" USING btree ("sport_type");--> statement-breakpoint
CREATE UNIQUE INDEX "strava_activity_streams_activity_type_idx" ON "strava_activity_streams" USING btree ("activity_id","stream_type");--> statement-breakpoint
CREATE INDEX "strava_activity_streams_activity_id_idx" ON "strava_activity_streams" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strava_athletes_strava_athlete_id_idx" ON "strava_athletes" USING btree ("strava_athlete_id");--> statement-breakpoint
CREATE INDEX "strava_athletes_connection_id_idx" ON "strava_athletes" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strava_connections_user_id_idx" ON "strava_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strava_connections_strava_athlete_id_idx" ON "strava_connections" USING btree ("strava_athlete_id");--> statement-breakpoint
CREATE INDEX "strava_connections_status_idx" ON "strava_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "strava_sync_jobs_connection_id_idx" ON "strava_sync_jobs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "strava_sync_jobs_status_idx" ON "strava_sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "strava_sync_jobs_created_at_idx" ON "strava_sync_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "strava_webhook_events_event_key_idx" ON "strava_webhook_events" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "strava_webhook_events_status_idx" ON "strava_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "strava_webhook_events_owner_id_idx" ON "strava_webhook_events" USING btree ("owner_resource_id");--> statement-breakpoint
CREATE INDEX "todo_checklist_items_todo_id_idx" ON "todo_checklist_items" USING btree ("todo_id");--> statement-breakpoint
CREATE INDEX "todos_user_id_idx" ON "todos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "todos_user_status_idx" ON "todos" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "todos_due_at_idx" ON "todos" USING btree ("due_at");