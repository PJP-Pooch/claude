import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { product_id, location_code, language_code, dataforseoLogin, dataforseoPassword } = body;

        // Use credentials from request if provided, otherwise fallback to env vars
        const login = dataforseoLogin || process.env.DATAFORSEO_LOGIN;
        const password = dataforseoPassword || process.env.DATAFORSEO_PASSWORD;
        const auth = Buffer.from(`${login}:${password}`).toString('base64');

        // 1. Try LIVE endpoint first for speed
        console.log(`Fetching sellers (LIVE) for product: ${product_id}`);
        const liveResponse = await fetch('https://api.dataforseo.com/v3/merchant/google/sellers/live', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([{
                product_id,
                location_code,
                language_code,
            }]),
        });

        if (liveResponse.ok) {
            const data = await liveResponse.json();
            return NextResponse.json(data);
        }

        // Log the live error but don't fail yet
        const liveError = await liveResponse.text();
        console.warn(`Live endpoint failed (${liveResponse.status}), falling back to Task API. Error: ${liveError}`);

        // 2. Fallback to TASK endpoint if Live fails
        console.log(`Falling back to Task API for product: ${product_id}`);
        const taskResponse = await fetch('https://api.dataforseo.com/v3/merchant/google/sellers/task_post', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([{
                product_id,
                location_code,
                language_code,
                priority: 2
            }]),
        });

        if (!taskResponse.ok) {
            const errorText = await taskResponse.text();
            console.error('Task API error:', errorText);
            return NextResponse.json(
                { error: `Failed to set task: ${taskResponse.statusText} - ${errorText}` },
                { status: taskResponse.status }
            );
        }

        const taskData = await taskResponse.json();

        if (taskData.tasks && taskData.tasks[0]?.id) {
            const taskId = taskData.tasks[0].id;
            console.log(`Task created: ${taskId}, polling for results...`);

            // Poll for results
            let attempts = 0;
            let results = null;

            // Try for up to 30 seconds (10 attempts * 3 seconds)
            while (attempts < 10 && !results) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 3000));

                const resultsResponse = await fetch(`https://api.dataforseo.com/v3/merchant/google/sellers/task_get/advanced/${taskId}`, {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (resultsResponse.ok) {
                    const resultData = await resultsResponse.json();
                    // Check if result is ready
                    if (resultData.tasks && resultData.tasks[0]?.result) {
                        results = resultData;
                        break;
                    }
                }
            }

            if (results) {
                return NextResponse.json(results);
            } else {
                return NextResponse.json(
                    { error: 'Task created but results not ready after 30 seconds. Please try again.' },
                    { status: 504 }
                );
            }
        }

        return NextResponse.json(taskData);

    } catch (error) {
        console.error('Error in sellers route:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
