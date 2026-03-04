/**
 * Shared DB helpers used by slash command handlers.
 */
import { db, type Guild, type GuildSettings, type Plan } from "@nocta/database";
import type { GuildContext } from "../core/AIEngine.js";

// ─── Guild ────────────────────────────────────────────────────────────────────

export interface GuildWithSettings extends Guild {
  settings: GuildSettings | null;
}

/**
 * Fetch a guild from the DB, creating it with defaults if it doesn't exist yet.
 */
export async function getOrCreateGuild(
  discordGuildId: string,
  name: string,
  ownerId: string,
  iconUrl?: string | null,
): Promise<GuildWithSettings> {
  return db.guild.upsert({
    where: { discordId: discordGuildId },
    update: { name, iconUrl: iconUrl ?? null },
    create: {
      discordId: discordGuildId,
      name,
      ownerId,
      iconUrl: iconUrl ?? null,
      activeModules: [],
      settings: { create: {} },
    },
    include: { settings: true },
  });
}

// ─── User ─────────────────────────────────────────────────────────────────────

/**
 * Fetch a user from the DB, creating them if they don't exist yet.
 * Returns the user's current plan.
 */
export async function getOrCreateUser(
  discordUserId: string,
  username: string,
  avatarUrl?: string | null,
): Promise<Plan> {
  const user = await db.user.upsert({
    where: { discordId: discordUserId },
    update: { username, avatarUrl: avatarUrl ?? null },
    create: {
      discordId: discordUserId,
      username,
      avatarUrl: avatarUrl ?? null,
    },
    select: { plan: true },
  });
  return user.plan;
}

// ─── Combined context ─────────────────────────────────────────────────────────

/**
 * Build a full GuildContext for AIEngine from a Discord interaction's guild/member.
 */
export async function buildGuildContext(opts: {
  guildId: string;
  guildName: string;
  guildOwnerId: string;
  guildIconUrl?: string | null;
  userId: string;
  username: string;
  avatarUrl?: string | null;
}): Promise<{ context: GuildContext; guild: GuildWithSettings }> {
  const [guild, plan] = await Promise.all([
    getOrCreateGuild(opts.guildId, opts.guildName, opts.guildOwnerId, opts.guildIconUrl),
    getOrCreateUser(opts.userId, opts.username, opts.avatarUrl),
  ]);

  const context: GuildContext = {
    guild: {
      id: guild.id,
      name: guild.name,
      activeModules: guild.activeModules,
    },
    user: {
      id: opts.userId,
      username: opts.username,
    },
    plan,
  };

  return { context, guild };
}
