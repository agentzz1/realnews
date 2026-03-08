"use client";

import React, { useState } from "react";
import NewsCard, { FactStatus, NewsItem } from "./components/NewsCard";
import { MOCK_NEWS } from "./mockData";

const FILTERS: { label: string; value: FactStatus | "all" }[] = [
  { label: "All News", value: "all" },
  { label: "✓ Verified", value: "verified" },
  { label: "⚠ Misleading", value: "misleading" },
  { label: "✕ False", value: "false" },
  { label: "? Unverified", value: "unverified" },
];

function StatsBar({ news }: { news: NewsItem[] }) {
  const verified = news.filter((n) => n.factStatus === "verified").length;
  const misleading = news.filter((n) => n.factStatus === "misleading").length;
  const flagged = news.filter((n) => n.factStatus === "false").length;
  const total = news.length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Stories Checked", value: total, color: "text-blue-400" },
        { label: "Verified", value: verified, color: "text-green-400" },
        { label: "Misleading", value: misleading, color: "text-yellow-400" },
        { label: "Flagged False", value: flagged, color: "text-red-400" },
      ].map((stat) => (
        <div
          key={stat.label}
          className="glass-card p-4 text-center"
        >
          <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          <div className="text-[11px] text-white/30 uppercase tracking-wider mt-1">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [filter, setFilter] = useState<FactStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch('/api/news');
        const json = await res.json();
        if (json.success) {
          setNews(json.data);
        }
      } catch (error) {
        console.error("Failed to load news:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  const filteredNews = news.filter((item) => {
    const matchesFilter = filter === "all" || item.factStatus === filter;
    const matchesSearch =
      searchQuery === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#06080d]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
                R
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  RealNews<span className="text-blue-400">.tech</span>
                </h1>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.15em]">
                  AI Fact Checker
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
                <span className="text-[11px] font-medium text-green-400">Live</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
            Cut through the noise.
          </h2>
          <p className="text-base text-white/40 max-w-lg mx-auto">
            AI-powered fact-checking for breaking news. Know what&apos;s real, what&apos;s
            misleading, and what&apos;s outright false — in real time.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <StatsBar news={loading ? [] : news} />
        </div>

        {/* Search */}
        <div className="mb-5">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search news stories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filter === f.value
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-white/[0.03] text-white/40 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/60"
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* News Feed */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card p-6 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
                  <div className="h-6 bg-white/10 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-white/10 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredNews.length > 0 ? (
            filteredNews.map((item, index) => (
              <NewsCard key={item.id} item={item} index={index} />
            ))
          ) : (
            <div className="glass-card p-12 text-center">
              <p className="text-white/30 text-sm">
                No stories match your filters.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 mb-8 text-center border-t border-white/[0.04] pt-8">
          <p className="text-[11px] text-white/20">
            Powered by AI &middot; Built by{" "}
            <span className="text-blue-400/60 font-medium">Agent ZZ</span>{" "}
            &middot; RealNews.tech &copy; {new Date().getFullYear()}
          </p>
          <p className="text-[10px] text-white/10 mt-1">
            Fact-check results are AI-generated and should be verified with primary sources.
          </p>
        </footer>
      </main>
    </div>
  );
}
