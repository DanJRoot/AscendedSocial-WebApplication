// Recommendation Engine
// Hybrid approach: category-curated base + user history weighting
import { db } from "../db";
import { videos, posts, userRecommendations, viewSessions } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type { ElementCategory, ContentType, FeedItem } from "@shared/types";
import { getPositivityMultiplier } from "./trending-calculator";

export async function getUserRecommendations(
  userId: string,
  elementCategory: ElementCategory,
  limit = 10
): Promise<FeedItem[]> {
  // Check cache
  const cached = await db
    .select()
    .from(userRecommendations)
    .where(
      and(
        eq(userRecommendations.userId, userId),
        eq(userRecommendations.elementCategory, elementCategory)
      )
    )
    .limit(1);

  if (cached.length > 0 && cached[0].expiresAt > new Date()) {
    const contentIds = cached[0].recommendedContentIds as number[];
    if (contentIds && contentIds.length > 0) {
      return fetchContentByIds(contentIds, elementCategory);
    }
  }

  // Generate fresh recommendations
  const recommendations = await generateRecommendations(userId, elementCategory, limit);

  // Cache for 4 hours
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const contentIds = recommendations.map((r) => r.id);

  if (cached.length > 0) {
    await db
      .update(userRecommendations)
      .set({
        recommendedContentIds: contentIds,
        recommendationBasis: "hybrid",
        calculatedAt: new Date(),
        expiresAt,
      })
      .where(eq(userRecommendations.id, cached[0].id));
  } else {
    await db.insert(userRecommendations).values({
      userId,
      elementCategory,
      recommendedContentIds: contentIds,
      recommendationBasis: "hybrid",
      calculatedAt: new Date(),
      expiresAt,
    });
  }

  return recommendations;
}

async function generateRecommendations(
  userId: string,
  elementCategory: ElementCategory,
  limit: number
): Promise<FeedItem[]> {
  // 1. Get top-quality category-curated content (base pool)
  const baseVideos = await db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      elementCategory: videos.elementCategory,
      videoUrl: videos.videoUrl,
      durationSeconds: videos.durationSeconds,
      viewCount: videos.viewCount,
      positivityScore: videos.positivityScore,
      createdAt: videos.createdAt,
      authorId: users.id,
      authorDisplayName: users.displayName,
      authorProfileImage: users.profileImageUrl,
    })
    .from(videos)
    .innerJoin(users, eq(videos.createdBy, users.id))
    .where(
      and(
        eq(videos.elementCategory, elementCategory),
        eq(videos.uploadStatus, "Published"),
        eq(videos.moderationStatus, "auto_approved")
      )
    )
    .orderBy(desc(videos.viewCount))
    .limit(limit * 3); // Get 3x pool for variety

  // 2. Get user viewing history to weight results
  const recentViews = await db
    .select({ contentId: viewSessions.contentId })
    .from(viewSessions)
    .where(eq(viewSessions.userId, userId))
    .orderBy(desc(viewSessions.startedAt))
    .limit(50);

  const viewedIds = new Set(recentViews.map((v) => v.contentId));

  // 3. Score and rank
  const scored = baseVideos.map((video) => {
    let score = video.viewCount * 0.3; // Base view popularity

    // Positivity multiplier
    if (video.positivityScore !== null) {
      score *= getPositivityMultiplier(video.positivityScore);
    }

    // Penalize already watched
    if (viewedIds.has(video.id)) {
      score *= 0.1;
    }

    // Boost newer content
    const ageHours = (Date.now() - video.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours < 24) score *= 1.5;
    else if (ageHours < 72) score *= 1.2;

    // Add slight randomness for variety
    score *= 0.8 + Math.random() * 0.4;

    return { video, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => ({
    id: s.video.id,
    type: "video" as ContentType,
    title: s.video.title,
    description: s.video.description,
    elementCategory: s.video.elementCategory as ElementCategory,
    videoUrl: s.video.videoUrl,
    durationSeconds: s.video.durationSeconds,
    viewCount: s.video.viewCount,
    positivityScore: s.video.positivityScore,
    createdAt: s.video.createdAt.toISOString(),
    author: {
      id: s.video.authorId,
      displayName: s.video.authorDisplayName,
      profileImageUrl: s.video.authorProfileImage,
    },
  }));
}

async function fetchContentByIds(
  ids: number[],
  elementCategory: ElementCategory
): Promise<FeedItem[]> {
  if (ids.length === 0) return [];

  const result = await db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      elementCategory: videos.elementCategory,
      videoUrl: videos.videoUrl,
      durationSeconds: videos.durationSeconds,
      viewCount: videos.viewCount,
      positivityScore: videos.positivityScore,
      createdAt: videos.createdAt,
      authorId: users.id,
      authorDisplayName: users.displayName,
      authorProfileImage: users.profileImageUrl,
    })
    .from(videos)
    .innerJoin(users, eq(videos.createdBy, users.id))
    .where(
      and(
        inArray(videos.id, ids),
        eq(videos.uploadStatus, "Published")
      )
    );

  return result.map((r) => ({
    id: r.id,
    type: "video" as ContentType,
    title: r.title,
    description: r.description,
    elementCategory: r.elementCategory as ElementCategory,
    videoUrl: r.videoUrl,
    durationSeconds: r.durationSeconds,
    viewCount: r.viewCount,
    positivityScore: r.positivityScore,
    createdAt: r.createdAt.toISOString(),
    author: {
      id: r.authorId,
      displayName: r.authorDisplayName,
      profileImageUrl: r.authorProfileImage,
    },
  }));
}
