// OpenAI Video Analysis Service
// Provides functions for analyzing video content and categorizing into element types
import type { AIAnalysisResult, ElementCategory } from "@shared/types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const ELEMENT_PROMPT = `You are an AI content analyzer for a spiritual wellness platform. Analyze the given content and categorize it into ONE of these 5 element categories:

1. **Water** - Flow, emotion, intuition, adaptability. Content that soothes, inspires reflection, emotional depth.
2. **Fire** - Passion, energy, transformation, willpower. Content that motivates, energizes, sparks action.
3. **Earth** - Stability, grounding, nurture, growth. Content that centers, grounds, connects to nature.
4. **Air** - Intellect, communication, freedom, perspective. Content that expands thinking, broadens horizons.
5. **Spiritual** - Transcendence, unity, divine connection. Content that elevates spirit, deepens spiritual practice.

Respond in JSON format:
{
  "elementType": "Water" | "Fire" | "Earth" | "Air" | "Spiritual",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of why this element was chosen"
}`;

export async function analyzeVideoElement(
  videoUrl: string,
  title: string,
  description?: string
): Promise<AIAnalysisResult> {
  if (!OPENAI_API_KEY) {
    // Fallback: assign random element if no API key
    console.warn("No OPENAI_API_KEY set, using fallback element assignment");
    return fallbackAnalysis(title, description);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: ELEMENT_PROMPT },
          {
            role: "user",
            content: `Analyze this content:\nTitle: ${title}\nDescription: ${description || "No description"}\nVideo URL: ${videoUrl}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return fallbackAnalysis(title, description);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return fallbackAnalysis(title, description);
    }

    const parsed = JSON.parse(content);
    return {
      elementType: parsed.elementType as ElementCategory,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || "AI analysis completed",
    };
  } catch (error) {
    console.error("Error analyzing video element:", error);
    return fallbackAnalysis(title, description);
  }
}

export async function analyzeTextElement(
  content: string
): Promise<AIAnalysisResult> {
  if (!OPENAI_API_KEY) {
    return fallbackAnalysis(content);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: ELEMENT_PROMPT },
          {
            role: "user",
            content: `Analyze this text content and categorize:\n\n${content}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      return fallbackAnalysis(content);
    }

    const data = await response.json();
    const responseContent = data.choices?.[0]?.message?.content;

    if (!responseContent) {
      return fallbackAnalysis(content);
    }

    const parsed = JSON.parse(responseContent);
    return {
      elementType: parsed.elementType as ElementCategory,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || "AI analysis completed",
    };
  } catch (error) {
    console.error("Error analyzing text element:", error);
    return fallbackAnalysis(content);
  }
}

function fallbackAnalysis(
  title: string,
  description?: string
): AIAnalysisResult {
  // Simple keyword-based fallback categorization
  const text = `${title} ${description || ""}`.toLowerCase();

  const keywords: Record<ElementCategory, string[]> = {
    Water: ["water", "ocean", "flow", "emotion", "calm", "soothe", "reflect", "rain", "river", "wave", "peace", "intuition", "feeling"],
    Fire: ["fire", "energy", "passion", "motivat", "transform", "power", "action", "burn", "light", "strength", "drive", "courage"],
    Earth: ["earth", "ground", "nature", "grow", "stability", "nurture", "plant", "forest", "mountain", "root", "heal", "body"],
    Air: ["air", "wind", "think", "intellect", "communic", "freedom", "perspect", "mind", "idea", "learn", "breath", "open"],
    Spiritual: ["spirit", "transcend", "divine", "meditat", "pray", "conscious", "sacred", "soul", "enlighten", "chakra", "universe", "cosmic"],
  };

  let bestElement: ElementCategory = "Spiritual";
  let bestScore = 0;

  for (const [element, words] of Object.entries(keywords)) {
    const score = words.filter((w) => text.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestElement = element as ElementCategory;
    }
  }

  // If no keywords match, pick randomly
  if (bestScore === 0) {
    const elements: ElementCategory[] = ["Water", "Fire", "Earth", "Air", "Spiritual"];
    bestElement = elements[Math.floor(Math.random() * elements.length)];
  }

  return {
    elementType: bestElement,
    confidence: bestScore > 0 ? Math.min(0.8, bestScore * 0.2) : 0.3,
    reasoning: bestScore > 0
      ? `Keyword analysis matched ${bestScore} ${bestElement} keywords`
      : "Random assignment (no AI API key configured)",
  };
}
