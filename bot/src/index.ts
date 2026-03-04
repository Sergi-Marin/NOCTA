import "dotenv/config";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Events } from "discord.js";
import { NoctaClient } from "./client.js";
import { AIEngine, ModuleLoader, createVoicePipeline } from "./core/index.js";
import { register as registerAssistant } from "./modules/assistant/index.js";
import type { Command } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const modulesDir = join(__dirname, "modules");

const token = process.env["DISCORD_TOKEN"];
if (!token) throw new Error("DISCORD_TOKEN is not set");

const client = new NoctaClient();

// ─── Load commands ─────────────────────────────────────────────────────────────
// Works in both tsx (resolves .ts) and compiled output (resolves .js).

const commandsDir = join(__dirname, "commands");
const commandFiles = readdirSync(commandsDir).filter(
  (f) => f.endsWith(".ts") || f.endsWith(".js"),
);

for (const file of commandFiles) {
  const { default: command } = (await import(
    pathToFileURL(join(commandsDir, file)).href
  )) as { default: Command };
  client.commands.set(command.data.name, command);
  console.log(`[Commands] Loaded: /${command.data.name}`);
}

// ─── Ready ─────────────────────────────────────────────────────────────────────

client.once(Events.ClientReady, (c) => {
  console.log(`\n✅ Logged in as ${c.user.tag}`);
  console.log(`   ${client.commands.size} command(s) registered\n`);

  // AI engine (required for /nocta)
  if (process.env["ANTHROPIC_API_KEY"]) {
    client.ai = new AIEngine({
      apiKey: process.env["ANTHROPIC_API_KEY"],
      model: process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-6",
    });
    console.log("[Engines] AIEngine ready");
  } else {
    console.warn("[Engines] ANTHROPIC_API_KEY not set — /nocta will be unavailable");
  }

  // Module loader (always active)
  client.moduleLoader = new ModuleLoader(client, modulesDir);
  console.log(
    `[Engines] ModuleLoader ready — ${client.moduleLoader.discoverAvailable().length} module(s) on disk`,
  );

  // Auto-load built-in FREE modules that are available to every guild
  void registerAssistant(client.moduleLoader).then(() => {
    console.log("[Modules] assistant auto-loaded");
  });

  // Voice pipeline (requires Picovoice + ElevenLabs)
  const voiceReady =
    process.env["PICOVOICE_ACCESS_KEY"] &&
    process.env["PORCUPINE_KEYWORD_PATH"] &&
    process.env["ELEVENLABS_API_KEY"] &&
    process.env["ELEVENLABS_VOICE_ID"];

  if (voiceReady) {
    // Stub transcription — replace with Whisper / Deepgram in production
    const transcribe = async (_pcm: Int16Array, _rate: 16000): Promise<string> => {
      console.warn("[Pipeline] No transcription backend configured — returning empty string");
      return "";
    };
    client.pipeline = createVoicePipeline(client, transcribe, modulesDir);
    console.log("[Engines] VoicePipeline ready");
  } else {
    console.warn(
      "[Engines] Voice keys missing (PICOVOICE_ACCESS_KEY / PORCUPINE_KEYWORD_PATH / ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID) — /join will be unavailable",
    );
  }
});

// ─── Interactions ──────────────────────────────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Commands] Error in /${interaction.commandName}:`, error);
    const reply = { content: "An error occurred while executing this command.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────────

await client.login(token);
