import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RealNews.tech — AI-Powered Fact Checker",
  description:
    "Cut through the noise. RealNews.tech uses AI to fact-check breaking news in real time, so you know what's real and what's not.",
  keywords: ["fact check", "AI", "news", "fake news", "real news", "verification"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <div className="bg-mesh" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
