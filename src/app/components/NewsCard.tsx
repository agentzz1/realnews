"use client";

import React from "react";

export type FactStatus = "verified" | "misleading" | "false" | "unverified";

export interface NewsItem {
    id: string;
    title: string;
    summary: string;
    source: string;
    sourceUrl: string;
    category: string;
    publishedAt: string;
    factStatus: FactStatus;
    confidence: number; // 0-100
    factCheckSummary: string;
    sources: string[];
}

const statusConfig: Record<FactStatus, { label: string; icon: string; class: string }> = {
    verified: { label: "Verified", icon: "✓", class: "badge-verified" },
    misleading: { label: "Misleading", icon: "⚠", class: "badge-misleading" },
    false: { label: "Likely false", icon: "✕", class: "badge-false" },
    unverified: { label: "Unverified", icon: "?", class: "badge-unverified" },
};

const confidenceColor: Record<FactStatus, string> = {
    verified: "#22c55e",
    misleading: "#f59e0b",
    false: "#ef4444",
    unverified: "#64748b",
};

function timeAgo(dateStr: string): string {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function NewsCard({
    item,
    index,
}: {
    item: NewsItem;
    index: number;
}) {
    const [expanded, setExpanded] = React.useState(false);
    const status = statusConfig[item.factStatus];

    return (
        <article
            className="glass-card p-5 sm:p-6 cursor-pointer fade-in-up relative overflow-hidden group hover:-translate-y-1 hover:shadow-[0_8px_32px_-8px_rgba(59,130,246,0.15)] hover:border-white/10 transition-all duration-300"
            style={{ animationDelay: `${index * 80}ms` }}
            onClick={() => setExpanded(!expanded)}
        >
            {/* Subtle gradient glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            {/* Top row: category + time */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-blue-400/80 tracking-wider uppercase">
                    {item.category}
                </span>
                <span className="text-xs text-white/30">{timeAgo(item.publishedAt)}</span>
            </div>

            {/* Title */}
            <h3 className="text-base sm:text-lg font-semibold text-white/90 leading-snug mb-2">
                {item.title}
            </h3>

            {/* Summary */}
            <p className="text-sm text-white/50 leading-relaxed mb-4 line-clamp-2">
                {item.summary}
            </p>

            {/* Badge + Source row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <span className={`badge ${status.class}`}>
                        <span>{status.icon}</span>
                        {status.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <div className="confidence-bar w-16">
                            <div
                                className="confidence-fill"
                                style={{
                                    width: `${item.confidence}%`,
                                    background: confidenceColor[item.factStatus],
                                }}
                            />
                        </div>
                        <span className="text-[11px] text-white/30">{item.confidence}%</span>
                    </div>
                </div>
                <span className="text-xs text-white/30">
                    {item.source}
                </span>
            </div>

            {/* Expanded fact-check details */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-white/5 fade-in-up" style={{ animationDelay: "0ms" }}>
                    <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                            AI Fact-Check Analysis
                        </span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed mb-3">
                        {item.factCheckSummary}
                    </p>
                    {item.sources.length > 0 && (
                        <div>
                            <span className="text-[11px] text-white/30 uppercase tracking-wider">
                                Cross-referenced sources:
                            </span>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                                {item.sources.map((src, i) => (
                                    <span
                                        key={i}
                                        className="text-[11px] px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-white/40"
                                    >
                                        {src}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}
