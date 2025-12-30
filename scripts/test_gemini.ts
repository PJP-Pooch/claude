
import { fetchDataForSEO } from '../lib/dataforseo';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function testGemini() {
    console.log("Testing Gemini API...");

    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;

    if (!login || !password) {
        console.error("Missing credentials in .env");
        return;
    }

    const endpoint = "ai_optimization/gemini/llm_responses/live";

    // Test 1: No model name
    try {
        console.log("\n--- Test 1: No model name ---");
        const payload1 = [{
            user_prompt: "Who won the super bowl in 2024?",
            language_code: "en",
            location_code: 2840 // US
        }];
        const res1 = await fetchDataForSEO(endpoint, payload1, login, password);
        console.log("Success?", res1.tasks?.[0]?.status_message || "No status");
        if (res1.tasks?.[0]?.result) console.log("Result:", res1.tasks[0].result[0].text.substring(0, 50) + "...");
    } catch (e: any) {
        console.log("Error:", e.message);
    }

    // Test 2: 'model' instead of 'model_name'
    try {
        console.log("\n--- Test 2: Field 'model' ---");
        const payload2 = [{
            model: "gemini-1.5-pro-latest",
            user_prompt: "Who won the super bowl in 2024?",
            language_code: "en",
            location_code: 2840
        }];
        const res2 = await fetchDataForSEO(endpoint, payload2, login, password);
        console.log("Success?", res2.tasks?.[0]?.status_message || "No status");
    } catch (e: any) {
        console.log("Error:", e.message);
    }
}

testGemini();
