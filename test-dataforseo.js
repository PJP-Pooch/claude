// Test script to fetch DataForSEO results
// Using native fetch (Node.js 18+)

const DATAFORSEO_LOGIN = 'phillip@poochandmutt.com';
const DATAFORSEO_PASSWORD = '4830e8936f8a9eae';
const KEYWORD = 'benefits of salmon oil for dogs';
const LOCATION_CODE = 2826; // United Kingdom
const LANGUAGE_CODE = 'en';

// URL normalization function (same as in normalize.ts)
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'msclkid', '_ga', 'mc_cid', 'mc_eid',
      'srsltid', 'gbraid', 'wbraid', 'dclid', 'ref', 'source'
    ];
    trackingParams.forEach(param => {
      parsed.searchParams.delete(param);
    });
    let normalized = `${parsed.protocol}//${host}${parsed.pathname}`;
    if (normalized.endsWith('/') && normalized.length > parsed.protocol.length + 3) {
      normalized = normalized.slice(0, -1);
    }
    const searchString = parsed.searchParams.toString();
    if (searchString) {
      normalized += `?${searchString}`;
    }
    if (parsed.hash) {
      normalized += parsed.hash;
    }
    return normalized;
  } catch (error) {
    return url;
  }
}

async function testDataForSEO() {
  const requestBody = [
    {
      keyword: KEYWORD,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      device: 'desktop',
    },
  ];

  try {
    const authString = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

    console.log('🔍 Fetching SERP results for:', KEYWORD);
    console.log('📍 Location: United Kingdom (2826)');
    console.log('🌐 Language: English (en)');
    console.log('📱 Device: desktop');
    console.log('');

    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      return;
    }

    const data = await response.json();

    console.log('✅ Response received');
    console.log('Status:', data.status_code, data.status_message);
    console.log('Cost:', data.cost, 'credits');
    console.log('');

    if (!data.tasks || data.tasks.length === 0) {
      console.error('❌ No tasks in response');
      return;
    }

    const task = data.tasks[0];
    console.log('📋 Task structure:', JSON.stringify(task, null, 2));

    if (!task.result || task.result.length === 0) {
      console.error('❌ No results in task');
      console.log('Full task object:', JSON.stringify(task, null, 2));
      return;
    }

    const result = task.result[0];
    const items = result.items || [];

    console.log(`📊 Total items received: ${items.length}`);
    console.log('');

    // Filter organic results
    const organicItems = items.filter(item => item.type === 'organic');
    console.log(`🌱 Organic results: ${organicItems.length}`);
    console.log('');

    // Display top 10 organic results
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TOP 10 ORGANIC RESULTS FOR: "benefits of salmon oil for dogs"');
    console.log('═══════════════════════════════════════════════════════════════\n');

    organicItems.slice(0, 10).forEach((item, index) => {
      const cleanUrl = normalizeUrl(item.url);
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   URL: ${cleanUrl}`);
      console.log(`   Position: ${item.rank_absolute}`);
      console.log(`   Domain: ${item.domain}`);
      if (item.description) {
        console.log(`   Snippet: ${item.description.substring(0, 150)}...`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDataForSEO();
