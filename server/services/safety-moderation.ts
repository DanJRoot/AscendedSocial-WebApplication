// OpenAI Safety Moderation Service
// Checks content safety flags using OpenAI Moderation API
import type { SafetyAssessment } from "@shared/types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function checkContentSafety(
  content: string,
  contentType: "video" | "post" = "post"
): Promise<SafetyAssessment> {
  if (!OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY set, auto-approving content safety");
    return {
      isSafe: true,
      flags: [],
      riskLevel: "none",
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: content,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI Moderation API error:", response.status);
      // Conservative: mark as requires review on API failure
      return {
        isSafe: false,
        flags: ["api_error"],
        riskLevel: "medium",
      };
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result) {
      return {
        isSafe: true,
        flags: [],
        riskLevel: "none",
      };
    }

    const flaggedCategories: string[] = [];
    const categories = result.categories || {};

    for (const [category, flagged] of Object.entries(categories)) {
      if (flagged) {
        flaggedCategories.push(category);
      }
    }

    const isFlagged = result.flagged === true;
    let riskLevel: SafetyAssessment["riskLevel"] = "none";

    if (isFlagged) {
      // Determine risk level based on number and type of flags
      const highRiskCategories = [
        "sexual/minors",
        "violence/graphic",
        "self-harm/intent",
        "self-harm/instructions",
      ];

      const hasHighRisk = flaggedCategories.some((c) =>
        highRiskCategories.includes(c)
      );

      if (hasHighRisk) {
        riskLevel = "high";
      } else if (flaggedCategories.length > 2) {
        riskLevel = "high";
      } else if (flaggedCategories.length > 0) {
        riskLevel = "medium";
      }
    }

    return {
      isSafe: !isFlagged,
      flags: flaggedCategories,
      riskLevel,
    };
  } catch (error) {
    console.error("Error checking content safety:", error);
    return {
      isSafe: false,
      flags: ["api_error"],
      riskLevel: "medium",
    };
  }
}

export async function checkVideoSafety(
  title: string,
  description: string | undefined,
  videoUrl: string
): Promise<SafetyAssessment> {
  // For video, check text content (title + description)
  const textContent = `${title} ${description || ""}`.trim();
  return checkContentSafety(textContent, "video");
}
