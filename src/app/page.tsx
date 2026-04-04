"use client";

import React, { useState } from "react";
import NewsCard, { NewsItem } from "./components/NewsCard";
import DetailedResultCard, { CheckResult } from "./components/DetailedResultCard";
import { Reveal } from "./components/reveal";

const REQUEST_TIMEOUT_MS = 15000;
const NETWORK_ERROR_MESSAGE =
  "Live checks are unavailable because the app server on this origin is not responding.";
const AI_UNAVAILABLE_MESSAGE =
  "Live AI checks are temporarily unavailable. Please retry in a moment.";
const DAILY_LIMIT_MESSAGE = "Daily free quota reached. Try again tomorrow.";

type FeedbackTone = "danger" | "warning";

type InlineFeedback = {
  message: string;
  hint?: string;
  tone: FeedbackTone;
};

type CheckApiSuccessResponse = {
  success: true;
  cached: boolean;
  data: CheckResult;
};

type CheckApiErrorResponse = {
  success: false;
  error: string;
  errorCode:
  | "invalid_input"
  | "input_too_long"
  | "daily_limit_reached"
  | "quota_exceeded"
  | "provider_unavailable"
  | "internal_error";
  retryable: boolean;
};

type CheckApiResponse = CheckApiSuccessResponse | CheckApiErrorResponse;

const DEMO_CARDS: NewsItem[] = [
  {
    id: "demo-1",
    title: "Federal Reserve announces unexpected 0.5% interest rate cut ahead of schedule",
    summary: "The central bank surprised markets today by slashing rates, citing rapidly cooling inflation and a softening labor market.",
    source: "Financial News Network",
    sourceUrl: "#",
    category: "Economy",
    publishedAt: new Date().toISOString(),
    factStatus: "verified",
    confidence: 92,
    factCheckSummary: "Multiple major financial outlets and the official Federal Reserve press release confirm the 0.5% rate cut announcement occurred today as described.",
    sources: ["Federal Reserve Press Release", "WSJ", "Bloomberg"],
  },
  {
    id: "demo-2",
    title: "New study proves drinking 4 cups of coffee daily reverses aging process",
    summary: "A groundbreaking new study from a Swiss research institute claims that heavy coffee consumption actively reverses cellular aging.",
    source: "HealthDailyViral",
    sourceUrl: "#",
    category: "Health",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    factStatus: "misleading",
    confidence: 85,
    factCheckSummary: "The headline exaggerates the findings. The actual study observed a moderate correlation between coffee compounds and slower telomere degradation in mice, not age reversal in humans.",
    sources: ["Nature Communications (Original Study)", "WHO Health Guidelines"],
  },
  {
    id: "demo-3",
    title: "Eiffel Tower to be dismantled and relocated to Dubai for 2030 Expo",
    summary: "French officials have reportedly agreed to a multi-billion dollar deal to permanently move the iconic landmark.",
    source: "GlobalNewsSatire",
    sourceUrl: "#",
    category: "World News",
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    factStatus: "false",
    confidence: 98,
    factCheckSummary: "There is no evidence or official statement supporting this claim. It originated from a known satirical website and was mistaken for genuine news.",
    sources: ["Paris Mayor's Office", "French Ministry of Culture", "Reuters Fact Check"],
  },
];

function isCheckApiErrorResponse(value: unknown): value is CheckApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    (value as { success?: unknown }).success === false &&
    typeof (value as { error?: unknown }).error === "string" &&
    typeof (value as { errorCode?: unknown }).errorCode === "string"
  );
}

function isCheckApiSuccessResponse(value: unknown): value is CheckApiSuccessResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    (value as { success?: unknown }).success === true &&
    "data" in value
  );
}

