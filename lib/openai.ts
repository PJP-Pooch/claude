import { SubQuery, SubQueryArraySchema } from './types';
import { GeminiAPIError } from './errors';
import { cosineSimilarity } from './normalize';

/**
 * Generates diverse sub-queries using OpenAI with the fan-out technique
 */
export async function fanOutQueries(
  targetQuery: string,
  apiKey: string
): Promise<{ subQueries: SubQuery[]; diagnostics: { model: string; timestamp: string } }> {
  const prompt = `Using the fan-out technique, generate comprehensive facets/subqueries/questions closely related to the target topic.
Cover multiple intents (informational, commercial, transactional, navigational), modifiers (who/what/when/where/how),
entities, synonyms, and long-tail variations.
DO NOT include brand comparisons or "vs" queries.
Return strict JSON array items with:
  { "q": string, "intent": "info" | "comm" | "trans" | "nav", "rationale": string }
Avoid duplicates; ensure diversity and usefulness for SERP testing.
Generate as many relevant queries as possible (aim for 20-30 diverse queries).
Target topic: ${targetQuery}

Return ONLY a valid JSON array, no other text or markdown.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GeminiAPIError(`OpenAI API request failed: ${response.status} ${errorText}`, {
        status: response.status,
        statusText: response.statusText,
      });
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new GeminiAPIError('No choices returned from OpenAI API', { data });
    }

    const choice = data.choices[0];
    if (!choice.message?.content) {
      throw new GeminiAPIError('No content in OpenAI response', { choice });
    }

    const text = choice.message.content.trim();

    // Extract JSON from the response (handle markdown code blocks)
    let jsonText = text;
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
        model: 'gpt-4o-mini',
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof GeminiAPIError) {
      throw error;
    }
    throw new GeminiAPIError(`Failed to generate sub-queries with OpenAI: ${String(error)}`, {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Computes semantic similarity between two texts using OpenAI embeddings
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
    throw new GeminiAPIError(`Failed to compute semantic similarity with OpenAI: ${String(error)}`, {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Gets embedding vector for a text using OpenAI API
 */
async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GeminiAPIError(`OpenAI embedding API request failed: ${response.status} ${errorText}`, {
        status: response.status,
      });
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0 || !data.data[0].embedding) {
      throw new GeminiAPIError('No embedding data in OpenAI response', { data });
    }

    return data.data[0].embedding;
  } catch (error) {
    if (error instanceof GeminiAPIError) {
      throw error;
    }
    throw new GeminiAPIError(`Failed to get embedding from OpenAI: ${String(error)}`, {
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
 * Generates a content brief using OpenAI GPT-4
 */
export async function generateContentBriefOpenAI(
  query: string,
  context: string,
  apiKey: string
): Promise<string> {
  const prompt = `Create a detailed content outline for: "${query}"

Based on this context: ${context}

Please provide:
1. Recommended H2 and H3 headings
2. Key topics to cover  
3. Common questions people ask
4. Internal linking opportunities
5. SEO considerations

Format as markdown.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GeminiAPIError(`OpenAI API request failed: ${response.status} ${errorText}`, {
        status: response.status,
        statusText: response.statusText,
      });
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new GeminiAPIError('No choices returned from OpenAI API', { data });
    }

    const choice = data.choices[0];
    if (!choice.message?.content) {
      throw new GeminiAPIError('No content in OpenAI response', { choice });
    }

    return choice.message.content.trim();
  } catch (error) {
    if (error instanceof GeminiAPIError) {
      throw error;
    }
    throw new GeminiAPIError(`Failed to generate content brief with OpenAI: ${String(error)}`, {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}