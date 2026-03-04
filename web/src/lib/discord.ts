const DISCORD_API = "https://discord.com/api/v10";

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string; // BigInt serialised as a decimal string
  features: string[];
}

/** Returns true if the given permissions value includes Manage Guild or Administrator. */
export function canManageGuild(permissions: string): boolean {
  const bits = BigInt(permissions);
  return (bits & ADMINISTRATOR) === ADMINISTRATOR || (bits & MANAGE_GUILD) === MANAGE_GUILD;
}

/** Fetch the guilds the authenticated user is a member of via the Discord API. */
export async function getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Revalidate every minute — guild list rarely changes
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Discord API error ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<DiscordGuild[]>;
}

/** Build the CDN URL for a guild icon, or null if no icon is set. */
export function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=128`;
}
