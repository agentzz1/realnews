import {
    GoogleGenerativeAI,
    SchemaType,
    type ResponseSchema,
} from "@google/generative-ai";
import { FactStatus } from "../components/NewsCard";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const geminiApiKey = process.env.GEMINI_API_KEY;
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
const VALID_FACT_STATUSES: FactStatus[] = [
    "verified",
    "misleading",
    "false",
    "unverified",
];

const FACT_CHECK_SCHEMA: ResponseSchema = {
    type: SchemaType.OBJECT,
    properties: {
        factStatus: {
            type: SchemaType.STRING,
            format: "enum",
            enum: VALID_FACT_STATUSES,
        },
        confidence: { type: SchemaType.INTEGER },
        factCheckSummary: { type: SchemaType.STRING },
    },
    required: ["factStatus", "confidence", "factCheckSummary"],
};

const DETAILED_FACT_CHECK_SCHEMA: ResponseSchema = {
    type: SchemaType.OBJECT,
    properties: {
        verdict: {
            type: SchemaType.STRING,
            format: "enum",
            enum: VALID_FACT_STATUSES,
        },
        confidence: { type: SchemaType.INTEGER },
        summary: { type: SchemaType.STRING },
        why_reasoning: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
        },
        sources: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    title: { type: SchemaType.STRING },
                    url: { type: SchemaType.STRING },
                },
                required: ["title", "url"],
            },
        },
    },
    required: ["verdict", "confidence", "summary", "why_reasoning", "sources"],
};

export type GeminiServiceErrorCode =
    | "gemini_not_configured"
    | "gemini_quota_exceeded"
    | "gemini_model_unavailable"
    | "gemini_provider_unavailable"
    | "gemini_invalid_response";

export class GeminiServiceError extends Error {
    code: GeminiServiceErrorCode;
    status: number;
    retryable: boolean;
    cause?: unknown;

    constructor(
        code: GeminiServiceErrorCode,
        message: string,
        status: number,
        retryable: boolean,
        cause?: unknown
    ) {
        super(message);
        this.name = "GeminiServiceError";
        this.code = code;
        this.status = status;
        this.retryable = retryable;
        this.cause = cause;
    }
}

export interface FactCheckResult {
    factStatus: FactStatus;
    confidence: number;
    factCheckSummary: string;
}

export interface DetailedFactCheckResult {
    verdict: FactStatus;
    confidence: number;
    summary: string;
    why_reasoning: string[];
    sources: { title: string; url: string }[];
}

function getGeminiClient(): GoogleGenerativeAI {
    if (!genAI) {
        throw new GeminiServiceError(
            "gemini_not_configured",
            "Gemini API key is not configured.",
            503,
            false
        );
    }

    return genAI;
}

function createStructuredModel(responseSchema: ResponseSchema) {
    return getGeminiClient().getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
        },
    });
}

function normalizeFactStatus(value: unknown): FactStatus {
    return VALID_FACT_STATUSES.includes(value as FactStatus)
        ? (value as FactStatus)
        : "unverified";
}

function normalizeConfidence(value: unknown, fallback: number): number {
    const numericValue = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(numericValue)) {
        return fallback;
    }

    return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function normalizeString(value: unknown, fallback: string): string {
    if (typeof value !== "string") {
        return fallback;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeStringArray(value: unknown, maxItems: number): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems);
}

function normalizeSources(
    value: unknown,
    maxItems: number
): { title: string; url: string }[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is { title?: unknown; url?: unknown } => {
            return typeof item === "object" && item !== null;
        })
        .map((item) => ({
            title: normalizeString(item.title, "Suggested source"),
            url: normalizeString(item.url, "#"),
        }))
        .slice(0, maxItems);
}

