import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/app/lib/supabase";
import {
    GEMINI_MODEL,
    GeminiServiceError,
    checkFactWithGeminiDetailed,
} from "@/app/lib/gemini";

const TECHNICAL_FAILURE_SUMMARY = "Analysis failed due to a technical error.";
const DEFAULT_DAILY_CHECK_LIMIT = 12;

type CheckApiErrorCode =
    | "invalid_input"
    | "input_too_long"
    | "daily_limit_reached"
    | "quota_exceeded"
    | "provider_unavailable"
    | "internal_error";

type StoredCheckRecord = {
    id: string;
    input_text: string;
    verdict: string;
    confidence: number;
    summary: string;
    why_reasoning: string[];
    sources: { title: string; url: string }[];
    created_at: string;
};

function getDailyCheckLimit(): number {
    const rawLimit = Number.parseInt(
        process.env.DAILY_CHECK_LIMIT ?? `${DEFAULT_DAILY_CHECK_LIMIT}`,
        10
    );

    if (!Number.isFinite(rawLimit) || rawLimit < 0) {
        return DEFAULT_DAILY_CHECK_LIMIT;
    }

    return rawLimit;
}

function normalizeInputForHash(input: string): string {
    const normalized = input.normalize("NFKC").trim();

    if (/^https?:\/\//i.test(normalized)) {
        try {
            const url = new URL(normalized);
            url.hash = "";
            url.hostname = url.hostname.toLowerCase();
            if (url.pathname !== "/") {
                url.pathname = url.pathname.replace(/\/+$/, "");
            }

            return url.toString().toLowerCase();
        } catch {
            // Fall through to text normalization when the URL is invalid.
        }
    }

    return normalized
        .toLowerCase()
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/^[`"' ]+|[`"' ]+$/g, "")
        .replace(/[!?.,;:]+$/g, "")
        .replace(/[\s\n\t]+/g, " ");
}

function generateInputHash(input: string): string {
    const normalized = normalizeInputForHash(input);
    return crypto.createHash("sha256").update(normalized).digest("hex");
}

function getUtcDayStartIso(): string {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now.toISOString();
}

function createErrorResponse(
    status: number,
    errorCode: CheckApiErrorCode,
    error: string,
    retryable: boolean
) {
    return NextResponse.json(
        {
            success: false,
            error,
            errorCode,
            retryable,
        },
        { status }
    );
}

function isStaleTechnicalFailure(record: Partial<StoredCheckRecord> | null | undefined) {
    return (
        record?.summary === TECHNICAL_FAILURE_SUMMARY &&
        record?.confidence === 0 &&
        record?.verdict === "unverified"
    );
}

function mapGeminiErrorToResponse(error: GeminiServiceError) {
    if (error.code === "gemini_quota_exceeded") {
        return createErrorResponse(
            429,
            "quota_exceeded",
            "Daily free quota reached. Try again tomorrow.",
            false
        );
    }

    return createErrorResponse(
        error.status === 429 ? 429 : 503,
        "provider_unavailable",
        "Live AI checks are temporarily unavailable. Please retry in a moment.",
        error.retryable
    );
}

export async function POST(request: Request) {
    try {
        let body: { text?: unknown };

        try {
            body = await request.json();
        } catch {
            return createErrorResponse(
                400,
                "invalid_input",
                "Input text is required.",
                false
            );
        }

        const { text } = body;

        if (typeof text !== "string" || text.trim().length === 0) {
            return createErrorResponse(
                400,
                "invalid_input",
                "Input text is required.",
                false
            );
        }

        if (text.length > 5000) {
            return createErrorResponse(
                400,
                "input_too_long",
                "Input is too long. Max 5000 characters.",
                false
            );
        }

        const inputHash = generateInputHash(text);
        console.log(`Checking cache for Hash: ${inputHash} | Input: "${text.substring(0, 50)}..."`);

        const { data: cachedCheck, error: cacheError } = await supabase
            .from("checks")
            .select("id, input_text, verdict, confidence, summary, why_reasoning, sources, created_at")
            .eq("input_hash", inputHash)
            .maybeSingle<StoredCheckRecord>();

        if (cacheError) {
            console.error("Supabase Cache Lookup Error:", cacheError);
        } else if (cachedCheck && !isStaleTechnicalFailure(cachedCheck)) {
            console.log("CACHE HIT! Returning instant result from Supabase.");
            return NextResponse.json({
                success: true,
                cached: true,
                data: cachedCheck,
            });
        } else if (cachedCheck) {
            console.warn(`Ignoring stale technical failure cache row: ${cachedCheck.id}`);
        }

        const dailyCheckLimit = getDailyCheckLimit();

        if (dailyCheckLimit === 0) {
            return createErrorResponse(
                429,
                "daily_limit_reached",
                "Daily free quota reached. Try again tomorrow.",
                false
            );
        }

        const { count: dailyFreshChecks, error: dailyCountError } = await supabase
            .from("checks")
            .select("id", { count: "exact", head: true })
            .gte("created_at", getUtcDayStartIso());

        if (dailyCountError) {
            console.error("Supabase Daily Limit Lookup Error:", dailyCountError);
        } else if ((dailyFreshChecks ?? 0) >= dailyCheckLimit) {
            console.warn(
                `Daily free-tier limit reached: ${dailyFreshChecks}/${dailyCheckLimit}`
            );
            return createErrorResponse(
                429,
                "daily_limit_reached",
                "Daily free quota reached. Try again tomorrow.",
                false
            );
        }

        console.log("CACHE MISS. Asking Gemini Analysis...");
        const aiResult = await checkFactWithGeminiDetailed(text);
        const responseData = {
            id: crypto.randomUUID(),
            input_text: text,
            verdict: aiResult.verdict,
            confidence: aiResult.confidence,
            summary: aiResult.summary,
            why_reasoning: aiResult.why_reasoning,
            sources: aiResult.sources,
            created_at: new Date().toISOString(),
        };

        const insertPayload = {
            input_text: text,
            input_hash: inputHash,
            input_type: normalizeInputForHash(text).startsWith("http") ? "url" : "headline",
            verdict: aiResult.verdict,
            confidence: aiResult.confidence,
            summary: aiResult.summary,
            why_reasoning: aiResult.why_reasoning,
            sources: aiResult.sources,
            model_used: GEMINI_MODEL,
        };

        const { data: insertedCheck, error: insertError } = await supabase
            .from("checks")
            .insert(insertPayload)
            .select("id, input_text, verdict, confidence, summary, why_reasoning, sources, created_at")
            .single<StoredCheckRecord>();

        if (insertError) {
            console.error("Supabase Insert Error:", insertError);
            return NextResponse.json({
                success: true,
                cached: false,
                data: responseData,
            });
        }

        console.log("Analysis complete and saved to cache.");
        return NextResponse.json({
            success: true,
            cached: false,
            data: insertedCheck,
        });
    } catch (error) {
        if (error instanceof GeminiServiceError) {
            console.error("API /check Gemini Error:", error);
            return mapGeminiErrorToResponse(error);
        }

        console.error("API /check Error:", error);
        return createErrorResponse(
            500,
            "internal_error",
            "Internal Server Error processing your request.",
            false
        );
    }
}
