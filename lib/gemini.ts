import { SubQuery, SubQueryArraySchema } from './types';
import { GeminiAPIError } from './errors';
import { cosineSimilarity } from './normalize';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_EMBEDDING_MODEL = 'models/text-embedding-004';

/**
 * Generates diverse sub-queries using Gemini API with the fan-out technique
 */
export async function fanOutQueries(
  targetQuery: string,
  apiKey: string
): Promise<{ subQueries: SubQuery[]; diagnostics: { model: string; timestamp: string } }> {
  const prompt = `Using the fan-out technique, generate facets/subqueries/questions closely related to the target topic.
Cover multiple intents (informational, commercial, transactional, navigational), modifiers (who/what/when/where/how),
entities, synonyms, brand vs non-brand, and long-tail variations.
Return strict JSON array items with:
  { "q": string, "intent": "info" | "comm" | "trans" | "nav", "rationale": string }
Avoid duplicates; ensure diversity and usefulness for SERP testing.
Aim for 15-40 queries depending on topic complexity.
Target topic: ${targetQuery}

Return ONLY a valid JSON array, no other text or markdown.`;

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new GeminiAPIError(`Gemini API request failed: ${response.status} ${errorText}`, {
        status: response.status,
        statusText: response.statusText,
      });
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new GeminiAPIError('No candidates returned from Gemini API', { data });
    }

    const candidate = data.candidates[0];
    if (!candidate.content?.parts || candidate.content.parts.length === 0) {
      throw new GeminiAPIError('No content parts in Gemini response', { data });
    }

    const text = candidate.content.parts[0].text;

    // Extract JSON from the response (handle markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    const validated = SubQueryArraySchema.parse(parsed);

    return {
      subQueries: validated,
      diagnostics: {
        model: GEMINI_MODEL,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof GeminiAPIError) {
      throw error;
    }
    throw new GeminiAPIError(`Failed to generate sub-queries: ${String(error)}`, {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Computes semantic similarity between two texts using Gemini embeddings
 * Falls back to TF-IDF cosine similarity if embeddings fail
 */
export async function computeSemanticSimilarity(
  text1: string,
  text2: string,
  apiKey: string,
  useFallback: boolean = true
): Promise<number> {
  try {
    const [embedding1, embedding2] = await Promise.all([
      getEmbedding(text1, apiKey),
      getEmbedding(text2, apiKey),
    ]);

    return cosineSimilarityVector(embedding1, embedding2);
  } catch (error) {
    if (useFallback) {
      // Fallback to TF-IDF cosine similarity
      return cosineSimilarity(text1, text2);
    }
    throw new GeminiAPIError(`Failed to compute semantic similarity: ${String(error)}`, {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Gets embedding vector for a text using Gemini API
 */
async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [
              {
                text,
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new GeminiAPIError(`Gemini embedding API request failed: ${response.status} ${errorText}`, {
        status: response.status,
      });
    }

    const data = await response.json();

    if (!data.embedding?.values) {
      throw new GeminiAPIError('No embedding values in response', { data });
    }

    return data.embedding.values;
  } catch (error) {
    if (error instanceof GeminiAPIError) {
      throw error;
    }
    throw new GeminiAPIError(`Failed to get embedding: ${String(error)}`, {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Computes cosine similarity between two embedding vectors
 */
function cosineSimilarityVector(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    const v1 = vec1[i];
    const v2 = vec2[i];
    if (v1 !== undefined && v2 !== undefined) {
      dotProduct += v1 * v2;
      mag1 += v1 * v1;
      mag2 += v2 * v2;
    }
  }

  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

/**
 * Generates a content brief using Gemini
 */
export async function generateContentBrief(
  query: string,
  context: string,
  apiKey: string
): Promise<string> {
  const prompt = `Generate a detailed content brief for creating content about: "${query}"

Context: ${context}

Include:
1. Recommended H2 and H3 headings
2. Key topics to cover
3. Suggested FAQs
4. Internal linking opportunities
5. Schema markup suggestions

Format as markdown.`;

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new GeminiAPIError(`Gemini API request failed: ${response.status} ${errorText}`, {
        status: response.status,
      });
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new GeminiAPIError('No candidates returned from Gemini API');
    }

    const candidate = data.candidates[0];
    if (!candidate.content?.parts || candidate.content.parts.length === 0) {
      throw new GeminiAPIError('No content parts in Gemini response');
    }

    return candidate.content.parts[0].text.trim();
  } catch (error) {
    if (error instanceof GeminiAPIError) {
      throw error;
    }
    throw new GeminiAPIError(`Failed to generate content brief: ${String(error)}`, {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
