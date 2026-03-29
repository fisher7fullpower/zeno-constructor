import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "SMM Admin — Morrow Lab",
  description: "AI-powered SMM management for Morrow Lab clients",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.className} antialiased bg-surface-0 text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
