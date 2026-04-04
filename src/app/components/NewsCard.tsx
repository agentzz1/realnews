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
    onClick,
}: {
    item: NewsItem;
    onClick?: () => void;
}) {
    const [expanded, setExpanded] = React.useState(false);
    const status = statusConfig[item.factStatus];

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else {
            setExpanded(!expanded);
        }
    };

    return (
        <article
            className="surface-card flex h-full flex-col p-6 cursor-pointer relative overflow-hidden group hover:border-[color:var(--brand)] transition-all duration-300"
            onClick={handleClick}
        >
            {/* Top row: category + time */}
            <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-[color:var(--brand-strong)] uppercase tracking-widest">
                    {item.category}
                </span>
                <span className="text-[11px] font-semibold text-[color:var(--muted)]">{timeAgo(item.publishedAt)}</span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-foreground leading-snug mb-3">
                {item.title}
            </h3>

            {/* Summary */}
            <p className="flex-1 text-sm text-[color:var(--muted)] leading-relaxed mb-6 line-clamp-2">
                {item.summary}
            </p>

            {/* Badge + Source row */}
            <div className="pt-4 mt-auto border-t border-[color:var(--border)] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <span className={`badge ${status.class}`}>
                        <span>{status.icon}</span>
                        {status.label}
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="confidence-bar w-12 sm:w-16">
                            <div
                                className="confidence-fill"
                                style={{
                                    width: `${item.confidence}%`,
                                    background: confidenceColor[item.factStatus],
                                }}
                            />
                        </div>
                        <span className="text-[11px] font-bold text-[color:var(--muted)]">{item.confidence}%</span>
                    </div>
                </div>
                <span className="text-xs font-semibold text-[color:var(--muted)]">
                    {item.source}
                </span>
            </div>

            {/* Expanded fact-check details */}
            {expanded && !onClick && (
                <div className="mt-5 p-4 rounded-[1.2rem] border border-[color:var(--border)] bg-white/5 fade-in-up">
                    <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-[color:var(--brand-strong)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="text-[11px] font-bold text-[color:var(--brand-strong)] uppercase tracking-[0.15em]">
                            AI Fact-Check Analysis
                        </span>
                    </div>
                    <p className="text-sm font-medium text-[color:var(--muted)] leading-relaxed mb-4">
                        {item.factCheckSummary}
                    </p>
                    {item.sources.length > 0 && (
                        <div>
                            <span className="text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-[0.15em]">
                                Cross-referenced sources:
                            </span>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {item.sources.map((src, i) => (
                                    <span
                                        key={i}
                                        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] bg-white/5"
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
