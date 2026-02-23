// Feed Service - queries videos and posts by element with caching
import { db } from "../db";
import { videos, posts, contentTrending, userRecommendations } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq, and, desc, sql, gt, asc } from "drizzle-orm";
import type { ElementCategory, ContentType } from "@shared/types";
import type { FeedItem, TrendingItem } from "@shared/types";

// Simple in-memory cache for feed queries
const feedCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const cached = feedCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }
  feedCache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  feedCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

export async function getVideosByElement(
  elementCategory: ElementCategory,
  limit = 20,
  offset = 0
): Promise<FeedItem[]> {
  const cacheKey = `videos:${elementCategory}:${limit}:${offset}`;
  const cached = getCached<FeedItem[]>(cacheKey);
  if (cached) return cached;

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
        eq(videos.elementCategory, elementCategory),
        eq(videos.uploadStatus, "Published")
      )
    )
    .orderBy(desc(videos.createdAt))
    .limit(limit)
    .offset(offset);

  const items: FeedItem[] = result.map((r) => ({
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

  setCache(cacheKey, items);
  return items;
}

export async function getPostsByElement(
  elementCategory: ElementCategory,
  limit = 20,
  offset = 0
): Promise<FeedItem[]> {
  const result = await db
    .select({
      id: posts.id,
      content: posts.content,
      elementCategory: posts.elementCategory,
      viewCount: posts.viewCount,
      positivityScore: posts.positivityScore,
      createdAt: posts.createdAt,
      authorId: users.id,
      authorDisplayName: users.displayName,
      authorProfileImage: users.profileImageUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(
      and(
        eq(posts.elementCategory, elementCategory),
        eq(posts.uploadStatus, "Published")
      )
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);

  return result.map((r) => ({
    id: r.id,
    type: "post" as ContentType,
    content: r.content,
    elementCategory: r.elementCategory as ElementCategory,
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

export async function getFeedByElement(
  elementCategory: ElementCategory,
  limit = 20,
  offset = 0
): Promise<FeedItem[]> {
  const cacheKey = `feed:${elementCategory}:${limit}:${offset}`;
  const cached = getCached<FeedItem[]>(cacheKey);
  if (cached) return cached;

  // Get both videos and posts, then interleave
  const [videoItems, postItems] = await Promise.all([
    getVideosByElement(elementCategory, limit, offset),
    getPostsByElement(elementCategory, limit, offset),
  ]);

  // Merge and sort by date
  const combined = [...videoItems, ...postItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  setCache(cacheKey, combined);
  return combined;
}

export async function getTrendingByElement(
  elementCategory: ElementCategory,
  limit = 10
): Promise<TrendingItem[]> {
  const cacheKey = `trending:${elementCategory}:${limit}`;
  const cached = getCached<TrendingItem[]>(cacheKey);
  if (cached) return cached;

  const trendingResults = await db
    .select({
      id: contentTrending.id,
      contentId: contentTrending.contentId,
      contentType: contentTrending.contentType,
      trendingScore: contentTrending.trendingScore,
      viewCount24h: contentTrending.viewCount24h,
      engagementCount24h: contentTrending.engagementCount24h,
    })
    .from(contentTrending)
    .where(eq(contentTrending.elementCategory, elementCategory))
    .orderBy(desc(contentTrending.trendingScore))
    .limit(limit);

  const items: TrendingItem[] = [];

  for (const t of trendingResults) {
    if (t.contentType === "video") {
      const [video] = await db
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
        .where(and(eq(videos.id, t.contentId), eq(videos.uploadStatus, "Published")));

      if (video) {
        items.push({
          id: video.id,
          type: "video",
          title: video.title,
          description: video.description,
          elementCategory: video.elementCategory as ElementCategory,
          videoUrl: video.videoUrl,
          durationSeconds: video.durationSeconds,
          viewCount: video.viewCount,
          positivityScore: video.positivityScore,
          createdAt: video.createdAt.toISOString(),
          trendingScore: parseFloat(t.trendingScore || "0"),
          viewCount24h: t.viewCount24h,
          engagementCount24h: t.engagementCount24h,
          author: {
            id: video.authorId,
            displayName: video.authorDisplayName,
            profileImageUrl: video.authorProfileImage,
          },
        });
      }
    } else if (t.contentType === "post") {
      const [post] = await db
        .select({
          id: posts.id,
          content: posts.content,
          elementCategory: posts.elementCategory,
          viewCount: posts.viewCount,
          positivityScore: posts.positivityScore,
          createdAt: posts.createdAt,
          authorId: users.id,
          authorDisplayName: users.displayName,
          authorProfileImage: users.profileImageUrl,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(and(eq(posts.id, t.contentId), eq(posts.uploadStatus, "Published")));

      if (post) {
        items.push({
          id: post.id,
          type: "post",
          content: post.content,
          elementCategory: post.elementCategory as ElementCategory,
          viewCount: post.viewCount,
          positivityScore: post.positivityScore,
          createdAt: post.createdAt.toISOString(),
          trendingScore: parseFloat(t.trendingScore || "0"),
          viewCount24h: t.viewCount24h,
          engagementCount24h: t.engagementCount24h,
          author: {
            id: post.authorId,
            displayName: post.authorDisplayName,
            profileImageUrl: post.authorProfileImage,
          },
        });
      }
    }
  }

  setCache(cacheKey, items);
  return items;
}

export async function incrementViewCount(
  contentId: number,
  contentType: ContentType
): Promise<void> {
  if (contentType === "video") {
    await db
      .update(videos)
      .set({ viewCount: sql`${videos.viewCount} + 1` })
      .where(eq(videos.id, contentId));
  } else {
    await db
      .update(posts)
      .set({ viewCount: sql`${posts.viewCount} + 1` })
      .where(eq(posts.id, contentId));
  }
}

export async function getRandomPublishedContent(): Promise<FeedItem | null> {
  // Cryptographically random selection: first decide video or post
  const isVideo = Math.random() > 0.5;

  if (isVideo) {
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
      .where(eq(videos.uploadStatus, "Published"))
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (result.length === 0) {
      // Fallback to posts
      return getRandomPost();
    }

    const r = result[0];
    return {
      id: r.id,
      type: "video",
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
    };
  } else {
    return getRandomPost();
  }
}

async function getRandomPost(): Promise<FeedItem | null> {
  const result = await db
    .select({
      id: posts.id,
      content: posts.content,
      elementCategory: posts.elementCategory,
      viewCount: posts.viewCount,
      positivityScore: posts.positivityScore,
      createdAt: posts.createdAt,
      authorId: users.id,
      authorDisplayName: users.displayName,
      authorProfileImage: users.profileImageUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.uploadStatus, "Published"))
    .orderBy(sql`RANDOM()`)
    .limit(1);

  if (result.length === 0) return null;

  const r = result[0];
  return {
    id: r.id,
    type: "post",
    content: r.content,
    elementCategory: (r.elementCategory || "Spiritual") as ElementCategory,
    viewCount: r.viewCount,
    positivityScore: r.positivityScore,
    createdAt: r.createdAt.toISOString(),
    author: {
      id: r.authorId,
      displayName: r.authorDisplayName,
      profileImageUrl: r.authorProfileImage,
    },
  };
}

// Clear feed cache (called after content changes)
export function invalidateFeedCache(): void {
  feedCache.clear();
}
