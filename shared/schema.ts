export * from "./models/auth";

import { pgTable, text, integer, timestamp, real, jsonb, varchar, bigint, decimal, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { users } from "./models/auth";
import type { ElementCategory, UploadStatus, ModerationStatus, ModerationPriority, ModerationQueueStatus, AuditAction, ContentType, RecommendationBasis } from "./types";

// ============================================
// Element Categories (immutable, 5 records)
// ============================================
export const elementCategories = pgTable("element_categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").$type<ElementCategory>().notNull().unique(),
  description: text("description").notNull(),
  colorHex: varchar("color_hex", { length: 7 }).notNull(),
  iconName: varchar("icon_name", { length: 50 }).notNull(),
});

// ============================================
// Videos table
// ============================================
export const videos = pgTable("videos", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  uploadStatus: text("upload_status").$type<UploadStatus>().notNull().default("Under Review"),
  elementCategory: text("element_category").$type<ElementCategory>().notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  videoUrl: text("video_url"),
  durationSeconds: integer("duration_seconds"),
  viewCount: integer("view_count").default(0).notNull(),
  aiAnalysisResult: jsonb("ai_analysis_result"),
  safetyAssessment: jsonb("safety_assessment"),
  moderationStatus: text("moderation_status").$type<ModerationStatus>().default("requires_review"),
  moderationNotes: text("moderation_notes"),
  moderatedBy: varchar("moderated_by").references(() => users.id),
  moderatedAt: timestamp("moderated_at"),
  positivityScore: integer("positivity_score"),
}, (table) => [
  index("idx_videos_element_status").on(table.elementCategory, table.uploadStatus),
  index("idx_videos_created_at").on(table.createdAt),
]);

// ============================================
// Content Trending table
// ============================================
export const contentTrending = pgTable("content_trending", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  contentId: integer("content_id").notNull(),
  contentType: text("content_type").$type<ContentType>().notNull(),
  elementCategory: text("element_category").$type<ElementCategory>().notNull(),
  trendingScore: decimal("trending_score", { precision: 10, scale: 2 }).default("0"),
  viewCount24h: integer("view_count_24h").default(0).notNull(),
  engagementCount24h: integer("engagement_count_24h").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_trending_element").on(table.elementCategory, table.trendingScore),
]);

// ============================================  
// User Recommendations table
// ============================================
export const userRecommendations = pgTable("user_recommendations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  elementCategory: text("element_category").$type<ElementCategory>().notNull(),
  recommendedContentIds: jsonb("recommended_content_ids").$type<number[]>().default([]),
  recommendationBasis: text("recommendation_basis").$type<RecommendationBasis>().default("hybrid"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// ============================================
// Moderation Queue table
// ============================================
export const moderationQueue = pgTable("moderation_queue", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  contentId: integer("content_id").notNull(),
  contentType: text("content_type").$type<ContentType>().notNull(),
  aiFlaggedReason: text("ai_flagged_reason"),
  priority: text("priority").$type<ModerationPriority>().default("normal").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status").$type<ModerationQueueStatus>().default("pending").notNull(),
}, (table) => [
  index("idx_moderation_status").on(table.status, table.priority),
]);

// ============================================
// Audit Log table
// ============================================
export const auditLog = pgTable("audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  action: text("action").$type<AuditAction>().notNull(),
  actorId: varchar("actor_id").references(() => users.id),
  contentId: integer("content_id"),
  contentType: text("content_type").$type<ContentType>(),
  changes: jsonb("changes"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_timestamp").on(table.timestamp),
  index("idx_audit_content").on(table.contentId, table.contentType),
]);

// ============================================
// View Sessions table (for Friends Watching)
// ============================================
export const viewSessions = pgTable("view_sessions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  contentId: integer("content_id").notNull(),
  contentType: text("content_type").$type<ContentType>().notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
}, (table) => [
  index("idx_view_sessions_user").on(table.userId),
  index("idx_view_sessions_active").on(table.userId, table.endedAt),
]);

