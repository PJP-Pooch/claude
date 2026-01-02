
const https = require('https');
const fs = require('fs');

async function dumpChatGPTScraper() {
    const login = 'phillip@poochandmutt.com';
    const password = '4830e8936f8a9eae';
    const prompt = 'Best running shoes for men';

    const payload = [{
        keyword: prompt,
        location_code: 2840, // UK
        language_code: 'en',
        web_search: true,
        force_web_search: true
    }];

    const auth = Buffer.from(`${login}:${password}`).toString('base64');
    const options = {
        hostname: 'api.dataforseo.com',
        path: '/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced',
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    fs.writeFileSync('chatgpt_scraper_dump.json', JSON.stringify(parsed, null, 2));
                    console.log("Dumped to chatgpt_scraper_dump.json");
                    resolve(parsed);
                } catch (e) {
                    console.error("Failed to parse response:", body);
                    resolve({ error: body });
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(JSON.stringify(payload));
        req.end();
    });
}

dumpChatGPTScraper();
