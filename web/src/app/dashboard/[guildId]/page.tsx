import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@nocta/database";
import { getUserGuilds, canManageGuild, guildIconUrl } from "@/lib/discord";
import { MODULES } from "@/lib/modules";
import { ModuleToggle } from "@/components/dashboard/module-toggle";
import Image from "next/image";
import Link from "next/link";

interface Props {
  params: { guildId: string };
}

export default async function GuildPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) redirect("/login");

  const { guildId } = params;

  // Load Discord guild list + DB guild + DB user in parallel
  const [discordGuilds, dbGuild, dbUser] = await Promise.all([
    getUserGuilds(session.user.accessToken).catch(() => []),
    db.guild.findUnique({ where: { discordId: guildId } }),
    db.user.findUnique({ where: { discordId: session.user.discordId } }),
  ]);

  if (!dbGuild || !dbUser) notFound();

  const discordGuild = discordGuilds.find((g) => g.id === guildId);
  if (!discordGuild || !canManageGuild(discordGuild.permissions)) {
    redirect("/dashboard");
  }

  const iconUrl = guildIconUrl(guildId, discordGuild.icon);
  const plan = dbUser.plan;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {iconUrl ? (
          <Image
            src={iconUrl}
            alt={discordGuild.name}
            width={48}
            height={48}
            className="rounded-xl"
            unoptimized
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/20 text-lg font-bold text-violet-400">
            {discordGuild.name[0]?.toUpperCase()}
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold">{discordGuild.name}</h1>
          <p className="text-sm text-muted-foreground">
            {dbGuild.activeModules.length} of {MODULES.length} modules active
          </p>
        </div>
      </div>

      {/* Modules */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Modules</h2>
        {MODULES.map((mod) => (
          <ModuleToggle
            key={mod.id}
            module={mod}
            guildId={guildId}
            isActive={dbGuild.activeModules.includes(mod.id)}
            userPlan={plan}
          />
        ))}
      </div>
    </div>
  );
}
