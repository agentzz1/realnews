"use client";

import React from "react";
import { FactStatus } from "./NewsCard";

export interface CheckResult {
    id: string;
    input_text: string;
    verdict: FactStatus;
    confidence: number;
    summary: string;
    why_reasoning: string[];
    sources: { title: string; url: string }[];
    model_used?: string;
    created_at: string;
}

const statusConfig: Record<
    FactStatus,
    { label: string; icon: string; class: string; color: string }
> = {
    verified: {
        label: "Verified",
        icon: "\u2713",
        class: "badge-verified",
        color: "#22c55e",
    },
    misleading: {
        label: "Misleading",
        icon: "\u26A0",
        class: "badge-misleading",
        color: "#f59e0b",
    },
    false: {
        label: "Likely false",
        icon: "\u2715",
        class: "badge-false",
        color: "#ef4444",
    },
    unverified: {
        label: "Unverified",
        icon: "?",
        class: "badge-unverified",
        color: "#64748b",
    },
};

export default function DetailedResultCard({
    result,
    isCached,
}: {
    result: CheckResult;
    isCached?: boolean;
}) {
    const status = statusConfig[result.verdict];
    const modelUsed = result.model_used?.trim() ?? "";
    const isFallbackAnalysis = modelUsed.toLowerCase().includes("mistral");
    const freshnessLabel = isCached
        ? isFallbackAnalysis
            ? "Cached fallback"
            : "Cached analysis"
        : isFallbackAnalysis
          ? "Fallback analysis"
          : "Fresh AI scan";

    return (
        <div className="w-full surface-card-strong p-8 sm:p-10 fade-in-up shadow-[0_0_50px_-12px_rgba(37,99,235,0.15)] relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.15),_transparent_70%)] pointer-events-none" />
            
            <div className="relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className={`badge ${status.class} text-sm py-2 px-5 shadow-lg`}>
                            <span className="text-lg mr-2">{status.icon}</span>
                            {status.label}
                        </span>
                        <div className="flex items-center gap-3 bg-white/[0.03] px-4 py-2 rounded-xl border border-[color:var(--border)]">
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full transition-all duration-1000"
                                    style={{
                                        width: `${result.confidence}%`,
                                        backgroundColor: status.color,
                                    }}
                                />
                            </div>
                            <span className="text-xs font-bold text-[color:var(--muted)]">
                                {result.confidence}% Confidence
                            </span>
                        </div>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)] font-bold text-right">
                        {freshnessLabel}
                        {modelUsed ? ` \u2022 ${modelUsed}` : ""}
                        {` \u2022 ${new Date(result.created_at).toLocaleTimeString()}`}
                    </div>
                </div>

                <div className="mb-10 bg-white/[0.02] border border-[color:var(--border)] rounded-[1.6rem] p-6 lg:p-8">
                    <h3 className="eyebrow mb-4">
                        Original Claim
                    </h3>
                    <p className="text-xl sm:text-2xl font-semibold text-foreground leading-relaxed">
                        &ldquo;{result.input_text}&rdquo;
                    </p>
                </div>

                {isFallbackAnalysis && (
                    <div className="mb-10 rounded-[1.6rem] border border-amber-500/20 bg-amber-500/10 p-6 text-left">
                        <p className="text-xs uppercase tracking-[0.2em] text-amber-300 font-bold">
                            Fallback analysis mode
                        </p>
                        <p className="mt-3 text-sm text-amber-100/90 leading-relaxed font-medium">
                            This result was generated without live web verification.
                            Treat it as cautious plausibility analysis, not
                            confirmed fact-checking.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    <div className="surface-card p-6 lg:p-8 !border-[color:var(--border)]">
                        <h3 className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)] font-bold mb-5 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[color:var(--brand-strong)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            AI Scan Summary
                        </h3>
                        <p className="text-[color:var(--foreground)] leading-relaxed font-medium text-sm sm:text-base">
                            {result.summary}
                        </p>
                    </div>

                    <div className="surface-card p-6 lg:p-8 !border-[color:var(--border)]">
                        <h3 className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)] font-bold mb-5 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[color:var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Why this rating?
                        </h3>
                        <ul className="space-y-4">
                            {result.why_reasoning.map((point, index) => (
                                <li
                                    key={index}
                                    className="flex gap-4 text-sm text-[color:var(--muted)] leading-relaxed font-medium"
                                >
                                    <span className="text-[color:var(--brand-strong)] font-bold mt-1">
                                        {"\u2022"}
                                    </span>
                                    {point}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {result.sources.length > 0 && (
                    <div className="mt-10 pt-8 border-t border-[color:var(--border)]">
                        <h3 className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)] font-bold mb-5">
                            Suggested Sources for Verification
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {result.sources.map((src, index) => (
                                <a
                                    key={index}
                                    href={src.url !== "#" ? src.url : undefined}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-semibold px-5 py-3 rounded-xl bg-white/[0.03] border border-[color:var(--border)] text-[color:var(--muted)] hover:text-white hover:bg-[color:var(--brand)] hover:border-transparent transition-all flex items-center gap-2 group shadow-sm hover:shadow-[0_8px_16px_-4px_rgba(37,99,235,0.4)] hover:-translate-y-0.5"
                                >
                                    {src.title}
                                    <svg
                                        className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                        />
                                    </svg>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-12 flex justify-center">
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[color:var(--muted)] hover:text-white transition-colors font-bold px-6 py-3 rounded-full border border-transparent hover:border-[color:var(--border)] hover:bg-white/5"
                    >
                        {"\u2190 Check another claim"}
                    </button>
                </div>
            </div>
        </div>
    );
}
