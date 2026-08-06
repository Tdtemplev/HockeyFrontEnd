"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useNews } from "@/components/news/NewsProvider";

const links = [
  { href: "/", label: "Collection" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/news", label: "Slab News", showBadge: true },
  { href: "/sets", label: "Set Lookup" },
  { href: "/players", label: "Player Lookup" },
];

const titles: Record<string, string> = {
  "/": "My Repository",
  "/portfolio": "Portfolio",
  "/news": "Slab News",
  "/sets": "Set Lookup",
  "/players": "Player Lookup",
};

export function SiteHeader() {
  const pathname = usePathname();
  const { alertCount } = useNews();

  return (
    <header className="border-b border-slate-800/80 bg-[#0b1120]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sky-400">
            Slab Collection
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            {titles[pathname] ?? "Slab Collection"}
          </h1>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm sm:gap-6">
          {links.map((link) => {
            const active = pathname === link.href;
            const badge = link.showBadge && alertCount > 0 ? alertCount : 0;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "relative text-white"
                    : "relative text-slate-400 transition hover:text-slate-200"
                }
              >
                {link.label}
                {badge > 0 ? (
                  <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