export const chakraTypes = [
  "root",
  "sacral",
  "solar_plexus",
  "heart",
  "throat",
  "third_eye",
  "crown",
] as const;

export type ChakraType = (typeof chakraTypes)[number];

export const chakraColors: Record<ChakraType, string> = {
  root: "#EF4444",
  sacral: "#F97316",
  solar_plexus: "#EAB308",
  heart: "#22C55E",
  throat: "#3B82F6",
  third_eye: "#6366F1",
  crown: "#A855F7",
};

export const chakraLabels: Record<ChakraType, string> = {
  root: "Root",
  sacral: "Sacral",
  solar_plexus: "Solar Plexus",
  heart: "Heart",
  throat: "Throat",
  third_eye: "Third Eye",
  crown: "Crown",
};

export const posts = pgTable("posts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  authorId: varchar("author_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  chakraType: text("chakra_type").$type<ChakraType>(),
  frequencyScore: real("frequency_score"),
  sparkCount: integer("spark_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // New fields for video elements content platform
  elementCategory: text("element_category").$type<ElementCategory>(),
  uploadStatus: text("upload_status").$type<UploadStatus>().default("Published"),
  safetyAssessment: jsonb("safety_assessment"),
  moderationStatus: text("moderation_status").$type<ModerationStatus>().default("auto_approved"),
  viewCount: integer("view_count").default(0).notNull(),
  engagementScore: integer("engagement_score").default(0),
  positivityScore: integer("positivity_score"),
}, (table) => [
  index("idx_posts_element_status").on(table.elementCategory, table.uploadStatus),
  index("idx_posts_created_at").on(table.createdAt),
  index("idx_posts_moderation").on(table.moderationStatus),
]);

export const comments = pgTable("comments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id),
  authorId: varchar("author_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sparks = pgTable("sparks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  sparkType: text("spark_type").default("light").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const oracles = pgTable("oracles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  readingType: text("reading_type").notNull(),
  content: text("content").notNull(),
  cards: jsonb("cards"),
  chakraFocus: text("chakra_focus").$type<ChakraType>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const energyTransactions = pgTable("energy_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  amount: integer("amount").notNull(),
  transactionType: text("transaction_type").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reports = pgTable("reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  reporterId: varchar("reporter_id")
    .notNull()
    .references(() => users.id),
  postId: integer("post_id").references(() => posts.id),
  reason: text("reason").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPostSchema = z.object({
  authorId: z.string(),
  content: z.string().min(1),
  imageUrl: z.string().optional(),
  elementCategory: z.enum(["Water", "Fire", "Earth", "Air", "Spiritual"]).optional(),
});

export const insertCommentSchema = z.object({
  postId: z.number(),
  authorId: z.string(),
  content: z.string().min(1),
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;
export type Spark = typeof sparks.$inferSelect;
export type Oracle = typeof oracles.$inferSelect;
export type EnergyTransaction = typeof energyTransactions.$inferSelect;
export type Report = typeof reports.$inferSelect;

// New types for video elements platform
export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;
export type ElementCategoryRecord = typeof elementCategories.$inferSelect;
export type ContentTrendingRecord = typeof contentTrending.$inferSelect;
export type UserRecommendation = typeof userRecommendations.$inferSelect;
export type ModerationQueueRecord = typeof moderationQueue.$inferSelect;
export type AuditLogRecord = typeof auditLog.$inferSelect;
export type ViewSession = typeof viewSessions.$inferSelect;

export const insertVideoSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  elementCategory: z.enum(["Water", "Fire", "Earth", "Air", "Spiritual"]),
  videoUrl: z.string().optional(),
  durationSeconds: z.number().optional(),
});

export const insertElementPostSchema = z.object({
  content: z.string().min(1),
  elementCategory: z.enum(["Water", "Fire", "Earth", "Air", "Spiritual"]).optional(),
});

export const moderationDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().optional(),
});
