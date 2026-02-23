// Content Classifier Helper
// Maps AI analysis response to element categories
import type { ElementCategory, AIAnalysisResult } from "@shared/types";

const validElements: ElementCategory[] = ["Water", "Fire", "Earth", "Air", "Spiritual"];

export function mapToElementCategory(aiResponse: AIAnalysisResult): ElementCategory {
  if (validElements.includes(aiResponse.elementType)) {
    return aiResponse.elementType;
  }

  // Fuzzy matching for edge cases
  const normalized = aiResponse.elementType.toLowerCase().trim();
  const match = validElements.find((e) => e.toLowerCase() === normalized);
  
  return match || "Spiritual"; // Default to Spiritual if no match
}

export function isHighConfidence(confidence: number): boolean {
  return confidence >= 0.7;
}

export function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}
