import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { addDays, differenceInDays, format, parseISO } from "date-fns";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create a stream for sending updates
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Process in background
    (async () => {
        try {
            const body = await req.json();
            const {
                siteUrl,
                startDate,
                endDate,
                dimensions,
                filters,
                searchType,
            } = body;

            // Helper to write lines to stream
            const sendUpdate = async (data: any) => {
                await writer.write(encoder.encode(JSON.stringify(data) + '\n'));
            };

            const auth = new google.auth.OAuth2();
            auth.setCredentials({ access_token: session.accessToken as string });

            const searchConsole = google.webmasters({ version: "v3", auth });

            const start = parseISO(startDate);
            const end = parseISO(endDate);
            const totalDays = differenceInDays(end, start);

            let allRows: any[] = [];

            // Helper to fetch data
            const fetchData = async (startStr: string, endStr: string) => {
                const requestBody: any = {
                    startDate: startStr,
                    endDate: endStr,
                    dimensions,
                    rowLimit: 25000, // Max per request
                    searchType: searchType || "web",
                };

                if (filters && filters.length > 0) {
                    requestBody.dimensionFilterGroups = [
                        {
                            filters,
                        },
                    ];
                }

                const response = await searchConsole.searchanalytics.query({
                    siteUrl,
                    requestBody,
                });

                return response.data.rows || [];
            };

            if (totalDays <= 30) {
                await sendUpdate({ type: 'progress', current: 1, total: 1, message: "Fetching single batch..." });
                allRows = await fetchData(startDate, endDate);
            } else {
                // Batching logic with rate limiting
                let currentStart = start;
                let batchNumber = 0;
                const totalBatches = Math.ceil(totalDays / 30);

                while (currentStart <= end) {
                    let currentEnd = addDays(currentStart, 29); // 30 day chunks
                    if (currentEnd > end) {
                        currentEnd = end;
                    }

                    const startStr = format(currentStart, "yyyy-MM-dd");
                    const endStr = format(currentEnd, "yyyy-MM-dd");

                    batchNumber++;
                    await sendUpdate({
                        type: 'progress',
                        current: batchNumber,
                        total: totalBatches,
                        message: `Fetching batch ${batchNumber}/${totalBatches}: ${startStr} to ${endStr}`
                    });

                    const rows = await fetchData(startStr, endStr);
                    allRows = [...allRows, ...rows];

                    currentStart = addDays(currentEnd, 1);

                    // Add delay between requests to respect rate limits (1,200 QPM)
                    // 500ms delay = ~120 requests per minute, well under the limit
                    if (currentStart <= end) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }

            // Process rows to ensure numeric types
            const processedRows = allRows.map((row) => ({
                ...row,
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0,
            }));

            await sendUpdate({ type: 'complete', rows: processedRows });
        } catch (error: any) {
            console.error("Error fetching GSC data:", error);
            await writer.write(encoder.encode(JSON.stringify({ type: 'error', message: error.message || "Failed to fetch data" }) + '\n'));
        } finally {
            await writer.close();
        }
    })();

    return new Response(stream.readable, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
