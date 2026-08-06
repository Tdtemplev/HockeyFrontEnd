"use client";

import { NewsProvider } from "@/components/news/NewsProvider";
import { SiteHeader } from "@/components/SiteHeader";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <NewsProvider>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
    </NewsProvider>
  );
}
