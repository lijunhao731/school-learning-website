import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  real,
  jsonb,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ────────────────────────────────────────────────────────────────────────────
// Table 1: users
// ────────────────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 20 }).default("student"), // student | teacher | admin
    name: varchar("name", { length: 100 }),
    grade: integer("grade"), // 1-9 (小学1年级 ~ 初中3年级)
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    usernameIdx: index("users_username_idx").on(t.username),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// Table 2: knowledge_points  (ltree hierarchy stored in ltree_path)
// ────────────────────────────────────────────────────────────────────────────
export const knowledgePoints = pgTable(
  "knowledge_points",
  {
    id: serial("id").primaryKey(),
    subject: varchar("subject", { length: 50 }).default("math"),
    gradeLevel: integer("grade_level"),
    chapter: varchar("chapter", { length: 200 }),
    title: varchar("title", { length: 500 }).notNull(),
    ltreePath: text("ltree_path"), // ltree label path e.g. "1.2.3"
    parentId: integer("parent_id").references(
      (): AnyPgColumn => knowledgePoints.id
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    parentIdIdx: index("knowledge_points_parent_id_idx").on(t.parentId),
    subjectIdx: index("knowledge_points_subject_idx").on(t.subject),
    gradeLevelIdx: index("knowledge_points_grade_level_idx").on(t.gradeLevel),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// Table 3: knowledge_associations  (insert bidirectionally: A→B AND B→A)
// ────────────────────────────────────────────────────────────────────────────
export const knowledgeAssociations = pgTable(
  "knowledge_associations",
  {
    id: serial("id").primaryKey(),
    kpId1: integer("kp_id_1")
      .notNull()
      .references(() => knowledgePoints.id),
    kpId2: integer("kp_id_2")
      .notNull()
      .references(() => knowledgePoints.id),
    associationType: varchar("association_type", { length: 50 }), // prerequisite | related | extends
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    kpId1Idx: index("knowledge_associations_kp_id_1_idx").on(t.kpId1),
    kpId2Idx: index("knowledge_associations_kp_id_2_idx").on(t.kpId2),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// Table 4: mistakes
// ────────────────────────────────────────────────────────────────────────────
export const mistakes = pgTable(
  "mistakes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    kpId: integer("kp_id").references(() => knowledgePoints.id),
    imageUrl: text("image_url"),
    ocrText: text("ocr_text"),
    questionText: text("question_text"),
    studentAnswer: text("student_answer"),
    correctAnswer: text("correct_answer"),
    errorCause: jsonb("error_cause"), // { type, description }
    solutionApproach: jsonb("solution_approach"), // [{ step, explanation }]
    relatedKpIds: jsonb("related_kp_ids"), // string[]
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdIdx: index("mistakes_user_id_idx").on(t.userId),
    kpIdIdx: index("mistakes_kp_id_idx").on(t.kpId),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// Table 5: review_items  (FSRS scheduling state)
// ────────────────────────────────────────────────────────────────────────────
export const reviewItems = pgTable(
  "review_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    kpId: integer("kp_id")
      .notNull()
      .references(() => knowledgePoints.id),
    state: varchar("state", { length: 20 }).default("new"), // new | learning | review | relearning | mastered
    stability: real("stability").default(0),
    difficulty: real("difficulty").default(0),
    dueDate: timestamp("due_date", { withTimezone: true }),
    interval: integer("interval").default(0), // days
    lapses: integer("lapses").default(0),
    reps: integer("reps").default(0),
    consecutiveCorrect: integer("consecutive_correct").default(0),
    lastReview: timestamp("last_review", { withTimezone: true }),
    desiredRetention: real("desired_retention").default(0.9),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdIdx: index("review_items_user_id_idx").on(t.userId),
    kpIdIdx: index("review_items_kp_id_idx").on(t.kpId),
    dueDateIdx: index("review_items_due_date_idx").on(t.dueDate),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// Table 6: review_logs
// ────────────────────────────────────────────────────────────────────────────
export const reviewLogs = pgTable(
  "review_logs",
  {
    id: serial("id").primaryKey(),
    reviewItemId: integer("review_item_id")
      .notNull()
      .references(() => reviewItems.id),
    rating: varchar("rating", { length: 20 }), // again | hard | good | easy
    state: varchar("state", { length: 20 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow(),
    due: timestamp("due", { withTimezone: true }),
    stability: real("stability"),
    difficulty: real("difficulty"),
    interval: integer("interval"),
    correct: boolean("correct"),
  },
  (t) => ({
    reviewItemIdIdx: index("review_logs_review_item_id_idx").on(t.reviewItemId),
    reviewedAtIdx: index("review_logs_reviewed_at_idx").on(t.reviewedAt),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// Table 7: quiz_attempts
// ────────────────────────────────────────────────────────────────────────────
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: serial("id").primaryKey(),
    reviewItemId: integer("review_item_id").references(() => reviewItems.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    kpId: integer("kp_id").references(() => knowledgePoints.id),
    quizData: jsonb("quiz_data"), // LLM-generated questions
    correctCount: integer("correct_count").default(0),
    allCorrect: boolean("all_correct").default(false),
    generatedFrom: text("generated_from"), // 'similar' | 'mastery'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    reviewItemIdIdx: index("quiz_attempts_review_item_id_idx").on(t.reviewItemId),
    userIdIdx: index("quiz_attempts_user_id_idx").on(t.userId),
    kpIdIdx: index("quiz_attempts_kp_id_idx").on(t.kpId),
  })
);

// ────────────────────────────────────────────────────────────────────────────
// Table 8: content_cache  (LLM content cache, separate from knowledge_points)
// ────────────────────────────────────────────────────────────────────────────
export const contentCache = pgTable(
  "content_cache",
  {
    id: serial("id").primaryKey(),
    kpId: integer("kp_id")
      .notNull()
      .references(() => knowledgePoints.id),
    contentType: varchar("content_type", { length: 20 }), // intro | detail | examples | practice
    content: jsonb("content"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => ({
    kpIdIdx: index("content_cache_kp_id_idx").on(t.kpId),
    expiresAtIdx: index("content_cache_expires_at_idx").on(t.expiresAt),
  })
);
