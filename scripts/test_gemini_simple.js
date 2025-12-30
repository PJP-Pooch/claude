
const https = require('https');
const fs = require('fs');

// Simple fetch wrapper
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
        req.write(JSON.stringify(data));
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
            for (const line of lines) {
                if (line.startsWith('DATAFORSEO_LOGIN=')) login = line.split('=')[1].trim().replace(/"/g, '');
                if (line.startsWith('DATAFORSEO_PASSWORD=')) password = line.split('=')[1].trim().replace(/"/g, '');
            }
        } catch (e) {
            console.error("Could not read .env file");
        }
    }

    if (!login || !password) {
        console.error("No credentials found");
        process.exit(1);
    }

    console.log("Credentials found. Testing...");

    // Test 1: No model specified
    try {
        console.log("Test 1: NO MODEL FIELD");
        const res = await postData('ai_optimization/gemini/llm_responses/live', [{
            user_prompt: "Hello",
            location_code: 2840,
            language_code: "en"
        }], login, password);
        console.log("Result:", JSON.stringify(res.tasks?.[0] || res, null, 2));
    } catch (e) { console.error(e); }

    // Test 2: 'model' field
    try {
        console.log("Test 2: FIELD 'model'");
        const res = await postData('ai_optimization/gemini/llm_responses/live', [{
            user_prompt: "Hello",
            model: "gemini-1.5-pro-latest",
            location_code: 2840,
            language_code: "en"
        }], login, password);
        console.log("Result:", JSON.stringify(res.tasks?.[0] || res, null, 2));
    } catch (e) { console.error(e); }

    // Test 3: Generic Endpoint with 'se'
    try {
        console.log("Test 3: Generic Endpoint");
        const res = await postData('ai_optimization/llm_responses/live', [{
            se: "gemini",
            model_name: "gemini-1.5-pro-latest",
            user_prompt: "Hello",
            location_code: 2840,
            language_code: "en"
        }], login, password);
        console.log("Result:", JSON.stringify(res.tasks?.[0] || res, null, 2));
    } catch (e) { console.error(e); }
}

run();
