CREATE TYPE "public"."apple_health_connection_status" AS ENUM('PENDING', 'CONNECTED', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."apple_health_import_job_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "apple_health_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" "apple_health_connection_status" DEFAULT 'PENDING' NOT NULL,
	"device_name" text,
	"export_date" timestamp,
	"last_imported_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apple_health_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"status" "apple_health_import_job_status" DEFAULT 'QUEUED' NOT NULL,
	"trigger" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"workouts_inserted" integer DEFAULT 0,
	"samples_inserted" integer DEFAULT 0,
	"streams_inserted" integer DEFAULT 0,
	"duplicates_skipped" integer DEFAULT 0,
	"error" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apple_health_workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"dedup_key" text NOT NULL,
	"activity_type" text NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"duration" real,
	"duration_unit" text,
	"total_distance" real,
	"distance_unit" text,
	"total_energy_burned" real,
	"energy_unit" text,
	"source_name" text,
	"source_version" text,
	"device_name" text,
	"creation_date" timestamp,
	"metadata" jsonb,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apple_health_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"dedup_key" text NOT NULL,
	"record_type" text NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"value" real,
	"unit" text,
	"source_name" text,
	"source_version" text,
	"device_name" text,
	"creation_date" timestamp,
	"metadata" jsonb,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apple_health_workout_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"stream_type" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apple_health_connections" ADD CONSTRAINT "apple_health_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apple_health_import_jobs" ADD CONSTRAINT "apple_health_import_jobs_connection_id_apple_health_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."apple_health_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apple_health_workouts" ADD CONSTRAINT "apple_health_workouts_connection_id_apple_health_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."apple_health_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apple_health_samples" ADD CONSTRAINT "apple_health_samples_connection_id_apple_health_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."apple_health_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apple_health_workout_streams" ADD CONSTRAINT "apple_health_workout_streams_workout_id_apple_health_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."apple_health_workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apple_health_connections_user_id_idx" ON "apple_health_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apple_health_connections_status_idx" ON "apple_health_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "apple_health_import_jobs_connection_id_idx" ON "apple_health_import_jobs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "apple_health_import_jobs_status_idx" ON "apple_health_import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "apple_health_import_jobs_created_at_idx" ON "apple_health_import_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "apple_health_workouts_dedup_key_idx" ON "apple_health_workouts" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "apple_health_workouts_connection_id_idx" ON "apple_health_workouts" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "apple_health_workouts_start_date_idx" ON "apple_health_workouts" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "apple_health_workouts_activity_type_idx" ON "apple_health_workouts" USING btree ("activity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "apple_health_samples_dedup_key_idx" ON "apple_health_samples" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "apple_health_samples_connection_id_idx" ON "apple_health_samples" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "apple_health_samples_record_type_idx" ON "apple_health_samples" USING btree ("record_type");--> statement-breakpoint
CREATE INDEX "apple_health_samples_start_date_idx" ON "apple_health_samples" USING btree ("start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "apple_health_workout_streams_workout_type_idx" ON "apple_health_workout_streams" USING btree ("workout_id","stream_type");--> statement-breakpoint
CREATE INDEX "apple_health_workout_streams_workout_id_idx" ON "apple_health_workout_streams" USING btree ("workout_id");
