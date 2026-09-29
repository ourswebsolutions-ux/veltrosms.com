import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MaintenanceBanner } from "@/components/layout/MaintenanceBanner";
import { siteConfig } from "@/config/site";
import { themeInitScript } from "@/lib/theme-script";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — Virtual numbers for SMS verification`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export const viewport: Viewport = {
  themeColor: "#0f3b6a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme is set by themeInitScript before hydration.
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <Header />
        <MaintenanceBanner />
        <div id="main" className="flex-1">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
