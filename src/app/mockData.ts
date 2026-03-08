import { NewsItem } from "./components/NewsCard";

export const MOCK_NEWS: NewsItem[] = [
    {
        id: "1",
        title: "NASA Confirms Water Ice Deposits Found on Mars Surface",
        summary:
            "New high-resolution images from the Perseverance rover reveal extensive subsurface water ice deposits in the Jezero Crater region, potentially transforming future colonization plans.",
        source: "Reuters",
        sourceUrl: "https://reuters.com",
        category: "Science",
        publishedAt: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
        factStatus: "verified",
        confidence: 94,
        factCheckSummary:
            "Confirmed by multiple independent sources. NASA's official press release corroborates the findings. Data aligns with ESA's Mars Express orbital observations from Q4 2025.",
        sources: ["NASA.gov", "ESA", "Nature Journal", "JPL"],
    },
    {
        id: "2",
        title: "EU Parliament Passes Landmark AI Regulation Bill",
        summary:
            "The European Parliament has voted to approve the most comprehensive AI regulation framework in history, requiring transparency reports from all AI systems operating in Europe.",
        source: "BBC News",
        sourceUrl: "https://bbc.com",
        category: "Politics",
        publishedAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
        factStatus: "verified",
        confidence: 98,
        factCheckSummary:
            "Verified through official EU Parliament vote records and multiple press agency reports. The bill passed with a 412-89 majority.",
        sources: ["EU Parliament", "BBC", "DW News", "Politico EU"],
    },
    {
        id: "3",
        title: "Viral Claim: 5G Towers Cause Bird Die-Offs in Germany",
        summary:
            "A viral social media post claims that recently installed 5G cell towers in Bavaria caused a mass die-off of migratory birds last week in the region.",
        source: "Facebook Post",
        sourceUrl: "#",
        category: "Health & Tech",
        publishedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        factStatus: "false",
        confidence: 96,
        factCheckSummary:
            "No scientific evidence supports this claim. The Bavarian wildlife authority confirmed the bird deaths were caused by avian influenza (H5N1), unrelated to any telecommunications infrastructure. Multiple peer-reviewed studies have found no link between 5G radiation and avian mortality.",
        sources: ["WHO", "Bavarian Wildlife Authority", "IEEE Spectrum", "Snopes"],
    },
    {
        id: "4",
        title: "Bitcoin Surges Past $180K After US Federal Reserve Announcement",
        summary:
            "Cryptocurrency markets rallied sharply after the Federal Reserve hinted at potential interest rate cuts in Q2 2026, pushing Bitcoin to new all-time highs.",
        source: "CNBC",
        sourceUrl: "https://cnbc.com",
        category: "Finance",
        publishedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        factStatus: "misleading",
        confidence: 72,
        factCheckSummary:
            "While Bitcoin did reach $180K, the article overstates the Fed's commitment. The Fed mentioned \"considering\" rate adjustments but made no firm commitment. The price surge was also driven by a large institutional buy from MicroStrategy, which the article fails to mention.",
        sources: ["Federal Reserve", "CoinDesk", "Bloomberg", "MicroStrategy SEC Filing"],
    },
    {
        id: "5",
        title: "New Study Links Mediterranean Diet to 40% Lower Dementia Risk",
        summary:
            "A 12-year longitudinal study published in The Lancet shows that strict adherence to a Mediterranean diet reduces dementia risk by up to 40% in adults over 50.",
        source: "The Guardian",
        sourceUrl: "https://theguardian.com",
        category: "Health",
        publishedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        factStatus: "verified",
        confidence: 88,
        factCheckSummary:
            "The study is real and peer-reviewed, published in The Lancet Neurology. However, the 40% figure applies to strict adherence only. Moderate adherence showed a 23% reduction. The original study authors have confirmed these findings.",
        sources: ["The Lancet", "WHO", "Alzheimer's Research UK"],
    },
    {
        id: "6",
        title: "Breaking: Major Earthquake Hits Turkey's Eastern Coast",
        summary:
            "Reports are emerging of a significant seismic event near Turkey's eastern Mediterranean coastline. Details and magnitude are still being confirmed by authorities.",
        source: "Twitter/X",
        sourceUrl: "#",
        category: "Breaking",
        publishedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        factStatus: "unverified",
        confidence: 34,
        factCheckSummary:
            "Reports are circulating on social media but USGS and EMSC have not yet confirmed any significant seismic activity in the region. Awaiting official confirmation from Turkish Disaster and Emergency Management Authority (AFAD).",
        sources: ["USGS (pending)", "EMSC (pending)", "AFAD (pending)"],
    },
];
