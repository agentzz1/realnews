import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

// GET /api/news
// This endpoint will be called by the frontend to load the latest fact-checked news.
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('news')
            .select('*')
            .order('publishedAt', { ascending: false })
            .limit(50);

        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error) {
        console.error("Error fetching news:", error);
        return NextResponse.json({ success: false, error: 'Failed to fetch news' }, { status: 500 });
    }
}
