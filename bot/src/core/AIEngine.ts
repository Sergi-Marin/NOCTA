import Anthropic from "@anthropic-ai/sdk";
import type { Plan } from "@nocta/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIEngineOptions {
  apiKey: string;
  /** Default: claude-sonnet-4-6 */
  model?: string;
  /** Default: 1024 */
  maxTokens?: number;
}

export interface GuildContext {
  guild: {
    id: string;
    name: string;
    activeModules: string[];
  };
  user: {
    id: string;
    username: string;
  };
  plan: Plan;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const PLAN_GUIDELINES: Record<Plan, string> = {
  FREE: "Keep answers concise — 2 sentences maximum. Mention that upgrading to PRO unlocks longer answers if the user seems to want more detail.",
  PRO: "Provide complete, helpful answers. Moderate length — avoid unnecessary verbosity.",
  PREMIUM:
    "Provide thorough, detailed answers with full context. All capabilities are available to this user.",
};

// ─── AIEngine ─────────────────────────────────────────────────────────────────

export class AIEngine {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(options: AIEngineOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? "claude-sonnet-4-6";
    this.maxTokens = options.maxTokens ?? 1024;
  }

  /**
   * Send a query and wait for the full response.
   * Use `stream()` instead when you want to pipe text to TTS progressively.
   */
  async respond(
    query: string,
    context: GuildContext,
    history: ConversationMessage[] = [],
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: buildSystemPrompt(context),
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: query },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("Claude returned no text content");
    }
    return block.text;
  }

  /**
   * Stream the response token by token.
   * Yields text deltas as they arrive — ideal for low-latency TTS chunking.
   *
   * @example
   * for await (const chunk of engine.stream(query, ctx)) {
   *   process.stdout.write(chunk);
   * }
   */
  async *stream(
    query: string,
    context: GuildContext,
    history: ConversationMessage[] = [],
  ): AsyncGenerator<string, void, undefined> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      system: buildSystemPrompt(context),
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: query },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: GuildContext): string {
  const modules =
    ctx.guild.activeModules.length > 0
      ? ctx.guild.activeModules.join(", ")
      : "none";

  return [
    `You are NOCTA, an AI voice assistant embedded in the Discord server "${ctx.guild.name}".`,
    `You were activated by a voice wake-word and are responding to a spoken query.`,
    "",
    "## Response style",
    "Speak naturally — your response will be converted to audio and played in a voice channel.",
    "Avoid markdown, bullet points, code blocks, or any formatting that does not translate to speech.",
    "Use clear, conversational language. Do not start responses with filler like 'Of course!' or 'Certainly!'.",
    "",
    "## User",
    `Discord username: ${ctx.user.username}`,
    `Subscription plan: ${ctx.plan}`,
    "",
    "## Guild context",
    `Server name: ${ctx.guild.name}`,
    `Active modules: ${modules}`,
    "",
    "## Length & capability",
    PLAN_GUIDELINES[ctx.plan],
  ].join("\n");
}
