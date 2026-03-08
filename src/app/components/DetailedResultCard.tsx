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
    created_at: string;
}

const statusConfig: Record<FactStatus, { label: string; icon: string; class: string; color: string }> = {
    verified: { label: "Verified", icon: "✓", class: "badge-verified", color: "#22c55e" },
    misleading: { label: "Misleading", icon: "⚠", class: "badge-misleading", color: "#f59e0b" },
    false: { label: "Likely false", icon: "✕", class: "badge-false", color: "#ef4444" },
    unverified: { label: "Unverified", icon: "?", class: "badge-unverified", color: "#64748b" },
};

export default function DetailedResultCard({ result, isCached }: { result: CheckResult; isCached?: boolean }) {
    const status = statusConfig[result.verdict];

    return (
        <div className="w-full glass-card p-6 sm:p-8 fade-in-up border-blue-500/20 shadow-[0_0_50px_-12px_rgba(59,130,246,0.25)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex flex-wrap items-center gap-3">
                    <span className={`badge ${status.class} text-sm py-1.5 px-4`}>
                        <span className="text-lg mr-1">{status.icon}</span>
                        {status.label}
                    </span>
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                        <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-1000"
                                style={{ width: `${result.confidence}%`, backgroundColor: status.color }}
                            />
                        </div>
                        <span className="text-xs font-bold text-white/50">{result.confidence}% Confidence</span>
                    </div>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold text-right">
                    {isCached ? "Cached Analysis" : "Fresh AI Scan"} • {new Date(result.created_at).toLocaleTimeString()}
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-[11px] uppercase tracking-[0.2em] text-blue-400 font-bold mb-2">Original Claim</h3>
                <p className="text-lg sm:text-xl font-medium text-white/90 italic leading-relaxed">
                    &ldquo;{result.input_text}&rdquo;
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                <div>
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-bold mb-4">AI Scan Summary</h3>
                    <p className="text-white/70 leading-relaxed italic text-sm sm:text-base">
                        {result.summary}
                    </p>
                </div>

                <div>
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-bold mb-4">Why this rating?</h3>
                    <ul className="space-y-3">
                        {result.why_reasoning.map((point, i) => (
                            <li key={i} className="flex gap-3 text-sm text-white/60 leading-relaxed">
                                <span className="text-blue-500 font-bold">•</span>
                                {point}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {result.sources.length > 0 && (
                <div className="mt-10 pt-8 border-t border-white/5">
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-bold mb-4">Suggested Sources for Verification</h3>
                    <div className="flex flex-wrap gap-3">
                        {result.sources.map((src, i) => (
                            <a
                                key={i}
                                href={src.url !== "#" ? src.url : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all flex items-center gap-2 group"
                            >
                                {src.title}
                                <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-8 flex justify-center">
                <button
                    onClick={() => window.location.reload()}
                    className="text-[10px] uppercase tracking-widest text-white/20 hover:text-white/40 transition-colors font-bold"
                >
                    ← Check another headline
                </button>
            </div>
        </div>
    );
}
