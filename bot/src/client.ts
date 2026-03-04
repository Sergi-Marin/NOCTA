import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { AIEngine } from "./core/AIEngine.js";
import type { VoicePipeline } from "./core/VoicePipeline.js";
import type { ModuleLoader } from "./core/ModuleLoader.js";

export interface Command {
  // Use a structural type so all SlashCommand builder variants (SlashCommandBuilder,
  // SlashCommandOptionsOnlyBuilder, etc.) are accepted without exact-type issues.
  data: { name: string; toJSON(): unknown };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export class NoctaClient extends Client {
  public readonly commands = new Collection<string, Command>();

  /** Initialized after ClientReady if ANTHROPIC_API_KEY is set. */
  public ai?: AIEngine;

  /** Initialized after ClientReady if all voice API keys are set. */
  public pipeline?: VoicePipeline;

  /** Initialized after ClientReady. */
  public moduleLoader?: ModuleLoader;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates, // required for voice channel join/leave
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.GuildMember, Partials.Message],
    });
  }
}
