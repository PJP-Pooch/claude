
const https = require('https');
const fs = require('fs');

function postData(endpoint, data, login, password) {
    return new Promise((resolve, reject) => {
        const auth = Buffer.from(`${login}:${password}`).toString('base64');
        const options = {
            hostname: 'api.dataforseo.com',
            path: `/v3/${endpoint}`,
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve(parsed);
                } catch (e) {
                    resolve({ error: body });
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(JSON.stringify(data));
        req.end();
    });
}

function getCreds() {
    let login = process.env.DATAFORSEO_LOGIN;
    let password = process.env.DATAFORSEO_PASSWORD;
    if (!login || !password) {
        try {
            const envData = fs.readFileSync('.env', 'utf8');
            const lines = envData.split('\n');
            login = lines.find(l => l.trim().startsWith('DATAFORSEO_LOGIN='))?.split('=')[1].trim().replace(/"/g, '');
            password = lines.find(l => l.trim().startsWith('DATAFORSEO_PASSWORD='))?.split('=')[1].trim().replace(/"/g, '');
        } catch (e) { }
    }
    return { login, password };
}

async function run() {
    const { login, password } = getCreds();
    if (!login) return;

    console.log("--- Troubleshooting Gemini Payloads ---");

    // Test 1: EXACT payload from user docs (no location/language)
    try {
        console.log("\n1. Exact Docs Payload (no loc/lang)");
        const res = await postData('ai_optimization/gemini/llm_responses/live', [{
            user_prompt: "what are the best running shoes?",
            model_name: "gemini-1.5-pro",
            web_search: true
        }], login, password);
        console.log("Status:", res.tasks?.[0]?.status_message || JSON.stringify(res));
    } catch (e) { console.error(e); }

    // Test 2: Generic LLM endpoint (maybe the specific one is bugged for some accounts)
    try {
        console.log("\n2. Generic LLM Endpoint");
        const res = await postData('ai_optimization/llm_responses/live', [{
            se: "gemini",
            user_prompt: "what are the best running shoes?",
            model_name: "gemini-1.5-pro",
            web_search: true
        }], login, password);
        console.log("Status:", res.tasks?.[0]?.status_message || JSON.stringify(res));
    } catch (e) { console.error(e); }

    // Test 3: Get Models again with empty body string (sometimes required for some libs)
    // Actually DataForSEO usually likes [{}]
}

run();
