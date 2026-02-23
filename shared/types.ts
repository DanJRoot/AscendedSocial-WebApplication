// Element category type definitions for the AI-Powered Video Elements Content Platform

export const elementCategories = [
  "Water",
  "Fire",
  "Earth",
  "Air",
  "Spiritual",
] as const;

export type ElementCategory = (typeof elementCategories)[number];

export const uploadStatuses = [
  "Under Review",
  "Published",
  "Flagged",
] as const;

export type UploadStatus = (typeof uploadStatuses)[number];

export const moderationStatuses = [
  "auto_approved",
  "requires_review",
  "rejected",
] as const;

export type ModerationStatus = (typeof moderationStatuses)[number];

export const moderationQueueStatuses = [
  "pending",
  "in_review",
  "resolved",
] as const;

export type ModerationQueueStatus = (typeof moderationQueueStatuses)[number];

export const moderationPriorities = [
  "urgent",
  "high",
  "normal",
  "low",
] as const;

export type ModerationPriority = (typeof moderationPriorities)[number];

export const auditActions = [
  "upload",
  "categorize",
  "moderate",
  "publish",
  "reject",
] as const;

export type AuditAction = (typeof auditActions)[number];

export const contentTypes = ["video", "post"] as const;

export type ContentType = (typeof contentTypes)[number];

export const recommendationBases = [
  "viewing_history",
  "category_curated",
  "hybrid",
] as const;

export type RecommendationBasis = (typeof recommendationBases)[number];

// AI Analysis Result shape
export interface AIAnalysisResult {
  elementType: ElementCategory;
  confidence: number;
  reasoning: string;
}

// Safety Assessment shape
export interface SafetyAssessment {
  isSafe: boolean;
  flags: string[];
  riskLevel: "none" | "low" | "medium" | "high";
}

// Video type for frontend
export interface VideoItem {
  id: number;
  title: string;
  description: string | null;
  elementCategory: ElementCategory;
  uploadStatus: UploadStatus;
  videoUrl: string | null;
  durationSeconds: number | null;
  viewCount: number;
  positivityScore: number | null;
  createdAt: string;
  createdBy: string;
  author?: {
    id: string;
    displayName: string | null;
    profileImageUrl: string | null;
  };
}

// Post item for frontend
export interface PostItem {
  id: number;
  content: string;
  elementCategory: ElementCategory | null;
  uploadStatus: UploadStatus;
  viewCount: number;
  engagementScore: number | null;
  positivityScore: number | null;
  createdAt: string;
  createdBy: string;
  author?: {
    id: string;
    displayName: string | null;
    profileImageUrl: string | null;
  };
}

// Feed content item (can be video or post)
export interface FeedItem {
  id: number;
  type: ContentType;
  title?: string;
  content?: string;
  description?: string | null;
  elementCategory: ElementCategory;
  videoUrl?: string | null;
  durationSeconds?: number | null;
  viewCount: number;
  positivityScore: number | null;
  createdAt: string;
  author?: {
    id: string;
    displayName: string | null;
    profileImageUrl: string | null;
  };
}

// Trending item
export interface TrendingItem extends FeedItem {
  trendingScore: number;
  viewCount24h: number;
  engagementCount24h: number;
}

// Moderation queue item
export interface ModerationQueueItem {
  id: number;
  contentId: number;
  contentType: ContentType;
  aiFlaggedReason: string | null;
  priority: ModerationPriority;
  status: ModerationQueueStatus;
  createdAt: string;
  content?: FeedItem;
}

// Analytics overview
export interface AnalyticsOverview {
  totalVideos: number;
  totalPosts: number;
  approvalRate: number;
  safetyFlagRate: number;
  elementDistribution: Record<ElementCategory, number>;
  trendingTopics: string[];
}
