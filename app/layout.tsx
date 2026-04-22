import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { DISCLAIMER } from "@/lib/disclaimer";
import ChatPanel from "@/components/ChatPanel";
import CommandPalette from "@/components/CommandPalette";
import ThemeProvider from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stock Analysis · beginner dashboard",
  description: "Multi-agent educational stock analysis for beginners.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning is required because next-themes sets the theme
    // class on <html> before React hydrates.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <ThemeProvider>
          {/* Emerald gradient header makes the brand pop and anchors the top
              of the page visually. */}
          <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-sm">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              {/* Logo = "start over" button. ?new=1 tells the dashboard to
                  clear analyses + sessionStorage so the user lands on the
                  empty hero. The nav "Dashboard" link below keeps the smart
                  restore behavior for users coming back from /decisions. */}
              <Link href="/?new=1" className="flex items-center gap-2 font-semibold tracking-tight text-lg">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/15 text-white text-sm font-bold">
                  ↗
                </span>
                Stock Analysis
              </Link>
              <nav className="flex items-center gap-5 text-sm">
                <Link href="/" className="text-white/90 hover:text-white transition-colors">Dashboard</Link>
                <Link href="/portfolio" className="text-white/90 hover:text-white transition-colors">My stocks</Link>
                <Link href="/screener" className="text-white/90 hover:text-white transition-colors">Screener</Link>
                <Link href="/history" className="text-white/90 hover:text-white transition-colors">History</Link>
                <Link href="/decisions" className="text-white/90 hover:text-white transition-colors">My decisions</Link>
                <span
                  className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 border border-white/20 text-[10px] font-mono text-white/90"
                  title="Open command palette"
                >
                  ⌘K
                </span>
                <ThemeToggle />
              </nav>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/60 border-t border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs px-4 py-2 text-center">
              {DISCLAIMER}
            </div>
          </header>
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
          <CommandPalette />
          <ChatPanel />
          <footer className="border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 px-4 py-4 text-center">
            Data: Yahoo Finance (unofficial) · Live quotes: Finnhub · Analysis: LLM · Educational use only.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