function mapApiErrorToFeedback(response: CheckApiErrorResponse): InlineFeedback {
  switch (response.errorCode) {
    case "invalid_input":
    case "input_too_long":
      return {
        message: response.error,
        tone: "danger",
      };
    case "daily_limit_reached":
      return {
        message: DAILY_LIMIT_MESSAGE,
        hint: "Live AI is paused for today. You can still explore the example results below.",
        tone: "warning",
      };
    case "quota_exceeded":
      return {
        message: DAILY_LIMIT_MESSAGE,
        hint: "Gemini free tier looks exhausted right now. The example results below still show how the product works.",
        tone: "warning",
      };
    case "provider_unavailable":
      return {
        message: AI_UNAVAILABLE_MESSAGE,
        hint: "Live AI is down for the moment. You can still explore the example results below.",
        tone: "warning",
      };
    default:
      return {
        message: "Something went wrong while checking this claim. Please try again.",
        tone: "danger",
      };
  }
}

function mapRequestErrorToFeedback(error: unknown): InlineFeedback {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      message: AI_UNAVAILABLE_MESSAGE,
      hint: "The request timed out before Gemini responded. You can still explore the example results below.",
      tone: "warning",
    };
  }

  if (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message))
  ) {
    return {
      message: NETWORK_ERROR_MESSAGE,
      hint: "Local tip: run the app on http://localhost:3000. A stale port or stopped dev server prevents /api/check from responding.",
      tone: "danger",
    };
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return {
      message: error.message,
      tone: error.message === DAILY_LIMIT_MESSAGE ? "warning" : "danger",
      hint:
        error.message === DAILY_LIMIT_MESSAGE
          ? "Live AI is paused for today. You can still explore the example results below."
          : undefined,
    };
  }

  return {
    message: "Something went wrong while checking this claim. Please try again.",
    tone: "danger",
  };
}

