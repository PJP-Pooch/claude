
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

    const models = [
        "gemini-1.5-pro",
        "gemini-1.5-pro-001",
        "gemini-1.5-pro-latest",
        "gemini-pro",
        "gemini-1.0-pro",
        "gemini-flash",
        "gemini-1.5-flash"
    ];

    console.log("--- Brute Forcing Model Names ---");

    for (const m of models) {
        try {
            console.log(`\nTesting: '${m}'...`);
            const res = await postData('ai_optimization/gemini/llm_responses/live', [{
                user_prompt: "Hello",
                model_name: m,
                // Include location just in case
                location_code: 2840,
                language_code: "en"
            }], login, password);

            if (res.tasks?.[0]?.status_message === "Ok.") {
                console.log(`SUCCESS! Valid model: ${m}`);
                console.log(JSON.stringify(res.tasks[0], null, 2));
                break;
            } else {
                console.log(`Failed: ${res.tasks?.[0]?.status_message || JSON.stringify(res)}`);
                // Check if error is specifically about model_name
                if (res.tasks?.[0]?.status_code === 40501) {
                    console.log("(Invalid Field: 'model_name')");
                }
            }
        } catch (e) { console.error(e); }
    }
}

run();
