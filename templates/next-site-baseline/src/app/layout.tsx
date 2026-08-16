import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { content } from "@/lib/content";
import { paletteFor } from "@/lib/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const palette = paletteFor(content.category);

export const metadata: Metadata = {
  title: content.name,
  description: content.description,
  openGraph: {
    title: `${content.name} — ${content.tagline}`,
    description: content.description,
    type: "website",
    siteName: content.name,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: palette.bg,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <style>{`
          :root {
            --bg: ${palette.bg};
            --bg-alt: ${palette.bgAlt};
            --surface: ${palette.surface};
            --text: ${palette.text};
            --muted: ${palette.muted};
            --accent: ${palette.accent};
            --accent-soft: ${palette.accentSoft};
            --accent-2: ${palette.accent2};
            --border: ${palette.border};
            --gradient-from: ${palette.bgAlt};
            --gradient-to: ${palette.bg};
          }
        `}</style>
      </head>
      <body className="flex min-h-full flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}