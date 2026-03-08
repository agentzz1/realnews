import { GoogleGenerativeAI } from "@google/generative-ai";
import { FactStatus } from "../components/NewsCard";

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export interface FactCheckResult {
    factStatus: FactStatus;
    confidence: number;
    factCheckSummary: string;
}

export async function checkFactWithGemini(
    title: string,
    summary: string
): Promise<FactCheckResult> {
    const prompt = `
    You are an expert, impartial fact-checker for a breaking news platform.
    Analyze the following news article:
    
    TITLE: ${title}
    SUMMARY: ${summary}
    
    Determine its factual accuracy. Be strict.
    
    Respond EXACTLY with a clean, valid JSON object (NO markdown formatting, NO backticks) containing:
    1. "factStatus": strictly one of ["verified", "misleading", "false", "unverified"]
    2. "confidence": an integer between 0 and 100 representing your confidence in this assessment
    3. "factCheckSummary": a concise 2-3 sentence explanation of why you gave this rating, mentioning any likely cross-references or red flags.

    Example output:
    {"factStatus": "misleading", "confidence": 85, "factCheckSummary": "While the core event happened, the headline exaggerates the impact based on available data from primary sources."}
  `;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        // Attempt to parse the JSON. We strip backticks just in case the model ignored instructions.
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        // Validate the status
        const validStatuses: FactStatus[] = ["verified", "misleading", "false", "unverified"];
        const status = validStatuses.includes(parsed.factStatus) ? parsed.factStatus : "unverified";

        return {
            factStatus: status,
            confidence: parsed.confidence || 50,
            factCheckSummary: parsed.factCheckSummary || "Fact-check completed without a clear summary.",
        };
    } catch (error) {
        console.error("Gemini FactCheck Error analyzing:", title, error);
        return {
            factStatus: "unverified",
            confidence: 0,
            factCheckSummary: "Our AI systems could not verify this claim at the moment.",
        };
    }
}
