
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
                    // console.error("Raw body:", body); 
                    // Sometimes HTML error
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
    if (!login) { console.error("No creds"); return; }

    console.log("--- Probing Gemini Endpoints ---");

    // Probe 1: Models
    try {
        console.log("\n1. Models Endpoint (payload [{}])");
        const res = await postData('ai_optimization/gemini/llm_responses/models', [{}], login, password);
        console.log("Status:", res.tasks?.[0]?.status_message || res);
        if (res.tasks?.[0]?.result) console.log("Models:", JSON.stringify(res.tasks[0].result, null, 2));
    } catch (e) { console.error(e); }

    // Probe 2: Live Endpoint - Minimal
    try {
        console.log("\n2. Live Endpoint - minimal payload");
        const res = await postData('ai_optimization/gemini/llm_responses/live', [{
            // No fields
        }], login, password);
        console.log("Status:", res.tasks?.[0]?.status_message || res);
    } catch (e) { console.error(e); }

}

run();
