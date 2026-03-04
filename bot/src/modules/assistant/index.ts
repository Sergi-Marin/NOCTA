/**
 * Assistant module — general-knowledge AI powered by Claude.
 *
 * Plan:        FREE (available to all guilds)
 * Rate limit:  10 queries / hour per guild on FREE; unlimited on PRO+
 *
 * The module implements both the public `Module` interface (exported for
 * external use) and the `NoctaModule` contract expected by ModuleLoader.
 */
import Anthropic from "@anthropic-ai/sdk";
import { db, type Plan } from "@nocta/database";
import type { NoctaModule, ModuleLoader } from "../../core/ModuleLoader.js";
import type { NoctaClient } from "../../client.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AssistantContext {
  /** Discord snowflake ID of the guild. */
  guildId: string;
  guildName: string;
  /** Effective plan used to enforce rate limits and response length. */
  plan: Plan;
}

/**
 * Public interface for the assistant module.
 * External code should depend on this rather than the concrete implementation.
 */
export interface Module {
  readonly name: string;
  readonly plan: Plan;
  readonly description: string;
  /** Called once when the module is first activated. */
  onLoad(): Promise<void>;
  /**
   * Handle a voice query in the context of a guild.
   * Returns a spoken response string, or `null` to pass through to the next handler.
   */
  onVoiceQuery(query: string, context: AssistantContext): Promise<string | null>;
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const FREE_LIMIT = 10;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Per-key sliding-window rate limiter stored entirely in memory.
 * Timestamps older than `windowMs` are pruned on each check so memory
 * doesn't grow indefinitely.
 */
class RateLimiter {
  private readonly windows = new Map<string, number[]>();

  /**
   * Returns `true` and records the attempt if the key is under its limit.
   * Returns `false` (without recording) when the limit is already reached.
   */
  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    const times = (this.windows.get(key) ?? []).filter((t) => t > cutoff);
    this.windows.set(key, times);

    if (times.length >= limit) return false;

    times.push(now);
    return true;
  }

  /** Queries remaining in the current window for a key. */
  remaining(key: string, limit: number, windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    const used = (this.windows.get(key) ?? []).filter((t) => t > cutoff).length;
    return Math.max(0, limit - used);
  }
}

// ─── Module-level singletons ──────────────────────────────────────────────────

const rateLimiter = new RateLimiter();

let _anthropic: Anthropic | null = null;

/** Lazily initialise the Anthropic client so missing keys don't crash at startup. */
function getAnthropic(): Anthropic | null {
  if (_anthropic) return _anthropic;
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) return null;
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

// ─── System-prompt guidelines per plan ───────────────────────────────────────

const PLAN_GUIDELINES: Record<Plan, string> = {
  FREE: "Keep answers concise — 2 sentences maximum.",
  PRO: "Provide complete, helpful answers. Avoid unnecessary verbosity.",
  PREMIUM: "Provide thorough, detailed answers with full context.",
};

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * The assistant module object.
 * Satisfies both the exported `Module` interface and the `NoctaModule`
 * contract required by `ModuleLoader`.
 */
const assistant = {
  name: "assistant",
  plan: "FREE" as Plan,
  description: "General-knowledge AI assistant powered by Claude.",

  // `client` is optional so this signature satisfies both Module.onLoad()
  // (no params) and NoctaModule.onLoad(client: NoctaClient).
  async onLoad(_client?: NoctaClient): Promise<void> {
    // Eagerly warm up the Anthropic client to surface missing-key errors early.
    if (!getAnthropic()) {
      console.warn(
        "[assistant] ANTHROPIC_API_KEY not set — module will pass through all queries",
      );
    }
  },

  async onUnload(): Promise<void> {},

  /**
   * Core query handler. Enforces the rate limit for FREE guilds, then
   * sends the query to Claude and returns a speech-ready response.
   */
  async onVoiceQuery(
    query: string,
    ctx: AssistantContext,
  ): Promise<string | null> {
    const client = getAnthropic();
    if (!client) return null;

    // Rate limit only applies to FREE guilds
    if (ctx.plan === "FREE") {
      const allowed = rateLimiter.check(ctx.guildId, FREE_LIMIT, HOUR_MS);
      if (!allowed) {
        const resetMins = 60; // approximate — exact depends on oldest timestamp
        return (
          `You've reached the ${FREE_LIMIT} queries per hour limit on the Free plan. ` +
          `Queries reset in roughly ${resetMins} minutes. ` +
          `Upgrade to Pro for unlimited queries.`
        );
      }
    }

    // Include remaining-query hint in the system prompt for FREE users
    const remaining =
      ctx.plan === "FREE"
        ? ` The user has ${rateLimiter.remaining(ctx.guildId, FREE_LIMIT, HOUR_MS)} queries remaining this hour.`
        : "";

    const response = await client.messages.create({
      model: process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-6",
      max_tokens: ctx.plan === "FREE" ? 256 : 1024,
      system: [
        `You are NOCTA, an AI voice assistant embedded in the Discord server "${ctx.guildName}".`,
        "You were activated by a voice wake-word and are responding to a spoken query.",
        "Speak naturally — your response will be converted to audio and played in a voice channel.",
        "Avoid markdown, bullet points, code blocks, or any formatting that does not translate to speech.",
        "Do not start responses with filler phrases like 'Of course!' or 'Certainly!'.",
        PLAN_GUIDELINES[ctx.plan] + remaining,
      ].join("\n"),
      messages: [{ role: "user", content: query }],
    });

    const block = response.content.find((b) => b.type === "text");
    return block?.type === "text" ? block.text : null;
  },

  /**
   * NoctaModule hook called by ModuleLoader for every voice query.
   * Resolves the guild's effective plan from the DB (owner's plan), then
   * delegates to `onVoiceQuery`.
   */
  async handleVoiceQuery(
    query: string,
    guildId: string,
  ): Promise<string | null> {
    const dbGuild = await db.guild.findUnique({ where: { discordId: guildId } });
    if (!dbGuild) return null;

    // The guild owner's plan determines rate-limit and response quality.
    const owner = await db.user.findUnique({
      where: { discordId: dbGuild.ownerId },
      select: { plan: true },
    });
    const plan: Plan = owner?.plan ?? "FREE";

    return assistant.onVoiceQuery(query, {
      guildId,
      guildName: dbGuild.name,
      plan,
    });
  },
} satisfies Module & NoctaModule;

export default assistant;

// ─── Self-registration helper ─────────────────────────────────────────────────

/**
 * Register the assistant module with a `ModuleLoader` instance.
 * Call this during bot startup so the assistant is available to all guilds
 * without requiring them to explicitly add it to `activeModules`.
 *
 * @example
 * import { register as registerAssistant } from "./modules/assistant/index.js";
 * await registerAssistant(client.moduleLoader);
 */
export async function register(loader: ModuleLoader): Promise<void> {
  await loader.load("assistant");
}
