// Moderation Helper Functions
// Parse OpenAI Safety response and create audit logs
import { db } from "../db";
import { auditLog } from "@shared/schema";
import type { AuditAction, ContentType, SafetyAssessment } from "@shared/types";

export async function createAuditEntry(
  action: AuditAction,
  actorId: string | null,
  contentId: number,
  contentType: ContentType,
  changes: Record<string, any>
): Promise<void> {
  await db.insert(auditLog).values({
    action,
    actorId,
    contentId,
    contentType,
    changes,
  });
}

export function parseSafetyFlags(assessment: SafetyAssessment): {
  shouldBlock: boolean;
  requiresReview: boolean;
  reason: string;
} {
  if (!assessment.isSafe) {
    if (assessment.riskLevel === "high") {
      return {
        shouldBlock: true,
        requiresReview: false,
        reason: `High risk content detected: ${assessment.flags.join(", ")}`,
      };
    }

    return {
      shouldBlock: false,
      requiresReview: true,
      reason: `Content flagged for review: ${assessment.flags.join(", ")}`,
    };
  }

  return {
    shouldBlock: false,
    requiresReview: false,
    reason: "Content passed safety review",
  };
}
