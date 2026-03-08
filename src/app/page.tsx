"use client";

import React, { useState } from "react";
import NewsCard, { NewsItem } from "./components/NewsCard";
import DetailedResultCard, { CheckResult } from "./components/DetailedResultCard";

const REQUEST_TIMEOUT_MS = 15000;
const NETWORK_ERROR_MESSAGE =
  "Live checks are unavailable because the app server on this origin is not responding.";
const AI_UNAVAILABLE_MESSAGE =
  "Live AI checks are temporarily unavailable. Please retry in a moment.";

type CheckApiSuccessResponse = {
  success: true;
  cached: boolean;
  data: CheckResult;
};

type CheckApiErrorResponse = {
  success: false;
  error: string;
  errorCode: "invalid_input" | "input_too_long" | "quota_exceeded" | "provider_unavailable" | "internal_error";
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

function mapApiErrorToMessage(response: CheckApiErrorResponse): string {
  switch (response.errorCode) {
    case "invalid_input":
    case "input_too_long":
      return response.error;
    case "quota_exceeded":
    case "provider_unavailable":
      return AI_UNAVAILABLE_MESSAGE;
    default:
      return "Something went wrong while checking this claim. Please try again.";
  }
}

function mapRequestErrorToMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return AI_UNAVAILABLE_MESSAGE;
  }

  if (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|networkerror|load failed/i.test(error.message))
  ) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Something went wrong while checking this claim. Please try again.";
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
  const [error, setError] = useState("");

  const handleCheck = async () => {
    if (!inputText.trim()) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    setIsLoading(true);
    setError("");
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
          throw new Error(mapApiErrorToMessage(payload));
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
      setError(mapRequestErrorToMessage(err));
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const fillExample = (text: string) => {
    setInputText(text);
    setError("");
  };

  const showLocalPortHint = error === NETWORK_ERROR_MESSAGE;

  return (
    <div className="min-h-screen p-6 sm:p-10 font-[family-name:var(--font-geist-sans)] flex flex-col items-center">
      <header className="w-full max-w-5xl flex items-center justify-between mb-16 sm:mb-24 mt-4 fade-in-up">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20">
            R
          </div>
          <div>
            <h1 className="font-bold text-2xl tracking-tight leading-none text-white/90">
              RealNews<span className="text-blue-400">.tech</span>
            </h1>
            <p className="text-[11px] uppercase tracking-widest text-white/50 mt-1 font-semibold">
              AI-assisted credibility checks
            </p>
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl flex flex-col items-center text-center flex-grow">
        {result ? (
          <DetailedResultCard result={result} isCached={isCached} />
        ) : (
          <>
            <div className="fade-in-up" style={{ animationDelay: "100ms" }}>
              <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/60">
                Check the facts. <br className="hidden sm:block" /> Ignore the noise.
              </h2>
              <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed mb-10 font-medium">
                Paste a headline, claim, or link - get a clear credibility verdict in seconds.
              </p>
            </div>

            <div className="w-full max-w-2xl relative group fade-in-up" style={{ animationDelay: "200ms" }}>
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
              <div className="relative bg-white/5 border border-white/10 rounded-2xl p-2 flex items-center backdrop-blur-xl shadow-2xl overflow-hidden focus-within:border-blue-500/50 transition-colors">
                <div className="pl-4 pr-2 text-white/30">
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
                  className="w-full bg-transparent border-none text-white placeholder-white/30 text-lg sm:text-xl py-4 focus:outline-none focus:ring-0 disabled:opacity-50"
                />
                <button
                  onClick={() => void handleCheck()}
                  disabled={isLoading || !inputText.trim()}
                  className="hidden sm:flex bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white font-semibold py-3 px-8 rounded-xl transition-all shadow-lg shadow-blue-500/25 items-center gap-2 flex-shrink-0"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Check now
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-left shadow-lg shadow-red-950/20">
                  <p className="text-sm font-medium text-red-200">{error}</p>
                  {showLocalPortHint && (
                    <p className="mt-2 text-xs text-red-100/70">
                      Local tip: run the app on http://localhost:3000. A stale port or stopped dev server prevents /api/check from responding.
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => void handleCheck()}
              disabled={isLoading || !inputText.trim()}
              className="sm:hidden w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 fade-in-up disabled:opacity-50"
              style={{ animationDelay: "300ms" }}
            >
              {isLoading ? "Analyzing..." : "Check now"}
            </button>

            {!isLoading && (
              <div className="w-full mt-8 flex flex-wrap justify-center gap-3 fade-in-up" style={{ animationDelay: "300ms" }}>
                <span className="text-xs text-white/30 uppercase tracking-widest font-semibold w-full block mb-1">Try an example</span>
                <button
                  onClick={() => fillExample("Coffee reverses aging")}
                  className="text-xs px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  &quot;Coffee reverses aging&quot;
                </button>
                <button
                  onClick={() => fillExample("Eiffel Tower moving to Dubai")}
                  className="text-xs px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  &quot;Eiffel Tower moving to Dubai&quot;
                </button>
                <button
                  onClick={() => fillExample("Fed cuts interest rates by 0.5%")}
                  className="text-xs px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  &quot;Fed cuts interest rates by 0.5%&quot;
                </button>
              </div>
            )}

            {!isLoading && (
              <div className="w-full mt-24 mb-12 fade-in-up text-left" style={{ animationDelay: "400ms" }}>
                <div className="flex items-center gap-3 mb-8 pl-2">
                  <div className="h-px bg-white/10 flex-grow" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/30">Example results</span>
                  <div className="h-px bg-white/10 flex-grow" />
                </div>

                <div className="flex flex-col gap-6">
                  <div className="w-full">
                    <NewsCard item={DEMO_CARDS[0]} index={0} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <NewsCard item={DEMO_CARDS[1]} index={1} />
                    <NewsCard item={DEMO_CARDS[2]} index={2} />
                  </div>
                </div>
              </div>
            )}

            {!isLoading && (
              <section className="w-full max-w-4xl mt-16 p-8 rounded-3xl bg-white/[0.02] border border-white/5 fade-in-up" style={{ animationDelay: "500ms" }}>
                <h3 className="text-lg font-bold text-white/80 mb-6">How RealNews works</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
                  <div>
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 mx-auto sm:mx-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-white/90 mb-2">1. Analyze</h4>
                    <p className="text-xs text-white/50 leading-relaxed">We break down the core claims of the headline or article you paste.</p>
                  </div>
                  <div>
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4 mx-auto sm:mx-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-white/90 mb-2">2. Cross-Reference</h4>
                    <p className="text-xs text-white/50 leading-relaxed">Our AI agent searches trusted databases and primary sources for corroboration.</p>
                  </div>
                  <div>
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 mx-auto sm:mx-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-white/90 mb-2">3. Verdict</h4>
                    <p className="text-xs text-white/50 leading-relaxed">You get a clear label (Verified, Misleading, Likely false) and the reasoning behind it.</p>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-start gap-4 text-left bg-yellow-500/5 p-4 rounded-xl border-l-4 border-l-yellow-500/50">
                  <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-semibold text-white/80">AI-assisted analysis</h4>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed">
                      Our AI system provides a preliminary credibility check. Artificial Intelligence can occasionally hallucinate or miss recent context. Always verify important claims with multiple primary sources yourself.
                    </p>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mt-20 border-t border-white/5 pt-8 text-center pb-8 w-full max-w-5xl">
        <p className="text-xs text-white/30">
          RealNews.tech &copy; {new Date().getFullYear()} - Preliminary AI Claim Check
        </p>
      </footer>
    </div>
  );
}
