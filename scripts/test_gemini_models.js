
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
                    console.error("Raw body:", body);
                    reject(e);
                }
            });
        });
        req.on('error', (e) => reject(e));
        // Some endpoints take empty array or object
        req.write(JSON.stringify(data || []));
        req.end();
    });
}

async function run() {
    let login = process.env.DATAFORSEO_LOGIN;
    let password = process.env.DATAFORSEO_PASSWORD;
    if (!login || !password) {
        try {
            const envData = fs.readFileSync('.env', 'utf8');
            const lines = envData.split('\n');
            login = lines.find(l => l.startsWith('DATAFORSEO_LOGIN='))?.split('=')[1].trim().replace(/"/g, '');
            password = lines.find(l => l.startsWith('DATAFORSEO_PASSWORD='))?.split('=')[1].trim().replace(/"/g, '');
        } catch (e) { }
    }

    if (!login || !password) { console.error("No creds"); process.exit(1); }

    // Test 4: Get Models
    try {
        console.log("Test 4: Get Models");
        // Often models endpoint is just empty array or null payload
        const res = await postData('ai_optimization/gemini/llm_responses/models', null, login, password);
        console.log("Result:", JSON.stringify(res.tasks?.[0] || res, null, 2));
    } catch (e) { console.error(e); }
}

run();
