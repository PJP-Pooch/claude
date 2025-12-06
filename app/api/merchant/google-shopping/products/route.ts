import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        let body;
        try {
            const text = await request.text();
            if (!text) {
                return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
            }
            body = JSON.parse(text);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
        }

        const { keyword, location_code, language_code, depth = 40, dataforseoLogin, dataforseoPassword } = body;

        if (!keyword) {
            return NextResponse.json(
                { error: 'Keyword is required' },
                { status: 400 }
            );
        }

        // DataForSEO API credentials - from request body or environment variables
        const username = dataforseoLogin || process.env.DATAFORSEO_LOGIN;
        const password = dataforseoPassword || process.env.DATAFORSEO_PASSWORD;

        if (!username || !password) {
            return NextResponse.json(
                { error: 'DataForSEO API credentials not configured. Please provide credentials or set environment variables.' },
                { status: 500 }
            );
        }

        const auth = Buffer.from(`${username}:${password}`).toString('base64');

        // Set task in DataForSEO
        const taskResponse = await fetch(
            'https://api.dataforseo.com/v3/merchant/google/products/task_post',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([
                    {
                        keyword,
                        price_min: body.price_min,
                        price_max: body.price_max,
                        location_code: location_code || 2840, // Default to US
                        language_code: language_code || 'en',
                        depth,
                        priority: 2, // Normal priority
                    },
                ]),
            }
        );

        if (!taskResponse.ok) {
            const errorText = await taskResponse.text();
            console.error('DataForSEO API error:', {
                status: taskResponse.status,
                statusText: taskResponse.statusText,
                body: errorText
            });
            return NextResponse.json(
                { error: `Failed to set task in DataForSEO: ${taskResponse.statusText} - ${errorText}` },
                { status: taskResponse.status }
            );
        }

        let taskData;
        try {
            const taskText = await taskResponse.text();
            // Check if response is empty
            if (!taskText) throw new Error('Empty response from DataForSEO');
            taskData = JSON.parse(taskText);
        } catch (error) {
            console.error('Failed to parse DataForSEO task response:', error);
            return NextResponse.json(
                { error: 'Failed to parse response from DataForSEO task creation' },
                { status: 502 }
            );
        }
        console.log('Task creation response:', taskData);

        if (taskData.tasks && taskData.tasks[0]?.id) {
            // Get the task ID
            const taskId = taskData.tasks[0].id;

            // Poll for results (try up to 6 times with 5 second intervals = 30 seconds max)
            let attempts = 0;
            let results = null;

            while (attempts < 18 && !results) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 5000));

                const resultsResponse = await fetch(
                    `https://api.dataforseo.com/v3/merchant/google/products/task_get/advanced/${taskId}`,
                    {
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                if (!resultsResponse.ok) {
                    console.error('Failed to fetch results, attempt', attempts);
                    continue;
                }

                let resultData;
                try {
                    const resultText = await resultsResponse.text();
                    if (!resultText) throw new Error('Empty response body');
                    resultData = JSON.parse(resultText);
                } catch (e) {
                    console.error('Failed to parse polling result:', e);
                    continue;
                }

                if (resultData.tasks && resultData.tasks[0]?.result?.[0]?.items) {
                    results = resultData;
                    break;
                }
            }

            if (results) {
                return NextResponse.json(results);
            } else {
                return NextResponse.json(
                    { error: 'Task created but results not ready after 90 seconds. Please try again.' },
                    { status: 504 }
                );
            }
        }

        return NextResponse.json(taskData);
    } catch (error) {
        console.error('Error in Google Shopping Products API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