function normalizeGeminiError(error: unknown): GeminiServiceError {
    if (error instanceof GeminiServiceError) {
        return error;
    }

    const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
            ? (error as { status: number }).status
            : undefined;
    const message = error instanceof Error ? error.message : "Unknown Gemini error";

    if (status === 429 || /quota|rate limit|too many requests|429/i.test(message)) {
        return new GeminiServiceError(
            "gemini_quota_exceeded",
            "Gemini quota exceeded.",
            429,
            true,
            error
        );
    }

    if (status === 404 || /not found|not supported/i.test(message)) {
        return new GeminiServiceError(
            "gemini_model_unavailable",
            "Configured Gemini model is unavailable.",
            503,
            true,
            error
        );
    }

    if (/unexpected token|json/i.test(message)) {
        return new GeminiServiceError(
            "gemini_invalid_response",
            "Gemini returned an invalid structured response.",
            503,
            true,
            error
        );
    }

    if (
        /fetch|network|timed out|timeout|econn|enotfound|eai_again|socket/i.test(
            message
        ) ||
        (typeof status === "number" && status >= 500)
    ) {
        return new GeminiServiceError(
            "gemini_provider_unavailable",
            "Gemini service is temporarily unavailable.",
            503,
            true,
            error
        );
    }

    return new GeminiServiceError(
        "gemini_provider_unavailable",
        "Gemini request failed.",
        503,
        true,
        error
    );
}

async function generateStructuredContent<T>(
    prompt: string,
    responseSchema: ResponseSchema
): Promise<T> {
    try {
        const result = await createStructuredModel(responseSchema).generateContent(prompt);
        return JSON.parse(result.response.text().trim()) as T;
    } catch (error) {
        throw normalizeGeminiError(error);
    }
}

export async function checkFactWithGemini(
    title: string,
    summary: string
): Promise<FactCheckResult> {
    const prompt = `
    You are an expert, impartial fact-checker for a breaking news platform.
    Analyze the following news article:

    TITLE: ${title}
    SUMMARY: ${summary}

    Determine its factual accuracy. Be strict.

    Respond with a valid JSON object containing:
    1. "factStatus": one of ["verified", "misleading", "false", "unverified"]
    2. "confidence": an integer between 0 and 100
    3. "factCheckSummary": a concise 2-3 sentence explanation
  `;

    const parsed = await generateStructuredContent<{
        factStatus?: unknown;
        confidence?: unknown;
        factCheckSummary?: unknown;
    }>(prompt, FACT_CHECK_SCHEMA);

    return {
        factStatus: normalizeFactStatus(parsed.factStatus),
        confidence: normalizeConfidence(parsed.confidence, 50),
        factCheckSummary: normalizeString(
            parsed.factCheckSummary,
            "Fact-check completed without a clear summary."
        ),
    };
}

export async function checkFactWithGeminiDetailed(
    text: string
): Promise<DetailedFactCheckResult> {
    const prompt = `
    You are an AI-assisted credibility analyzer.
    Analyze the following headline, claim, or news link:

    INPUT: "${text}"

    Evaluate its credibility based on common knowledge and trusted reporting patterns.

    Respond with a valid JSON object containing:
    1. "verdict": one of ["verified", "misleading", "false", "unverified"]
    2. "confidence": an integer between 0 and 100
    3. "summary": a clear 1-2 sentence conclusion
    4. "why_reasoning": 2-4 short bullet points as strings
    5. "sources": 1-3 relevant sources as objects with "title" and "url"

    If you are unsure or the input is ambiguous, use "unverified".
    If the verdict is extremely likely to be false, use "false".
    If it is mostly true but lacks context, use "misleading".
  `;

    const parsed = await generateStructuredContent<{
        verdict?: unknown;
        confidence?: unknown;
        summary?: unknown;
        why_reasoning?: unknown;
        sources?: unknown;
    }>(prompt, DETAILED_FACT_CHECK_SCHEMA);

    return {
        verdict: normalizeFactStatus(parsed.verdict),
        confidence: normalizeConfidence(parsed.confidence, 50),
        summary: normalizeString(parsed.summary, "No summary available."),
        why_reasoning: normalizeStringArray(parsed.why_reasoning, 4),
        sources: normalizeSources(parsed.sources, 3),
    };
}
