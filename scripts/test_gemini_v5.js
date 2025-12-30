
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

    // Test 1: Minimal with model_name only
    try {
        console.log("\n1. Gemini Minimal (no loc/lang/web)");
        const res = await postData('ai_optimization/gemini/llm_responses/live', [{
            user_prompt: "Hello",
            model_name: "gemini-1.5-pro"
        }], login, password);
        console.log("Status:", res.tasks?.[0]?.status_message || JSON.stringify(res));
    } catch (e) { console.error(e); }

    // Test 2: With Web Search
    try {
        console.log("\n2. Gemini + Web Search (no loc/lang)");
        const res = await postData('ai_optimization/gemini/llm_responses/live', [{
            user_prompt: "Hello",
            model_name: "gemini-1.5-pro",
            web_search: true
        }], login, password);
        console.log("Status:", res.tasks?.[0]?.status_message || JSON.stringify(res));
    } catch (e) { console.error(e); }

    // Test 3: Claude Test (to see if it's Gemini specific)
    try {
        console.log("\n3. Claude Test");
        const res = await postData('ai_optimization/claude/llm_responses/live', [{
            user_prompt: "Hello",
            model_name: "claude-3-5-sonnet-20240620"
        }], login, password);
        console.log("Status:", res.tasks?.[0]?.status_message || JSON.stringify(res));
    } catch (e) { console.error(e); }
}

run();
