CREATE TABLE "audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"action" text NOT NULL,
	"actor_id" varchar,
	"content_id" integer,
	"content_type" text,
	"changes" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"post_id" integer NOT NULL,
	"author_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_trending" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_trending_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content_id" integer NOT NULL,
	"content_type" text NOT NULL,
	"element_category" text NOT NULL,
	"trending_score" numeric(10, 2) DEFAULT '0',
	"view_count_24h" integer DEFAULT 0 NOT NULL,
	"engagement_count_24h" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "element_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "element_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text NOT NULL,
	"color_hex" varchar(7) NOT NULL,
	"icon_name" varchar(50) NOT NULL,
	CONSTRAINT "element_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "energy_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "energy_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"transaction_type" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_queue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "moderation_queue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content_id" integer NOT NULL,
	"content_type" text NOT NULL,
	"ai_flagged_reason" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oracles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "oracles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"reading_type" text NOT NULL,
	"content" text NOT NULL,
	"cards" jsonb,
	"chakra_focus" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"author_id" varchar NOT NULL,
	"content" text NOT NULL,
	"image_url" text,
	"chakra_type" text,
	"frequency_score" real,
	"spark_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"element_category" text,
	"upload_status" text DEFAULT 'Published',
	"safety_assessment" jsonb,
	"moderation_status" text DEFAULT 'auto_approved',
	"view_count" integer DEFAULT 0 NOT NULL,
	"engagement_score" integer DEFAULT 0,
	"positivity_score" integer
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"reporter_id" varchar NOT NULL,
	"post_id" integer,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sparks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sparks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"post_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"spark_type" text DEFAULT 'light' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_recommendations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_recommendations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"element_category" text NOT NULL,
	"recommended_content_ids" jsonb DEFAULT '[]'::jsonb,
	"recommendation_basis" text DEFAULT 'hybrid',
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "videos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" varchar(255) NOT NULL,
	"description" text,
	"upload_status" text DEFAULT 'Under Review' NOT NULL,
	"element_category" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"video_url" text,
	"duration_seconds" integer,
	"view_count" integer DEFAULT 0 NOT NULL,
	"ai_analysis_result" jsonb,
	"safety_assessment" jsonb,
	"moderation_status" text DEFAULT 'requires_review',
	"moderation_notes" text,
	"moderated_by" varchar,
	"moderated_at" timestamp,
	"positivity_score" integer
);
--> statement-breakpoint
CREATE TABLE "view_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "view_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" varchar NOT NULL,
	"content_id" integer NOT NULL,
	"content_type" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"username" text,
	"display_name" text,
	"bio" text,
	"aura_level" integer DEFAULT 1 NOT NULL,
	"energy_points" integer DEFAULT 100 NOT NULL,
	"dominant_chakra" text,
	"spiritual_path" text,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"spirit_name" text,
	"spirit_description" text,
	"spirit_image_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "energy_transactions" ADD CONSTRAINT "energy_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oracles" ADD CONSTRAINT "oracles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sparks" ADD CONSTRAINT "sparks_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sparks" ADD CONSTRAINT "sparks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recommendations" ADD CONSTRAINT "user_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_sessions" ADD CONSTRAINT "view_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_timestamp" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_content" ON "audit_log" USING btree ("content_id","content_type");--> statement-breakpoint
CREATE INDEX "idx_trending_element" ON "content_trending" USING btree ("element_category","trending_score");--> statement-breakpoint
CREATE INDEX "idx_moderation_status" ON "moderation_queue" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "idx_posts_element_status" ON "posts" USING btree ("element_category","upload_status");--> statement-breakpoint
CREATE INDEX "idx_posts_created_at" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_posts_moderation" ON "posts" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "idx_videos_element_status" ON "videos" USING btree ("element_category","upload_status");--> statement-breakpoint
CREATE INDEX "idx_videos_created_at" ON "videos" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_view_sessions_user" ON "view_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_view_sessions_active" ON "view_sessions" USING btree ("user_id","ended_at");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");