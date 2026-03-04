/**
 * VoicePipeline wires VoiceEngine → transcription → ModuleLoader → AIEngine → TTSEngine
 * into a single object that can be attached to a guild's voice channel.
 *
 * Transcription is intentionally kept as an injectable callback so you can
 * swap between Whisper, Deepgram, or any other provider without touching
 * the pipeline itself.
 */
import type { VoiceChannel } from "discord.js";
import type { VoiceConnection } from "@discordjs/voice";
import { getVoiceConnection } from "@discordjs/voice";
import { VoiceEngine, type VoiceQueryEvent } from "./VoiceEngine.js";
import { AIEngine, type GuildContext } from "./AIEngine.js";
import { TTSEngine } from "./TTSEngine.js";
import { ModuleLoader } from "./ModuleLoader.js";
import type { NoctaClient } from "../client.js";

export type TranscribeFn = (pcm: Int16Array, sampleRate: 16000) => Promise<string>;

export interface VoicePipelineOptions {
  voice: VoiceEngine;
  ai: AIEngine;
  tts: TTSEngine;
  modules: ModuleLoader;
  transcribe: TranscribeFn;
}

export class VoicePipeline {
  private readonly voice: VoiceEngine;
  private readonly ai: AIEngine;
  private readonly tts: TTSEngine;
  private readonly modules: ModuleLoader;
  private readonly transcribe: TranscribeFn;

  constructor(options: VoicePipelineOptions) {
    this.voice = options.voice;
    this.ai = options.ai;
    this.tts = options.tts;
    this.modules = options.modules;
    this.transcribe = options.transcribe;

    this.voice.on("wakeWord", (userId, guildId) => {
      console.log(`[Pipeline] Wake word detected — user ${userId} in guild ${guildId}`);
    });

    this.voice.on("query", (event) => void this.handleQuery(event));
    this.voice.on("error", (err) => console.error("[Pipeline] VoiceEngine error:", err));
  }

  async join(channel: VoiceChannel): Promise<void> {
    await this.voice.join(channel);
  }

  leave(guildId: string): void {
    this.voice.leave(guildId);
  }

  private async handleQuery(event: VoiceQueryEvent): Promise<void> {
    const { userId, guildId, pcm } = event;

    const connection: VoiceConnection | undefined = getVoiceConnection(guildId);
    if (!connection) return;

    try {
      // 1. Transcribe PCM → text
      const queryText = await this.transcribe(pcm, 16000);
      if (!queryText.trim()) return;

      console.log(`[Pipeline] Query from ${userId}: "${queryText}"`);

      // 2. Give loaded modules a chance to handle it first
      const moduleResponse = await this.modules.handleVoiceQuery(queryText, guildId);

      // 3. Fall through to Claude if no module claimed the query
      const responseText =
        moduleResponse ??
        (await this.ai.respond(queryText, this.buildContext(userId, guildId)));

      console.log(`[Pipeline] Response: "${responseText}"`);

      // 4. Speak the response
      await this.tts.speak(responseText, connection);
    } catch (err) {
      console.error("[Pipeline] Error handling voice query:", err);
    }
  }

  private buildContext(userId: string, guildId: string): GuildContext {
    // Minimal context — callers should override this with real DB data
    return {
      guild: { id: guildId, name: guildId, activeModules: [] },
      user: { id: userId, username: userId },
      plan: "FREE",
    };
  }
}

/**
 * Factory helper — creates all engines from env and a NoctaClient.
 */
export function createVoicePipeline(
  client: NoctaClient,
  transcribe: TranscribeFn,
  modulesDir: string,
): VoicePipeline {
  const voice = new VoiceEngine({
    picovoiceAccessKey: requireEnv("PICOVOICE_ACCESS_KEY"),
    keywordModelPath: requireEnv("PORCUPINE_KEYWORD_PATH"),
    sensitivity: Number(process.env["PORCUPINE_SENSITIVITY"] ?? "0.5"),
  });

  const ai = new AIEngine({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    model: process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-6",
  });

  const tts = new TTSEngine({
    apiKey: requireEnv("ELEVENLABS_API_KEY"),
    voiceId: requireEnv("ELEVENLABS_VOICE_ID"),
    modelId: process.env["ELEVENLABS_MODEL_ID"] ?? "eleven_turbo_v2_5",
  });

  const modules = new ModuleLoader(client, modulesDir);

  return new VoicePipeline({ voice, ai, tts, modules, transcribe });
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}
