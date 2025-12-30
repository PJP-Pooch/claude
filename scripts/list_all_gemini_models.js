
const fs = require('fs');
const https = require('https');

function getData(endpoint, login, password) {
    return new Promise((resolve, reject) => {
        const auth = Buffer.from(`${login}:${password}`).toString('base64');
        const options = {
            hostname: 'api.dataforseo.com',
            path: `/v3/${endpoint}`,
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`
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
    const res = await getData('ai_optimization/gemini/llm_responses/models', login, password);
    const models = res.tasks?.[0]?.result || [];
    console.log("Found", models.length, "models");
    models.forEach(m => {
        console.log(`- ${m.model_name} (WebSearch: ${m.web_search_supported})`);
    });
}

run();
