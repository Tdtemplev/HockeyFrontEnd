"use client";

import { useEffect, useState } from "react";

import { primarySubjectName } from "@/lib/names";

export { primarySubjectName };

interface PlayerAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClass = {
  sm: "h-10 w-10 text-xs",
  md: "h-16 w-16 text-sm",
  lg: "h-full w-full text-2xl",
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PlayerAvatar({
  name,
  size = "md",
  className = "",
}: PlayerAvatarProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    async function load() {
      const response = await fetch(
        `/api/player-image?name=${encodeURIComponent(name)}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as { url?: string | null };
      if (!cancelled) setImageUrl(data.url ?? null);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [name]);

  const classes = `${sizeClass[size]} ${className} overflow-hidden rounded-full bg-slate-800 flex items-center justify-center shrink-0`;

  if (imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${classes} object-cover object-top`}
      />
    );
  }

  return (
    <div className={`${classes} font-semibold text-sky-300`}>
      {initials(name)}
    </div>
  );
}

// Re-exported from @/lib/names for convenience in client components.
