-- Enable ltree extension (required for hierarchical knowledge-point paths)
CREATE EXTENSION IF NOT EXISTS ltree;--> statement-breakpoint
CREATE TABLE "content_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"kp_id" integer NOT NULL,
	"content_type" varchar(20),
	"content" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_associations" (
	"id" serial PRIMARY KEY NOT NULL,
	"kp_id_1" integer NOT NULL,
	"kp_id_2" integer NOT NULL,
	"association_type" varchar(50),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" varchar(50) DEFAULT 'math',
	"grade_level" integer,
	"chapter" varchar(200),
	"title" varchar(500) NOT NULL,
	"ltree_path" text,
	"parent_id" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mistakes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kp_id" integer,
	"image_url" text,
	"ocr_text" text,
	"question_text" text,
	"student_answer" text,
	"correct_answer" text,
	"error_cause" jsonb,
	"solution_approach" jsonb,
	"related_kp_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_item_id" integer,
	"user_id" integer NOT NULL,
	"kp_id" integer,
	"quiz_data" jsonb,
	"correct_count" integer DEFAULT 0,
	"all_correct" boolean DEFAULT false,
	"generated_from" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kp_id" integer NOT NULL,
	"state" varchar(20) DEFAULT 'new',
	"stability" real DEFAULT 0,
	"difficulty" real DEFAULT 0,
	"due_date" timestamp with time zone,
	"interval" integer DEFAULT 0,
	"lapses" integer DEFAULT 0,
	"reps" integer DEFAULT 0,
	"consecutive_correct" integer DEFAULT 0,
	"last_review" timestamp with time zone,
	"desired_retention" real DEFAULT 0.9,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_item_id" integer NOT NULL,
	"rating" varchar(20),
	"state" varchar(20),
	"reviewed_at" timestamp with time zone DEFAULT now(),
	"due" timestamp with time zone,
	"stability" real,
	"difficulty" real,
	"interval" integer,
	"correct" boolean
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) DEFAULT 'student',
	"name" varchar(100),
	"grade" integer,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "content_cache" ADD CONSTRAINT "content_cache_kp_id_knowledge_points_id_fk" FOREIGN KEY ("kp_id") REFERENCES "public"."knowledge_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_associations" ADD CONSTRAINT "knowledge_associations_kp_id_1_knowledge_points_id_fk" FOREIGN KEY ("kp_id_1") REFERENCES "public"."knowledge_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_associations" ADD CONSTRAINT "knowledge_associations_kp_id_2_knowledge_points_id_fk" FOREIGN KEY ("kp_id_2") REFERENCES "public"."knowledge_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_points" ADD CONSTRAINT "knowledge_points_parent_id_knowledge_points_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."knowledge_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_kp_id_knowledge_points_id_fk" FOREIGN KEY ("kp_id") REFERENCES "public"."knowledge_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_review_item_id_review_items_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_kp_id_knowledge_points_id_fk" FOREIGN KEY ("kp_id") REFERENCES "public"."knowledge_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_kp_id_knowledge_points_id_fk" FOREIGN KEY ("kp_id") REFERENCES "public"."knowledge_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_review_item_id_review_items_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "public"."review_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_cache_kp_id_idx" ON "content_cache" USING btree ("kp_id");--> statement-breakpoint
CREATE INDEX "content_cache_expires_at_idx" ON "content_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "knowledge_associations_kp_id_1_idx" ON "knowledge_associations" USING btree ("kp_id_1");--> statement-breakpoint
CREATE INDEX "knowledge_associations_kp_id_2_idx" ON "knowledge_associations" USING btree ("kp_id_2");--> statement-breakpoint
CREATE INDEX "knowledge_points_parent_id_idx" ON "knowledge_points" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "knowledge_points_subject_idx" ON "knowledge_points" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "knowledge_points_grade_level_idx" ON "knowledge_points" USING btree ("grade_level");--> statement-breakpoint
CREATE INDEX "mistakes_user_id_idx" ON "mistakes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mistakes_kp_id_idx" ON "mistakes" USING btree ("kp_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_review_item_id_idx" ON "quiz_attempts" USING btree ("review_item_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_id_idx" ON "quiz_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_kp_id_idx" ON "quiz_attempts" USING btree ("kp_id");--> statement-breakpoint
CREATE INDEX "review_items_user_id_idx" ON "review_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_items_kp_id_idx" ON "review_items" USING btree ("kp_id");--> statement-breakpoint
CREATE INDEX "review_items_due_date_idx" ON "review_items" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "review_logs_review_item_id_idx" ON "review_logs" USING btree ("review_item_id");--> statement-breakpoint
CREATE INDEX "review_logs_reviewed_at_idx" ON "review_logs" USING btree ("reviewed_at");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
-- GiST index on knowledge_points.ltree_path for ltree operators (<@, @>, ~, ?)
CREATE INDEX "knowledge_points_ltree_path_idx" ON "knowledge_points" USING GIST ("ltree_path");