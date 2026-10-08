import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://safecargo.vercel.app"),
  title: {
    default: "SafeCargo — Intelligent Cargo Monitoring",
    template: "%s · SafeCargo",
  },
  description:
    "SafeCargo IoT cargo monitoring — live ESP8266 reports and offline ST25DV NFC verification in one unified interface.",
  keywords: [
    "SafeCargo",
    "cargo monitoring",
    "IoT",
    "ESP8266",
    "ST25DV",
    "NFC",
    "Web NFC",
    "NDEF",
    "supply chain",
    "shock sensor",
    "tilt sensor",
    "Supabase",
    "Next.js",
  ],
  authors: [{ name: "SafeCargo" }],
  openGraph: {
    title: "SafeCargo — Intelligent Cargo Monitoring",
    description:
      "Verify your cargo with one tap. Live ESP8266 telemetry + offline NFC verification in a single neon cyberpunk interface.",
    type: "website",
    locale: "en_US",
    siteName: "SafeCargo",
  },
  twitter: {
    card: "summary_large_image",
    title: "SafeCargo — Intelligent Cargo Monitoring",
    description:
      "Live IoT cargo telemetry + offline NFC verification for ST25DV64KC / ESP8266 shipments.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body
        className="antialiased min-h-screen bg-slate-50 text-slate-900"
        style={{ fontFamily: "var(--font-inter), var(--font-sans)" }}
      >
        {children}
      </body>
    </html>
  );
}
