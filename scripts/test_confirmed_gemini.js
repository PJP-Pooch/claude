
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
    let envData = fs.readFileSync('.env', 'utf8');
    let lines = envData.split('\n');
    let login = lines.find(l => l.trim().startsWith('DATAFORSEO_LOGIN='))?.split('=')[1].trim().replace(/"/g, '');
    let password = lines.find(l => l.trim().startsWith('DATAFORSEO_PASSWORD='))?.split('=')[1].trim().replace(/"/g, '');
    return { login, password };
}

async function run() {
    const { login, password } = getCreds();

    // Test with a model found in the list
    try {
        console.log("Testing with gemini-2.0-flash...");
        const res = await postData('ai_optimization/gemini/llm_responses/live', [{
            user_prompt: "Who won the super bowl in 2024?",
            model_name: "gemini-2.0-flash",
            web_search: true
        }], login, password);
        console.log("Result:", JSON.stringify(res.tasks?.[0] || res, null, 2));
    } catch (e) { console.error(e); }
}

run();
