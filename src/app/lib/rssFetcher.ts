import Parser from 'rss-parser';

type CustomItem = {
    creator?: string;
};

const parser = new Parser<CustomItem, CustomItem>({
    customFields: {
        item: ['creator'],
    },
});

export interface RawArticle {
    title: string;
    summary: string;
    link: string;
    pubDate: string;
    source: string;
}

// A curated list of high-quality, free RSS feeds
const RSS_FEEDS = [
    { url: 'https://feeds.bbci.co.uk/news/rss.xml', name: 'BBC News' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NY Times' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera' },
    { url: 'http://feeds.washingtonpost.com/rss/world', name: 'Washington Post' }
];

export async function fetchLatestNews(): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];

    // We'll fetch from all sources concurrently
    const fetchPromises = RSS_FEEDS.map(async (feed) => {
        try {
            const parsed = await parser.parseURL(feed.url);

            // Take the top 5 most recent articles per feed to avoid overloading
            const topItems = parsed.items.slice(0, 5);

            return topItems.map(item => ({
                title: item.title || 'Untitled',
                summary: item.contentSnippet || item.content || '',
                link: item.link || '',
                pubDate: item.pubDate || new Date().toISOString(),
                source: feed.name,
            }));
        } catch (error) {
            console.error(`Failed to fetch RSS from ${feed.name}:`, error);
            return [];
        }
    });

    const results = await Promise.all(fetchPromises);

    // Flatten the array of arrays
    results.forEach(sourceArticles => {
        articles.push(...sourceArticles);
    });

    // Sort by pubDate descending (newest first)
    return articles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
}
