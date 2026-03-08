import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/app/lib/supabase";
import {
    GEMINI_MODEL,
    GeminiServiceError,
    checkFactWithGeminiDetailed,
} from "@/app/lib/gemini";

const TECHNICAL_FAILURE_SUMMARY = "Analysis failed due to a technical error.";

type CheckApiErrorCode =
    | "invalid_input"
    | "input_too_long"
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

function generateInputHash(input: string): string {
    const normalized = input.trim().toLowerCase().replace(/[\s\n\t]+/g, " ");
    return crypto.createHash("sha256").update(normalized).digest("hex");
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
            "Live AI checks are temporarily unavailable. Please retry in a moment.",
            true
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
            input_type: text.startsWith("http") ? "url" : "headline",
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
