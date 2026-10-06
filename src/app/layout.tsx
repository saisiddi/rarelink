import type { Metadata, Viewport } from "next";

import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { DemoBanner } from "@/components/Banners";
import { isDemoDataset } from "@/lib/db";

export const metadata: Metadata = {
  title: {
    default: "RARELINK — Find the right blood, faster",
    template: "%s · RARELINK",
  },
  description:
    "Emergency blood discovery for India: natural-language search over verified blood-bank inventory, blood banks and rare-donor registries, ranked by availability, freshness, distance and verification.",
  applicationName: "RARELINK",
  robots: { index: true, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemoDataset();

  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
        >
          Skip to content
        </a>
        {demo ? <DemoBanner /> : null}
        <Header />
        <main id="main" className="pb-24 lg:pb-0">
          {children}
        </main>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}
