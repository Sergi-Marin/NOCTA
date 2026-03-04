import Link from "next/link";
import Image from "next/image";
import { guildIconUrl } from "@/lib/discord";

interface GuildCardProps {
  id: string;
  name: string;
  icon: string | null;
  activeModules: string[];
}

export function GuildCard({ id, name, icon, activeModules }: GuildCardProps) {
  const iconUrl = guildIconUrl(id, icon);

  return (
    <Link
      href={`/dashboard/${id}`}
      className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-violet-500/40 hover:bg-white/8"
    >
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt={name}
          width={48}
          height={48}
          className="rounded-xl"
          unoptimized
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-lg font-bold text-violet-400">
          {name[0]?.toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground group-hover:text-violet-300 transition-colors">
          {name}
        </p>
        <p className="text-sm text-muted-foreground">
          {activeModules.length === 0
            ? "No modules active"
            : `${activeModules.length} module${activeModules.length === 1 ? "" : "s"} active`}
        </p>
      </div>

      <svg
        className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-violet-400 transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
