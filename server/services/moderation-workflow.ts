// Moderation Workflow Service
// Orchestrates: analysis → safety check → auto-approve or flag → update status
import { db } from "../db";
import { videos, posts, moderationQueue, auditLog } from "@shared/schema";
import { eq } from "drizzle-orm";
import { analyzeVideoElement, analyzeTextElement } from "./content-analysis";
import { checkContentSafety, checkVideoSafety } from "./safety-moderation";
// @ts-ignore - TS server cache issue with newly created file; file exists at ./positivity-analyzer.ts
import { analyzePositivity } from "./positivity-analyzer";
import type { ContentType, ModerationStatus } from "@shared/types";

export async function processVideoUpload(
  videoId: number,
  title: string,
  description: string | undefined,
  videoUrl: string,
  actorId: string
): Promise<{ success: boolean; status: ModerationStatus }> {
  try {
    // 1. Analyze element category
    const analysis = await analyzeVideoElement(videoUrl, title, description);

    // 2. Run safety check
    const safety = await checkVideoSafety(title, description, videoUrl);

    // 3. Analyze positivity
    const positivityScore = await analyzePositivity(`${title} ${description || ""}`);

    // 4. Determine moderation decision
    let moderationStatus: ModerationStatus;

    if (!safety.isSafe) {
      moderationStatus = safety.riskLevel === "high" ? "rejected" : "requires_review";

      // Add to moderation queue
      await db.insert(moderationQueue).values({
        contentId: videoId,
        contentType: "video",
        aiFlaggedReason: safety.flags.join(", "),
        priority: safety.riskLevel === "high" ? "urgent" : "high",
        status: "pending",
      });
    } else if (analysis.confidence < 0.5) {
      moderationStatus = "requires_review";

      await db.insert(moderationQueue).values({
        contentId: videoId,
        contentType: "video",
        aiFlaggedReason: `Low categorization confidence: ${analysis.confidence}`,
        priority: "normal",
        status: "pending",
      });
    } else {
      moderationStatus = "auto_approved";
    }

    // 5. Update video record
    await db
      .update(videos)
      .set({
        elementCategory: analysis.elementType,
        aiAnalysisResult: analysis,
        safetyAssessment: safety,
        moderationStatus,
        uploadStatus: moderationStatus === "auto_approved" ? "Published" : moderationStatus === "rejected" ? "Flagged" : "Under Review",
        positivityScore,
      })
      .where(eq(videos.id, videoId));

    // 6. Create audit log
    await db.insert(auditLog).values({
      action: moderationStatus === "auto_approved" ? "publish" : "moderate",
      actorId,
      contentId: videoId,
      contentType: "video",
      changes: {
        analysis,
        safety,
        moderationStatus,
        positivityScore,
      },
    });

    return { success: true, status: moderationStatus };
  } catch (error) {
    console.error("[Moderation] Error processing video upload:", error);

    // Set to requires_review on error
    await db
      .update(videos)
      .set({
        moderationStatus: "requires_review",
        uploadStatus: "Under Review",
      })
      .where(eq(videos.id, videoId));

    await db.insert(moderationQueue).values({
      contentId: videoId,
      contentType: "video",
      aiFlaggedReason: `Processing error: ${error instanceof Error ? error.message : "Unknown error"}`,
      priority: "high",
      status: "pending",
    });

    return { success: false, status: "requires_review" };
  }
}

export async function processPostCreation(
  postId: number,
  content: string,
  actorId: string
): Promise<{ success: boolean; status: ModerationStatus }> {
  try {
    // 1. Analyze element category
    const analysis = await analyzeTextElement(content);

    // 2. Run safety check
    const safety = await checkContentSafety(content, "post");

    // 3. Analyze positivity
    const positivityScore = await analyzePositivity(content);

    // 4. Determine moderation decision
    let moderationStatus: ModerationStatus;

    if (!safety.isSafe) {
      moderationStatus = safety.riskLevel === "high" ? "rejected" : "requires_review";

      await db.insert(moderationQueue).values({
        contentId: postId,
        contentType: "post",
        aiFlaggedReason: safety.flags.join(", "),
        priority: safety.riskLevel === "high" ? "urgent" : "high",
        status: "pending",
      });
    } else {
      moderationStatus = "auto_approved";
    }

    // 5. Update post record
    await db
      .update(posts)
      .set({
        elementCategory: analysis.elementType,
        safetyAssessment: safety,
        moderationStatus,
        uploadStatus: moderationStatus === "auto_approved" ? "Published" : moderationStatus === "rejected" ? "Flagged" : "Under Review",
        positivityScore,
      })
      .where(eq(posts.id, postId));

    // 6. Create audit log
    await db.insert(auditLog).values({
      action: moderationStatus === "auto_approved" ? "publish" : "moderate",
      actorId,
      contentId: postId,
      contentType: "post",
      changes: {
        analysis,
        safety,
        moderationStatus,
        positivityScore,
      },
    });

    return { success: true, status: moderationStatus };
  } catch (error) {
    console.error("[Moderation] Error processing post:", error);

    await db
      .update(posts)
      .set({
        moderationStatus: "requires_review",
        uploadStatus: "Under Review",
      })
      .where(eq(posts.id, postId));

    return { success: false, status: "requires_review" };
  }
}

export async function resolveModeration(
  contentId: number,
  contentType: ContentType,
  decision: "approved" | "rejected",
  notes: string | undefined,
  moderatorId: string
): Promise<void> {
  const moderationStatus: ModerationStatus = decision === "approved" ? "auto_approved" : "rejected";
  const uploadStatus = decision === "approved" ? "Published" : "Flagged";

  if (contentType === "video") {
    await db
      .update(videos)
      .set({
        moderationStatus,
        uploadStatus,
        moderationNotes: notes,
        moderatedBy: moderatorId,
        moderatedAt: new Date(),
      })
      .where(eq(videos.id, contentId));
  } else {
    await db
      .update(posts)
      .set({
        moderationStatus,
        uploadStatus,
      })
      .where(eq(posts.id, contentId));
  }

  // Update moderation queue
  await db
    .update(moderationQueue)
    .set({ status: "resolved" })
    .where(eq(moderationQueue.contentId, contentId));

  // Create audit log
  await db.insert(auditLog).values({
    action: decision === "approved" ? "publish" : "reject",
    actorId: moderatorId,
    contentId,
    contentType,
    changes: { decision, notes },
  });
}
