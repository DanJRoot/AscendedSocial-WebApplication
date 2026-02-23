// Ranking Engine - visibility tiers for content based on positivity
import type { FeedItem } from "@shared/types";

export type VisibilityTier = "featured" | "standard" | "reduced" | "suppressed";

export function getVisibilityTier(positivityScore: number | null): VisibilityTier {
  if (positivityScore === null) return "standard";
  if (positivityScore >= 90) return "featured";
  if (positivityScore >= 50) return "standard";
  if (positivityScore >= 30) return "reduced";
  return "suppressed";
}

export function applyPositivityRanking(items: FeedItem[]): FeedItem[] {
  return items
    .filter((item) => {
      // Suppress content with very low positivity
      const tier = getVisibilityTier(item.positivityScore);
      return tier !== "suppressed";
    })
    .sort((a, b) => {
      const tierOrder: Record<VisibilityTier, number> = {
        featured: 0,
        standard: 1,
        reduced: 2,
        suppressed: 3,
      };

      const tierA = getVisibilityTier(a.positivityScore);
      const tierB = getVisibilityTier(b.positivityScore);

      // First sort by tier, then by date within same tier
      if (tierOrder[tierA] !== tierOrder[tierB]) {
        return tierOrder[tierA] - tierOrder[tierB];
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function getPositivityMultiplier(score: number): number {
  if (score >= 90) return 3.0;
  if (score >= 70) return 1.5;
  if (score >= 50) return 1.0;
  return 0.5;
}
