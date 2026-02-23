// Positivity Analyzer Service
// Analyzes content positivity using OpenAI and keyword-based fallback
// Returns score: 0-100

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const POSITIVITY_PROMPT = `You are a positivity content analyzer for a mental health-focused platform. 
Analyze the given text and return a positivity score from 0 to 100.

Scoring guide:
- 90-100: Extremely positive, uplifting, inspiring, promotes well-being
- 70-89: Generally positive, encouraging, supportive
- 50-69: Neutral or mixed content
- 30-49: Somewhat negative but not harmful
- 0-29: Negative, discouraging (but not necessarily unsafe)

Respond in JSON format only:
{
  "score": number,
  "reasoning": "Brief explanation"
}`;

export async function analyzePositivity(content: string): Promise<number> {
  if (!OPENAI_API_KEY) {
    return fallbackPositivityScore(content);
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
          { role: "system", content: POSITIVITY_PROMPT },
          { role: "user", content: `Analyze positivity:\n\n${content}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      return fallbackPositivityScore(content);
    }

    const data = await response.json();
    const responseContent = data.choices?.[0]?.message?.content;

    if (!responseContent) {
      return fallbackPositivityScore(content);
    }

    const parsed = JSON.parse(responseContent);
    return Math.min(100, Math.max(0, parsed.score || 50));
  } catch (error) {
    console.error("Error analyzing positivity:", error);
    return fallbackPositivityScore(content);
  }
}

function fallbackPositivityScore(content: string): number {
  const text = content.toLowerCase();

  const positiveWords = [
    "love", "happy", "joy", "peace", "gratitude", "inspire", "hope",
    "beautiful", "amazing", "wonderful", "blessing", "heal", "grow",
    "empower", "uplift", "kindness", "compassion", "harmony", "calm",
    "grateful", "positive", "support", "strength", "courage", "light",
    "meditation", "mindful", "wellness", "yoga", "spirit", "nature",
  ];

  const negativeWords = [
    "hate", "angry", "sad", "fear", "anxiety", "stress", "pain",
    "fail", "ugly", "terrible", "awful", "destroy", "fight", "war",
    "toxic", "bad", "worst", "negative", "depress", "hopeless",
  ];

  const posCount = positiveWords.filter((w) => text.includes(w)).length;
  const negCount = negativeWords.filter((w) => text.includes(w)).length;

  // Base score of 50, adjusted by keyword analysis
  let score = 50 + posCount * 5 - negCount * 8;
  return Math.min(100, Math.max(0, score));
}
