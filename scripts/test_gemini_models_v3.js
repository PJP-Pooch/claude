
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
        // Try sending array
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

    console.log("--- Probing V3: Precise Model Names & Models Endpoint ---");

    // 1. Try to get models list
    // Try sending an array with empty object
    try {
        console.log("\n1. Models list (payload: [{}])");
        const res = await postData('ai_optimization/gemini/llm_responses/models', [{}], login, password);
        console.log("Status:", res.tasks?.[0]?.status_message || res.status_message || JSON.stringify(res));
    } catch (e) { console.error(e); }

    // Try sending null/empty array
    try {
        console.log("\n2. Models list (payload: [])");
        const res = await postData('ai_optimization/gemini/llm_responses/models', [], login, password);
        console.log("Status:", res.tasks?.[0]?.status_message || res.status_message || JSON.stringify(res));
    } catch (e) { console.error(e); }


    // 3. Try 'gemini-1.5-pro' (Value from user hint)
    try {
        console.log("\n3. Live: model_name: 'gemini-1.5-pro'");
        const res = await postData('ai_optimization/gemini/llm_responses/live', [{
            user_prompt: "Who are you?",
            model_name: "gemini-1.5-pro",
            web_search: false
        }], login, password);
        console.log("Result:", JSON.stringify(res.tasks?.[0] || res, null, 2));
    } catch (e) { console.error(e); }

    // 4. Try 'gemini-pro'
    try {
        console.log("\n4. Live: model_name: 'gemini-pro'");
        const res = await postData('ai_optimization/gemini/llm_responses/live', [{
            user_prompt: "Who are you?",
            model_name: "gemini-pro",
            web_search: false
        }], login, password);
        console.log("Result:", JSON.stringify(res.tasks?.[0] || res, null, 2));
    } catch (e) { console.error(e); }

}

run();
