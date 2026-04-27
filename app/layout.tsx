import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Deviation Detective",
  description: "Automated process deviation detection for pharmaceutical manufacturing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
