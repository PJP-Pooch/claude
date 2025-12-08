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

            // Helper to fetch data for a specific range
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

                const rows = response.data.rows || [];

                // Process rows to ensure numeric types immediately
                return rows.map((row) => ({
                    ...row,
                    clicks: row.clicks || 0,
                    impressions: row.impressions || 0,
                    ctr: row.ctr || 0,
                    position: row.position || 0,
                }));
            };

            if (totalDays <= 30) {
                await sendUpdate({ type: 'progress', current: 1, total: 1, message: "Fetching data..." });
                const rows = await fetchData(startDate, endDate);
                await sendUpdate({ type: 'data', rows });
            } else {
                // Batching logic with PARALLEL requests
                // Create all batch intervals first
                const batches: { start: Date; end: Date }[] = [];
                let currentStart = start;

                while (currentStart <= end) {
                    let currentEnd = addDays(currentStart, 29); // 30 day chunks
                    if (currentEnd > end) {
                        currentEnd = end;
                    }
                    batches.push({ start: currentStart, end: currentEnd });
                    currentStart = addDays(currentEnd, 1);
                }

                const totalBatches = batches.length;
                let completedBatches = 0;
                const CONCURRENCY_LIMIT = 3;

                // Process batches with concurrency limit to avoid OOM
                for (let i = 0; i < batches.length; i += CONCURRENCY_LIMIT) {
                    const chunk = batches.slice(i, i + CONCURRENCY_LIMIT);

                    await Promise.all(chunk.map(async (batch, chunkIndex) => {
                        const batchIndex = i + chunkIndex;
                        const startStr = format(batch.start, "yyyy-MM-dd");
                        const endStr = format(batch.end, "yyyy-MM-dd");

                        try {
                            const rows = await fetchData(startStr, endStr);

                            completedBatches++;

                            // Send data immediately
                            await sendUpdate({
                                type: 'data',
                                rows,
                                batchIndex: batchIndex
                            });

                            // Send progress update
                            await sendUpdate({
                                type: 'progress',
                                current: completedBatches,
                                total: totalBatches,
                                message: `Fetched batch ${completedBatches}/${totalBatches}: ${startStr} to ${endStr}`
                            });

                        } catch (err: any) {
                            console.error(`Error fetching batch ${startStr} to ${endStr}:`, err);
                            await sendUpdate({
                                type: 'batch_error',
                                message: `Failed to fetch ${startStr} to ${endStr}`,
                                error: err.message
                            });
                        }
                    }));
                }
            }

            await sendUpdate({ type: 'complete' });
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
