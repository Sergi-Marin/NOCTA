import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@nocta/database";
import { getUserGuilds, canManageGuild } from "@/lib/discord";
import { GuildCard } from "@/components/dashboard/guild-card";
import { PlanCard } from "@/components/dashboard/plan-card";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) redirect("/login");

  // Load user + their DB guilds in parallel
  const [discordGuilds, dbUser] = await Promise.all([
    getUserGuilds(session.user.accessToken).catch(() => []),
    db.user.findUnique({
      where: { discordId: session.user.discordId },
      include: { subscriptions: { take: 1, orderBy: { createdAt: "desc" } } },
    }),
  ]);

  // Filter to guilds where user can manage, then load DB guilds for those
  const manageableGuilds = discordGuilds.filter((g) => canManageGuild(g.permissions));
  const manageableIds = manageableGuilds.map((g) => g.id);

  const dbGuilds = await db.guild.findMany({
    where: { discordId: { in: manageableIds } },
    select: { discordId: true, activeModules: true },
  });

  const dbGuildMap = new Map(dbGuilds.map((g) => [g.discordId, g]));

  // Only show guilds that have NOCTA installed (exist in DB)
  const noctaGuilds = manageableGuilds.filter((g) => dbGuildMap.has(g.id));

  const plan = dbUser?.plan ?? "FREE";

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-muted-foreground mb-8">
        Manage your NOCTA-enabled servers.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Guild list */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Your servers</h2>
          {noctaGuilds.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-muted-foreground">
                No servers found with NOCTA installed. Add NOCTA to a server first.
              </p>
              <a
                href={process.env.DISCORD_BOT_INVITE_URL ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2.5 text-sm font-semibold text-white"
              >
                Add NOCTA to a server
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {noctaGuilds.map((g) => (
                <GuildCard
                  key={g.id}
                  id={g.id}
                  name={g.name}
                  icon={g.icon}
                  activeModules={dbGuildMap.get(g.id)?.activeModules ?? []}
                />
              ))}
            </div>
          )}
        </div>

        {/* Plan sidebar */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Subscription</h2>
          <PlanCard currentPlan={plan} />
        </div>
      </div>
    </div>
  );
}
