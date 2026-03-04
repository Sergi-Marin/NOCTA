/**
 * Registers all slash commands globally via the Discord REST API.
 *
 * Usage (dev):   pnpm --filter bot deploy
 * Usage (prod):  node dist/deploy.js
 *
 * Global commands propagate within ~1 hour.
 * For instant updates during development, set DISCORD_GUILD_ID to register
 * to a single guild (takes effect immediately).
 */
import "dotenv/config";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REST, Routes } from "discord.js";
import type { Command } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const token = process.env["DISCORD_TOKEN"];
const clientId = process.env["DISCORD_CLIENT_ID"];

if (!token) throw new Error("DISCORD_TOKEN is not set");
if (!clientId) throw new Error("DISCORD_CLIENT_ID is not set");

const guildId = process.env["DISCORD_GUILD_ID"]; // optional — guild-only if set

// ─── Collect command bodies ───────────────────────────────────────────────────

const commandsDir = join(__dirname, "commands");
const commandFiles = readdirSync(commandsDir).filter(
  (f) => f.endsWith(".ts") || f.endsWith(".js"),
);

const commandBodies: unknown[] = [];

for (const file of commandFiles) {
  const filePath = pathToFileURL(join(commandsDir, file)).href;
  const mod = (await import(filePath)) as { default: Command };
  commandBodies.push(mod.default.data.toJSON());
  console.log(`  ✓ Collected: /${mod.default.data.name}`);
}

// ─── Register via REST ────────────────────────────────────────────────────────

const rest = new REST().setToken(token);

if (guildId) {
  // Guild-scoped — instant propagation, good for development
  console.log(
    `\nRegistering ${commandBodies.length} command(s) to guild ${guildId}...`,
  );
  const data = (await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commandBodies },
  )) as unknown[];
  console.log(`✅ Registered ${data.length} guild command(s).`);
} else {
  // Global — propagates to all guilds within ~1 hour
  console.log(`\nRegistering ${commandBodies.length} command(s) globally...`);
  const data = (await rest.put(Routes.applicationCommands(clientId), {
    body: commandBodies,
  })) as unknown[];
  console.log(`✅ Registered ${data.length} global command(s).`);
}
