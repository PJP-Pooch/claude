import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleError } from '@/lib/errors';

const RequestSchema = z.object({
  query: z.string().min(1),
  actionType: z.enum(['expand_target_page', 'new_page']),
  aiOverviewText: z.string().optional(),
  topResults: z.array(z.object({
    position: z.number(),
    url: z.string(),
    title: z.string(),
    snippet: z.string().optional(),
  })),
  openaiApiKey: z.string().min(1),
});

/**
 * Analyzes SERP results to determine recommended page type
 */
function analyzePageType(topResults: Array<{ url: string; title: string; snippet?: string }>) {
  const urlPatterns = {
    blog: /\/(blog|article|post|guide|how-to)\//i,
    product: /\/(product|shop|buy|item)\//i,
    category: /\/(category|collection|browse)\//i,
    comparison: /\/(vs|versus|compare|best|top)\//i,
    tool: /\/(tool|calculator|generator|checker)\//i,
    listicle: /\b(\d+|top|best)\b.*\b(ways|tips|ideas|examples|tools|products)\b/i,
  };

  const titlePatterns = {
    howTo: /^how to|how do|guide to/i,
    best: /^best|^top \d+|^\d+ best/i,
    comparison: /\bvs\b|\bversus\b|compare/i,
    review: /\breview\b|\breviews\b/i,
    whatIs: /^what is|^what are/i,
  };

  const counts = {
    blog: 0,
    product: 0,
    category: 0,
    comparison: 0,
    tool: 0,
    listicle: 0,
    howTo: 0,
    best: 0,
    review: 0,
  };

  topResults.forEach(result => {
    // Check URL patterns
    if (urlPatterns.blog.test(result.url)) counts.blog++;
    if (urlPatterns.product.test(result.url)) counts.product++;
    if (urlPatterns.category.test(result.url)) counts.category++;
    if (urlPatterns.comparison.test(result.url)) counts.comparison++;
    if (urlPatterns.tool.test(result.url)) counts.tool++;

    // Check title patterns
    if (titlePatterns.howTo.test(result.title)) counts.howTo++;
    if (titlePatterns.best.test(result.title)) counts.listicle++;
    if (titlePatterns.comparison.test(result.title)) counts.comparison++;
    if (titlePatterns.review.test(result.title)) counts.review++;
  });

  // Determine primary page type based on highest count
  const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const primaryType = sortedCounts[0]?.[0] || 'blog';
  const confidence = (sortedCounts[0]?.[1] || 0) / topResults.length;

  // Extract common elements from titles
  const allTitles = topResults.map(r => r.title).join(' ');
  const hasNumbers = /\b\d+\b/.test(allTitles);
  const hasYear = /\b20\d{2}\b/.test(allTitles);
  const avgTitleLength = topResults.reduce((sum, r) => sum + r.title.length, 0) / topResults.length;

  return {
    primaryType,
    confidence,
    counts,
    patterns: {
      hasNumbers,
      hasYear,
      avgTitleLength: Math.round(avgTitleLength),
    },
  };
}

/**
 * Generates a paragraph to expand existing page based on AI Overview
 */
async function generateParagraph(query: string, aiOverviewText: string, openaiApiKey: string) {
  const prompt = `You are an expert SEO content writer. Based on the Google AI Overview below, write a comprehensive, well-researched paragraph (150-200 words) that could be added to a webpage to better address this search query.

Query: "${query}"

Google AI Overview:
${aiOverviewText}

Requirements:
- Write in a natural, engaging tone
- Include relevant keywords naturally
- Provide actionable information
- Cite specific facts or data points when possible
- Make it sound authoritative but accessible

Write only the paragraph, no additional commentary.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert SEO content writer.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Generates a content brief for a new page based on SERP analysis
 */
async function generateContentBrief(
  query: string,
  topResults: Array<{ position: number; url: string; title: string; snippet?: string }>,
  openaiApiKey: string
) {
  const pageTypeAnalysis = analyzePageType(topResults);

  const competitorInfo = topResults.slice(0, 5).map(r =>
    `${r.position}. ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet || 'N/A'}`
  ).join('\n\n');

  const prompt = `You are an expert SEO content strategist. Create a detailed content brief for a new page targeting this query.

Query: "${query}"

SERP Analysis:
- Primary page type: ${pageTypeAnalysis.primaryType}
- Confidence: ${(pageTypeAnalysis.confidence * 100).toFixed(0)}%
- Common patterns: ${JSON.stringify(pageTypeAnalysis.patterns)}

Top 5 Ranking Pages:
${competitorInfo}

Create a comprehensive content brief with:

1. **Recommended Page Type**: What format works best based on SERP analysis
2. **Target Word Count**: Based on competitor analysis
3. **Recommended Title**: SEO-optimized, matching SERP patterns
4. **Required Sections** (5-8 main sections with brief descriptions)
5. **Key Topics to Cover**: Specific angles that ranking pages address
6. **Content Differentiation**: How to stand out from competitors
7. **Keyword Usage**: Primary and secondary keywords with suggested frequency

Format the output in clean markdown.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert SEO content strategist.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * POST /api/generate-content
 * Generates content (paragraph or brief) based on action type
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, actionType, aiOverviewText, topResults, openaiApiKey } = RequestSchema.parse(body);

    let generatedContent: string;
    let contentType: string;

    if (actionType === 'expand_target_page' && aiOverviewText) {
      // Generate paragraph based on AI Overview
      generatedContent = await generateParagraph(query, aiOverviewText, openaiApiKey);
      contentType = 'paragraph';
    } else if (actionType === 'new_page') {
      // Generate content brief based on SERP analysis
      generatedContent = await generateContentBrief(query, topResults, openaiApiKey);
      contentType = 'content_brief';
    } else {
      throw new Error('Invalid action type or missing AI Overview for paragraph generation');
    }

    return NextResponse.json({
      content: generatedContent,
      contentType,
      query,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorInfo = handleError(error);
    return NextResponse.json(
      {
        error: errorInfo.message,
        code: errorInfo.code,
      },
      { status: errorInfo.statusCode }
    );
  }
}
