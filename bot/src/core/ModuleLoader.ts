import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { NoctaClient } from "../client.js";

// ─── Module contract ──────────────────────────────────────────────────────────

/**
 * Every module in /modules/<name>/index.ts must export a default object
 * implementing this interface.
 *
 * @example
 * // modules/music/index.ts
 * import type { NoctaModule } from "../../src/core/ModuleLoader.js";
 * const music: NoctaModule = {
 *   name: "music",
 *   description: "Music playback controls",
 *   async onLoad(client) { ... },
 *   async onUnload() { ... },
 *   async handleVoiceQuery(query) { return null; },
 * };
 * export default music;
 */
export interface NoctaModule {
  /** Unique snake_case identifier matching the directory name. */
  readonly name: string;
  readonly description: string;

  /** Called once when the module is activated for the first time. */
  onLoad(client: NoctaClient): Promise<void>;

  /** Called when the module is deactivated or the bot shuts down. */
  onUnload(): Promise<void>;

  /**
   * Optional voice query hook. Return a response string to short-circuit
   * normal AI processing, or `null` to pass through to AIEngine.
   */
  handleVoiceQuery?(query: string, guildId: string): Promise<string | null>;
}

// ─── ModuleLoader ─────────────────────────────────────────────────────────────

export class ModuleLoader {
  private readonly client: NoctaClient;
  private readonly modulesDir: string;
  private readonly loaded = new Map<string, NoctaModule>();

  constructor(client: NoctaClient, modulesDir: string) {
    this.client = client;
    this.modulesDir = modulesDir;
  }

  // ─── Guild lifecycle ──────────────────────────────────────────────────────

  /**
   * Reconcile the loaded set against a guild's `activeModules` array.
   * Loads modules that are missing, unloads ones no longer listed.
   */
  async syncForGuild(activeModules: string[]): Promise<void> {
    // Load newly activated modules
    for (const name of activeModules) {
      if (!this.loaded.has(name)) {
        await this.load(name).catch((err) => {
          console.error(`[ModuleLoader] Failed to load "${name}":`, err);
        });
      }
    }

    // Unload modules removed from the guild's list
    for (const name of this.loaded.keys()) {
      if (!activeModules.includes(name)) {
        await this.unload(name);
      }
    }
  }

  // ─── Individual load / unload ─────────────────────────────────────────────

  async load(name: string): Promise<void> {
    if (this.loaded.has(name)) return;

    const entryPath = join(this.modulesDir, name, "index.js");
    const entryUrl = pathToFileURL(entryPath).href;

    // Dynamic import — works with both ESM and transpiled CJS output
    const imported = (await import(entryUrl)) as
      | { default: NoctaModule }
      | NoctaModule;

    const mod: NoctaModule =
      "default" in imported && imported.default
        ? imported.default
        : (imported as NoctaModule);

    if (typeof mod.name !== "string" || typeof mod.onLoad !== "function") {
      throw new Error(
        `Module "${name}" does not implement the NoctaModule interface`,
      );
    }

    await mod.onLoad(this.client);
    this.loaded.set(mod.name, mod);
    console.log(`[ModuleLoader] ✓ Loaded: ${mod.name} — ${mod.description}`);
  }

  async unload(name: string): Promise<void> {
    const mod = this.loaded.get(name);
    if (!mod) return;

    try {
      await mod.onUnload();
    } catch (err) {
      console.error(`[ModuleLoader] Error unloading "${name}":`, err);
    }

    this.loaded.delete(name);
    console.log(`[ModuleLoader] ✗ Unloaded: ${name}`);
  }

  async unloadAll(): Promise<void> {
    await Promise.allSettled(
      [...this.loaded.keys()].map((name) => this.unload(name)),
    );
  }

  // ─── Voice query routing ──────────────────────────────────────────────────

  /**
   * Route a voice query through all loaded modules in insertion order.
   * The first module that returns a non-null string wins.
   * Returns `null` if no module handles the query (fall through to AIEngine).
   */
  async handleVoiceQuery(
    query: string,
    guildId: string,
  ): Promise<string | null> {
    for (const mod of this.loaded.values()) {
      if (!mod.handleVoiceQuery) continue;
      const result = await mod.handleVoiceQuery(query, guildId).catch(() => null);
      if (result !== null) return result;
    }
    return null;
  }

  // ─── Introspection ────────────────────────────────────────────────────────

  getLoaded(): ReadonlyMap<string, NoctaModule> {
    return this.loaded;
  }

  isLoaded(name: string): boolean {
    return this.loaded.has(name);
  }

  /**
   * Scan the modules directory and return all available module names
   * (i.e. directories that contain an index file).
   */
  discoverAvailable(): string[] {
    try {
      return readdirSync(this.modulesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      return [];
    }
  }
}
