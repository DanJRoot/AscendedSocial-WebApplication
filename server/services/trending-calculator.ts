// Trending Calculator Service
// Calculates trending scores for content: views_24h * 0.6 + engagement_24h * 0.4
// Weighted by positivity score for mental health ranking
import { db } from "../db";
import { videos, posts, contentTrending } from "@shared/schema";
import { eq, sql, and, gt } from "drizzle-orm";
import type { ElementCategory, ContentType } from "@shared/types";

export async function calculateTrendingScores(): Promise<void> {
  console.log("[Trending] Recalculating trending scores...");

  const elements: ElementCategory[] = ["Water", "Fire", "Earth", "Air", "Spiritual"];
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const element of elements) {
    await calculateElementTrending(element, twentyFourHoursAgo);
  }

  console.log("[Trending] Trending scores recalculated successfully");
}

async function calculateElementTrending(
  element: ElementCategory,
  since: Date
): Promise<void> {
  // Get published videos for this element
  const publishedVideos = await db
    .select({
      id: videos.id,
      viewCount: videos.viewCount,
      positivityScore: videos.positivityScore,
    })
    .from(videos)
    .where(
      and(
        eq(videos.elementCategory, element),
        eq(videos.uploadStatus, "Published")
      )
    );

  for (const video of publishedVideos) {
    const viewCount24h = video.viewCount; // Simplified: use total views as proxy
    const engagementCount24h = Math.floor(viewCount24h * 0.3); // Simplified engagement

    // Base trending score: views * 0.6 + engagement * 0.4
    let trendingScore = viewCount24h * 0.6 + engagementCount24h * 0.4;

    // Positivity multiplier: 2x weight for positivity
    if (video.positivityScore !== null) {
      const positivityMultiplier = getPositivityMultiplier(video.positivityScore);
      trendingScore *= positivityMultiplier;
    }

    // Upsert trending record
    const existing = await db
      .select()
      .from(contentTrending)
      .where(
        and(
          eq(contentTrending.contentId, video.id),
          eq(contentTrending.contentType, "video")
        )
      );

    if (existing.length > 0) {
      await db
        .update(contentTrending)
        .set({
          trendingScore: trendingScore.toFixed(2),
          viewCount24h,
          engagementCount24h,
          updatedAt: new Date(),
        })
        .where(eq(contentTrending.id, existing[0].id));
    } else {
      await db.insert(contentTrending).values({
        contentId: video.id,
        contentType: "video",
        elementCategory: element,
        trendingScore: trendingScore.toFixed(2),
        viewCount24h,
        engagementCount24h,
      });
    }
  }

  // Get published posts for this element
  const publishedPosts = await db
    .select({
      id: posts.id,
      viewCount: posts.viewCount,
      engagementScore: posts.engagementScore,
      positivityScore: posts.positivityScore,
    })
    .from(posts)
    .where(
      and(
        eq(posts.elementCategory, element),
        eq(posts.uploadStatus, "Published")
      )
    );

  for (const post of publishedPosts) {
    const viewCount24h = post.viewCount;
    const engagementCount24h = post.engagementScore || 0;

    let trendingScore = viewCount24h * 0.6 + engagementCount24h * 0.4;

    if (post.positivityScore !== null) {
      trendingScore *= getPositivityMultiplier(post.positivityScore!);
    }

    const existing = await db
      .select()
      .from(contentTrending)
      .where(
        and(
          eq(contentTrending.contentId, post.id),
          eq(contentTrending.contentType, "post")
        )
      );

    if (existing.length > 0) {
      await db
        .update(contentTrending)
        .set({
          trendingScore: trendingScore.toFixed(2),
          viewCount24h,
          engagementCount24h,
          updatedAt: new Date(),
        })
        .where(eq(contentTrending.id, existing[0].id));
    } else {
      await db.insert(contentTrending).values({
        contentId: post.id,
        contentType: "post",
        elementCategory: element,
        trendingScore: trendingScore.toFixed(2),
        viewCount24h,
        engagementCount24h,
      });
    }
  }
}

// Positivity multipliers for mental health ranking
// 90+ = 3x, 70-89 = 1.5x, 50-69 = 1x, <50 = 0.5x
function getPositivityMultiplier(score: number): number {
  if (score >= 90) return 3.0;
  if (score >= 70) return 1.5;
  if (score >= 50) return 1.0;
  return 0.5;
}

export { getPositivityMultiplier };