async function parseCheckResponse(response: Response): Promise<CheckApiResponse | null> {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CheckApiResponse;
  } catch {
    return null;
  }
}

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [feedback, setFeedback] = useState<InlineFeedback | null>(null);

  const handleCheck = async () => {
    if (!inputText.trim()) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let apiErrorFeedback: InlineFeedback | null = null;

    setIsLoading(true);
    setFeedback(null);
    setResult(null);
    setIsCached(false);

    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
        signal: controller.signal,
      });

      const payload = await parseCheckResponse(response);

      if (!response.ok) {
        if (payload && isCheckApiErrorResponse(payload)) {
          apiErrorFeedback = mapApiErrorToFeedback(payload);
          throw new Error(apiErrorFeedback.message);
        }

        throw new Error(
          response.status >= 500
            ? AI_UNAVAILABLE_MESSAGE
            : "Something went wrong while checking this claim. Please try again."
        );
      }

      if (!payload || !isCheckApiSuccessResponse(payload)) {
        throw new Error("The server returned an unexpected response.");
      }

      setResult(payload.data);
      setIsCached(payload.cached);
    } catch (err: unknown) {
      setFeedback(apiErrorFeedback ?? mapRequestErrorToFeedback(err));
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const fillExample = (text: string) => {
    setInputText(text);
    setFeedback(null);
  };

  const feedbackClasses =
    feedback?.tone === "warning"
      ? "border-amber-500/20 bg-amber-500/10 shadow-amber-950/20"
      : "border-red-500/20 bg-red-500/10 shadow-red-950/20";
  const feedbackTextClasses =
    feedback?.tone === "warning"
      ? "text-amber-100"
      : "text-red-200";
  const feedbackHintClasses =
    feedback?.tone === "warning"
      ? "text-amber-100/70"
      : "text-red-100/70";

  return (
    <div className="flex min-h-screen flex-col items-center">
      <header className="container-shell sticky top-0 z-40 pt-4 pb-4">
        <div className="surface-card flex items-center justify-between gap-4 px-4 py-3 md:px-5 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[0.85rem] bg-gradient-to-tr from-blue-700 to-sky-400 text-xl font-black text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              R
            </span>
            <div>
              <p className="heading-display text-xl font-bold leading-none text-foreground">
                RealNews<span className="text-[color:var(--brand-strong)]">.tech</span>
              </p>
              <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                AI Fact-Checking
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container-shell flex-1">
        {result ? (
          <div className="max-w-4xl mx-auto pt-8 pb-16">
            <DetailedResultCard result={result} isCached={isCached} />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* ─── HERO ─────────────────────────────────── */}
            <section className="flex flex-col items-center justify-center text-center pt-16 pb-16 md:pt-24 md:pb-24 max-w-3xl w-full">
              <span className="eyebrow fade-in-up">
                AI-Assisted Credibility Checks
              </span>
              <h1 className="heading-display text-balance mt-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl fade-in-up" style={{ animationDelay: "100ms" }}>
                Check the facts.
                <br />
                <span className="bg-gradient-to-r from-[color:var(--brand)] to-sky-400 bg-clip-text text-transparent">
                  Ignore the noise.
                </span>
              </h1>
              <p className="text-balance mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted)] sm:text-xl fade-in-up" style={{ animationDelay: "200ms" }}>
                Paste a headline, claim, or link below and get a clear credibility verdict in seconds, powered by AI cross-referencing.
              </p>

              <div className="w-full mt-10 relative group fade-in-up" style={{ animationDelay: "300ms" }}>
                <div className="absolute -inset-1.5 bg-gradient-to-r from-[color:var(--brand)] to-purple-500 rounded-3xl blur-md opacity-25 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative surface-card p-2 flex items-center border border-[color:var(--border)] focus-within:border-[color:var(--brand)] transition-colors">
                  <div className="pl-5 pr-3 text-[color:var(--muted)]">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleCheck()}
                    placeholder={isLoading ? "Analyzing claim patterns..." : "Paste a headline or claim here..."}
                    disabled={isLoading}
                    className="w-full bg-transparent border-none text-foreground placeholder-[color:var(--muted)] text-lg py-4 focus:outline-none focus:ring-0 disabled:opacity-50"
                  />
                  <button
                    onClick={() => void handleCheck()}
                    disabled={isLoading || !inputText.trim()}
                    className="hidden sm:flex items-center gap-2 bg-[color:var(--brand)] hover:bg-[color:var(--brand-strong)] disabled:bg-gray-800 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg flex-shrink-0"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Check now
                      </>
                    )}
                  </button>
                </div>

                {feedback && (
                  <div className={`mt-4 rounded-xl border px-5 py-4 text-left shadow-lg ${feedbackClasses}`}>
                    <p className={`text-sm font-bold ${feedbackTextClasses}`}>{feedback.message}</p>
                    {feedback.hint && (
                      <p className={`mt-2 text-xs font-medium ${feedbackHintClasses}`}>
                        {feedback.hint}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => void handleCheck()}
                disabled={isLoading || !inputText.trim()}
                className="sm:hidden w-full mt-4 bg-[color:var(--brand)] hover:bg-[color:var(--brand-strong)] text-white font-bold py-4 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 fade-in-up disabled:opacity-50"
                style={{ animationDelay: "350ms" }}
              >
                {isLoading ? "Analyzing..." : "Check now"}
              </button>

              {!isLoading && (
                <div className="w-full mt-10 fade-in-up" style={{ animationDelay: "400ms" }}>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--muted)] mb-4">
                    Or try an example
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => fillExample("Coffee reverses aging")}
                      className="text-[11px] font-semibold px-4 py-2 rounded-full border border-[color:var(--border)] bg-white/5 text-[color:var(--muted)] hover:text-foreground hover:bg-[color:var(--brand)] hover:border-transparent transition-all shadow-sm"
                    >
                      Coffee reverses aging
                    </button>
                    <button
                      onClick={() => fillExample("Eiffel Tower moving to Dubai")}
                      className="text-[11px] font-semibold px-4 py-2 rounded-full border border-[color:var(--border)] bg-white/5 text-[color:var(--muted)] hover:text-foreground hover:bg-[color:var(--brand)] hover:border-transparent transition-all shadow-sm"
                    >
                      Eiffel Tower moving to Dubai
                    </button>
                    <button
                      onClick={() => fillExample("Fed cuts interest rates by 0.5%")}
                      className="text-[11px] font-semibold px-4 py-2 rounded-full border border-[color:var(--border)] bg-white/5 text-[color:var(--muted)] hover:text-foreground hover:bg-[color:var(--brand)] hover:border-transparent transition-all shadow-sm"
                    >
                      Fed cuts interest rates by 0.5%
                    </button>
                  </div>
                </div>
              )}
            </section>

            {!isLoading && (
              <Reveal>
                <div className="w-full max-w-4xl section-pad">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="h-px bg-gradient-to-r from-transparent to-[color:var(--border)] flex-grow" />
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--brand-strong)] px-2">Example Results</span>
                    <div className="h-px bg-gradient-to-l from-transparent to-[color:var(--border)] flex-grow" />
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="w-full min-h-[180px]">
                      <NewsCard item={DEMO_CARDS[0]} index={0} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 min-h-[180px]">
                      <NewsCard item={DEMO_CARDS[1]} index={1} />
                      <NewsCard item={DEMO_CARDS[2]} index={2} />
                    </div>
                  </div>
                </div>
              </Reveal>
            )}

            {!isLoading && (
              <Reveal delay={200}>
                <section className="w-full max-w-4xl section-pad pt-0">
                  <div className="surface-card-strong p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.1),_transparent_70%)] lg:block" />
                    <div className="relative z-10">
                      <span className="eyebrow mb-4">Behind the scenes</span>
                      <h3 className="heading-display text-3xl font-bold text-foreground mb-10">How RealNews works</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div>
                          <div className="w-12 h-12 rounded-2xl bg-[color:var(--brand)] flex items-center justify-center text-white mb-5 shadow-lg shadow-blue-500/20">
                            <span className="font-extrabold">01</span>
                          </div>
                          <h4 className="text-lg font-bold text-foreground mb-3">Analyze</h4>
                          <p className="text-sm font-medium text-[color:var(--muted)] leading-relaxed">
                            We break down the core claims of the headline or article you paste using LLM extraction.
                          </p>
                        </div>
                        <div>
                          <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-white mb-5 shadow-lg shadow-purple-500/20">
                            <span className="font-extrabold">02</span>
                          </div>
                          <h4 className="text-lg font-bold text-foreground mb-3">Cross-Reference</h4>
                          <p className="text-sm font-medium text-[color:var(--muted)] leading-relaxed">
                            Our AI agent searches trusted databases and primary sources for real-time corroboration.
                          </p>
                        </div>
                        <div>
                          <div className="w-12 h-12 rounded-2xl bg-[color:var(--accent-green)] flex items-center justify-center text-white mb-5 shadow-lg shadow-green-500/20">
                            <span className="font-extrabold">03</span>
                          </div>
                          <h4 className="text-lg font-bold text-foreground mb-3">Verdict</h4>
                          <p className="text-sm font-medium text-[color:var(--muted)] leading-relaxed">
                            You get a clear label (Verified, Misleading, Likely false) and the exact reasoning behind it.
                          </p>
                        </div>
                      </div>

                      <div className="mt-10 pt-8 border-t border-[color:var(--border)] flex items-start gap-4">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <h4 className="text-sm font-bold text-[color:var(--muted)]">AI-assisted analysis</h4>
                          <p className="text-xs font-medium text-[color:var(--muted)] mt-1.5 leading-relaxed">
                            Our AI provides a preliminary check. AI can occasionally miss recent context. Always verify important claims yourself.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </Reveal>
            )}
          </div>
        )}
      </main>

      <footer className="container-shell pb-8">
        <div className="surface-card px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-[0.6rem] bg-gradient-to-tr from-blue-700 to-sky-400 text-sm font-black text-white">
              R
            </span>
            <span className="text-sm font-bold text-foreground">RealNews.tech</span>
          </div>
          <p className="text-xs font-medium text-[color:var(--muted)]">
            &copy; {new Date().getFullYear()} – Preliminary AI Claim Check
          </p>
        </div>
      </footer>
    </div>
  );
}
