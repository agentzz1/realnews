import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/app/lib/supabase";
import {
    GEMINI_MODEL,
    type DetailedFactCheckResult,
    GeminiServiceError,
    checkFactWithGeminiDetailed,
} from "@/app/lib/gemini";
import {
    MISTRAL_MODEL,
    MistralServiceError,
    checkFactWithMistralDetailed,
    isMistralConfigured,
} from "@/app/lib/mistral";

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
    model_used?: string;
    created_at: string;
};

type LiveAnalysis = {
    aiResult: DetailedFactCheckResult;
    modelUsed: string;
};

type GeminiAvailability = {
    allowGemini: boolean;
    dailyLimitReached: boolean;
};

type SupabaseWriteError = {
    code?: string;
    details?: string | null;
    hint?: string | null;
    message?: string;
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

function isMistralFallbackRecord(
    record: Partial<StoredCheckRecord> | null | undefined
) {
    return (record?.model_used ?? "").toLowerCase().includes("mistral");
}

function isSupabaseRlsWriteError(error: unknown): error is SupabaseWriteError {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "42501"
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

function mapMistralErrorToResponse(error: MistralServiceError) {
    return createErrorResponse(
        error.status === 429 ? 429 : 503,
        "provider_unavailable",
        "Fallback analysis is temporarily unavailable. Please retry in a moment.",
        error.retryable
    );
}

async function runLiveAnalysis(text: string, allowGemini: boolean): Promise<LiveAnalysis> {
    let lastGeminiError: GeminiServiceError | null = null;

    if (allowGemini) {
        try {
            const aiResult = await checkFactWithGeminiDetailed(text);
            return {
                aiResult,
                modelUsed: GEMINI_MODEL,
            };
        } catch (error) {
            if (error instanceof GeminiServiceError) {
                lastGeminiError = error;
                console.warn(
                    `Gemini live verification failed (${error.code}).` +
                        (isMistralConfigured()
                            ? " Falling back to Mistral analysis mode."
                            : "")
                );
            } else {
                throw error;
            }
        }
    }

    if (isMistralConfigured()) {
        const aiResult = await checkFactWithMistralDetailed(text);
        return {
            aiResult,
            modelUsed: MISTRAL_MODEL,
        };
    }

    if (lastGeminiError) {
        throw lastGeminiError;
    }

    throw new MistralServiceError("Mistral fallback is not configured.", 503, false);
}

async function getGeminiAvailability(): Promise<GeminiAvailability> {
    const dailyCheckLimit = getDailyCheckLimit();

    if (dailyCheckLimit === 0) {
        return {
            allowGemini: false,
            dailyLimitReached: true,
        };
    }

    const { count: dailyFreshChecks, error: dailyCountError } = await supabase
        .from("checks")
        .select("id", { count: "exact", head: true })
        .eq("model_used", GEMINI_MODEL)
        .gte("created_at", getUtcDayStartIso());

    if (dailyCountError) {
        console.error("Supabase Daily Limit Lookup Error:", dailyCountError);
        return {
            allowGemini: true,
            dailyLimitReached: false,
        };
    }

    const dailyLimitReached = (dailyFreshChecks ?? 0) >= dailyCheckLimit;

    if (dailyLimitReached) {
        console.warn(
            `Daily Gemini free-tier limit reached: ${dailyFreshChecks}/${dailyCheckLimit}`
        );
    }

    return {
        allowGemini: !dailyLimitReached,
        dailyLimitReached,
    };
}

function createResponseData(
    text: string,
    aiResult: DetailedFactCheckResult,
    modelUsed: string
) {
    return {
        id: crypto.randomUUID(),
        input_text: text,
        verdict: aiResult.verdict,
        confidence: aiResult.confidence,
        summary: aiResult.summary,
        why_reasoning: aiResult.why_reasoning,
        sources: aiResult.sources,
        model_used: modelUsed,
        created_at: new Date().toISOString(),
    };
}

async function saveCheckResult(
    inputHash: string,
    text: string,
    aiResult: DetailedFactCheckResult,
    modelUsed: string
) {
    const insertPayload = {
        input_text: text,
        input_hash: inputHash,
        input_type: normalizeInputForHash(text).startsWith("http") ? "url" : "headline",
        verdict: aiResult.verdict,
        confidence: aiResult.confidence,
        summary: aiResult.summary,
        why_reasoning: aiResult.why_reasoning,
        sources: aiResult.sources,
        model_used: modelUsed,
    };

    return await supabase
        .from("checks")
        .upsert(insertPayload, { onConflict: "input_hash" })
        .select(
            "id, input_text, verdict, confidence, summary, why_reasoning, sources, model_used, created_at"
        )
        .single<StoredCheckRecord>();
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
            .select(
                "id, input_text, verdict, confidence, summary, why_reasoning, sources, model_used, created_at"
            )
            .eq("input_hash", inputHash)
            .maybeSingle<StoredCheckRecord>();

        const hasUsableCache = Boolean(cachedCheck) && !isStaleTechnicalFailure(cachedCheck);
        const hasFallbackCache = hasUsableCache && isMistralFallbackRecord(cachedCheck);

        if (cacheError) {
            console.error("Supabase Cache Lookup Error:", cacheError);
        } else if (hasUsableCache && !hasFallbackCache) {
            console.log("CACHE HIT! Returning instant result from Supabase.");
            return NextResponse.json({
                success: true,
                cached: true,
                data: cachedCheck,
            });
        } else if (hasFallbackCache) {
            console.log(
                "Fallback cache hit found. Will try to upgrade it with Gemini if quota allows."
            );
        } else if (cachedCheck) {
            console.warn(`Ignoring stale technical failure cache row: ${cachedCheck.id}`);
        }

        const mistralConfigured = isMistralConfigured();
        const geminiAvailability = await getGeminiAvailability();
        const allowGemini = geminiAvailability.allowGemini;

        if (!allowGemini && hasFallbackCache) {
            console.log("Keeping cached fallback because Gemini daily quota is still exhausted.");
            return NextResponse.json({
                success: true,
                cached: true,
                data: cachedCheck,
            });
        }

        if (!allowGemini && !mistralConfigured) {
            return createErrorResponse(
                429,
                "daily_limit_reached",
                "Daily free quota reached. Try again tomorrow.",
                false
            );
        }

        if (hasFallbackCache && allowGemini) {
            try {
                console.log("Attempting to refresh cached fallback with Gemini verification.");
                const aiResult = await checkFactWithGeminiDetailed(text);
                const responseData = createResponseData(text, aiResult, GEMINI_MODEL);
                const { data: savedCheck, error: saveError } = await saveCheckResult(
                    inputHash,
                    text,
                    aiResult,
                    GEMINI_MODEL
                );

                if (saveError) {
                    if (isSupabaseRlsWriteError(saveError)) {
                        console.warn(
                            "Could not replace cached fallback row because the current Supabase policy blocks updates. Returning the fresh Gemini result without cache refresh."
                        );
                    } else {
                        console.error(
                            "Supabase Upsert Error while upgrading fallback:",
                            saveError
                        );
                    }
                    return NextResponse.json({
                        success: true,
                        cached: false,
                        data: responseData,
                    });
                }

                console.log("Fallback cache upgraded to Gemini verification.");
                return NextResponse.json({
                    success: true,
                    cached: false,
                    data: savedCheck,
                });
            } catch (error) {
                if (error instanceof GeminiServiceError) {
                    console.warn(
                        `Gemini refresh failed (${error.code}). Returning cached fallback instead.`
                    );
                    return NextResponse.json({
                        success: true,
                        cached: true,
                        data: cachedCheck,
                    });
                }

                throw error;
            }
        }

        console.log(
            allowGemini
                ? "CACHE MISS. Asking Gemini for live verification..."
                : "CACHE MISS. Using Mistral fallback analysis mode..."
        );
        const { aiResult, modelUsed } = await runLiveAnalysis(text, allowGemini);
        const responseData = createResponseData(text, aiResult, modelUsed);
        const { data: insertedCheck, error: insertError } = await saveCheckResult(
            inputHash,
            text,
            aiResult,
            modelUsed
        );

        if (insertError) {
            console.error("Supabase Upsert Error:", insertError);
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

        if (error instanceof MistralServiceError) {
            console.error("API /check Mistral Error:", error);
            return mapMistralErrorToResponse(error);
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
