import { NextResponse } from 'next/server';
import { fetchLatestNews, RawArticle } from '@/app/lib/rssFetcher';
import { checkFactWithGemini } from '@/app/lib/gemini';
import { supabase } from '@/app/lib/supabase';
import { NewsItem } from '@/app/components/NewsCard';

// Helper to delay execution (rate limiting)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// POST /api/cron/update
// This endpoint will be triggered periodically (e.g. via Vercel Cron)
// It performs the expensive operations (RSS fetch + Gemini LLM) and caches the result.
export async function POST(request: Request) {
    try {
        // SECURITY: Ensure this is only called by our trusted cron job or with a secret
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // STEP 1: Fetch trending/breaking news from Free RSS Feeds
        console.log("Fetching news from RSS feeds...");
        const rawNews = await fetchLatestNews();

        // Take maximum of 8 articles per run to stay well within the 15 RPM limit 
        // and avoid timeout on serverless functions.
        const articlesToProcess = rawNews.slice(0, 8);
        console.log(`Processing ${articlesToProcess.length} articles to respect rate limits.`);

        // STEP 2: Iterate over news and process with Gemini fact-checking
        console.log("Analyzing news with Gemini API...");
        const factCheckedNews: Omit<NewsItem, 'id'>[] = [];

        for (const article of articlesToProcess) {
            console.log(`Checking: ${article.title.substring(0, 40)}...`);

            const factCheck = await checkFactWithGemini(article.title, article.summary);

            factCheckedNews.push({
                title: article.title,
                summary: article.summary,
                source: article.source,
                sourceUrl: article.link,
                category: "World News", // Default category for now
                publishedAt: article.pubDate,
                factStatus: factCheck.factStatus,
                confidence: factCheck.confidence,
                factCheckSummary: factCheck.factCheckSummary,
                sources: [article.source], // Could be enriched by LLM later
            });

            // RATE LIMITING: Wait 4.5 seconds between requests (Max ~13 requests per minute)
            // This guarantees we never hit the 15 RPM free tier limit.
            console.log("Waiting 4.5s for rate limit...");
            await delay(4500);
        }

        // STEP 3: Save results to Database (e.g., Supabase)
        console.log("Saving to database...");

        // Ensure we don't insert if missing Supabase keys
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const { error } = await supabase.from('news').insert(factCheckedNews);
            if (error) {
                console.error("Supabase insert error:", error);
            } else {
                console.log("Successfully saved to Supabase.");
            }
        } else {
            console.warn("Skipping DB save: Supabase keys not found in .env.local");
        }

        return NextResponse.json({
            success: true,
            count: factCheckedNews.length,
            message: "Fact-checked news updated successfully."
        });
    } catch (error) {
        console.error("Cron update failed:", error);
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
    }
}
