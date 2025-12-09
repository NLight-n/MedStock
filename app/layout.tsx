import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = localFont({
  // Paths are relative to this file; public/ is at the repo root
  // Font files should live at app/fonts/Inter/* so paths resolve during build
  src: [
    { path: "./fonts/Inter/Inter-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Inter/Inter-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Inter/Inter-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Inter/Inter-Bold.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MedStock - IR Department Stock Management",
  description: "Stock management system for the Interventional Radiology Department",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
