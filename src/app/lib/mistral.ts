import { FactStatus } from "../components/NewsCard";
import type { DetailedFactCheckResult } from "./gemini";

export const MISTRAL_MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";

const mistralApiKey = process.env.MISTRAL_API_KEY;
const VALID_FACT_STATUSES: FactStatus[] = [
    "verified",
    "misleading",
    "false",
    "unverified",
];

type MistralChatResponse = {
    choices?: Array<{
        message?: {
            content?: string | Array<{ type?: string; text?: string }>;
        };
    }>;
    error?: {
        message?: string;
    };
};

export class MistralServiceError extends Error {
    status: number;
    retryable: boolean;

    constructor(message: string, status: number, retryable = true) {
        super(message);
        this.name = "MistralServiceError";
        this.status = status;
        this.retryable = retryable;
    }
}

export function isMistralConfigured(): boolean {
    return Boolean(mistralApiKey);
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

function extractContent(response: MistralChatResponse): string {
    const content = response.choices?.[0]?.message?.content;

    if (typeof content === "string") {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map((item) => item.text ?? "")
            .join("")
            .trim();
    }

    throw new MistralServiceError("Mistral returned an empty response.", 502);
}

function normalizeMistralError(error: unknown): MistralServiceError {
    if (error instanceof MistralServiceError) {
        return error;
    }

    const status =
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
            ? (error as { status: number }).status
            : 503;
    const message = error instanceof Error ? error.message : "Unknown Mistral error";

    if (status === 429 || /rate limit|quota|too many requests|429/i.test(message)) {
        return new MistralServiceError("Mistral quota exceeded.", 429, true);
    }

    if (/fetch|network|timed out|timeout|econn|enotfound|eai_again|socket/i.test(message)) {
        return new MistralServiceError("Mistral service is temporarily unavailable.", 503, true);
    }

    if (/unexpected token|json/i.test(message)) {
        return new MistralServiceError("Mistral returned an invalid JSON response.", 502, true);
    }

    return new MistralServiceError("Mistral request failed.", status, status >= 500);
}

export async function checkFactWithMistralDetailed(
    text: string
): Promise<DetailedFactCheckResult> {
    if (!mistralApiKey) {
        throw new MistralServiceError("Mistral API key is not configured.", 503);
    }

    try {
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mistralApiKey}`,
            },
            body: JSON.stringify({
                model: MISTRAL_MODEL,
                response_format: { type: "json_object" },
                temperature: 0.2,
                max_tokens: 600,
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a cautious claim analysis assistant. You do not have live internet or search access. Never claim you verified a current fact online. For current or ambiguous claims prefer 'unverified'. Only use 'false' when a claim is obviously false from broad common knowledge. Respond as JSON only.",
                    },
                    {
                        role: "user",
                        content: `Analyze this claim with no live web verification available.\n\nClaim: "${text}"\n\nReturn JSON with:\n- verdict: one of verified, misleading, false, unverified\n- confidence: integer 0-100\n- summary: 1-2 sentence cautious analysis\n- why_reasoning: array of 2-4 short strings\n- sources: empty array`,
                    },
                ],
            }),
        });

        const payload = (await response.json()) as MistralChatResponse;

        if (!response.ok) {
            throw new MistralServiceError(
                payload.error?.message ?? "Mistral request failed.",
                response.status,
                response.status >= 500 || response.status === 429
            );
        }

        const rawContent = extractContent(payload);
        const parsed = JSON.parse(rawContent) as {
            verdict?: unknown;
            confidence?: unknown;
            summary?: unknown;
            why_reasoning?: unknown;
        };

        return {
            verdict: normalizeFactStatus(parsed.verdict),
            confidence: normalizeConfidence(parsed.confidence, 35),
            summary: normalizeString(
                parsed.summary,
                "Fallback analysis mode is active. This claim has not been verified against live web sources."
            ),
            why_reasoning: normalizeStringArray(parsed.why_reasoning, 4),
            sources: [],
        };
    } catch (error) {
        throw normalizeMistralError(error);
    }
}
