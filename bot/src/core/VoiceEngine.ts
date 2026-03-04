import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import {
  joinVoiceChannel,
  entersState,
  getVoiceConnection,
  VoiceConnectionStatus,
  EndBehaviorType,
  type VoiceConnection,
  type VoiceReceiver,
} from "@discordjs/voice";
import type { VoiceChannel } from "discord.js";

// prism-media is CJS-only — use createRequire for safe ESM interop
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prism = require("prism-media") as any;

// ─── Audio constants ───────────────────────────────────────────────────────────
// Discord sends stereo Opus at 48kHz. Porcupine needs mono PCM at 16kHz.
const DISCORD_SAMPLE_RATE = 48_000;
const DISCORD_CHANNELS = 2;
const PORCUPINE_SAMPLE_RATE = 16_000;
const DOWNSAMPLE_FACTOR = DISCORD_SAMPLE_RATE / PORCUPINE_SAMPLE_RATE; // 3
const OPUS_FRAME_SIZE = 960; // 20ms at 48kHz

// ─── VAD constants ────────────────────────────────────────────────────────────
/** RMS below this value counts as silence. Tune between 100–400. */
const SILENCE_RMS_THRESHOLD = 250;
/** Consecutive silent Porcupine frames before we close the recording (~0.8s). */
const SILENCE_FRAME_COUNT = 25;
/** Safety cap: stop recording after ~12 seconds regardless. */
const MAX_RECORD_FRAMES = 375;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceEngineOptions {
  /** Picovoice console access key — https://console.picovoice.ai */
  picovoiceAccessKey: string;
  /**
   * Absolute path to the custom "Nocta" keyword model (.ppn).
   * Train at https://console.picovoice.ai/ppn and download for your platform.
   */
  keywordModelPath: string;
  /** Wake word detection sensitivity 0–1. Default 0.5. */
  sensitivity?: number;
}

export interface VoiceQueryEvent {
  userId: string;
  guildId: string;
  /** 16-bit 16kHz mono PCM of the query utterance (after the wake word). */
  pcm: Int16Array;
  durationMs: number;
}

type EngineState = "idle" | "listening" | "recording";

// ─── Typed event overloads ─────────────────────────────────────────────────────

export declare interface VoiceEngine {
  on(event: "wakeWord", listener: (userId: string, guildId: string) => void): this;
  on(event: "query", listener: (event: VoiceQueryEvent) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;

  emit(event: "wakeWord", userId: string, guildId: string): boolean;
  emit(event: "query", payload: VoiceQueryEvent): boolean;
  emit(event: "error", error: Error): boolean;
}

// ─── VoiceEngine ──────────────────────────────────────────────────────────────

export class VoiceEngine extends EventEmitter {
  private readonly options: Required<VoiceEngineOptions>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private porcupine: any | null = null;

  private state: EngineState = "idle";
  private activeUserId: string | null = null;
  private recordBuffer: Int16Array[] = [];
  private silenceFrameCount = 0;
  private recordingStartedAt = 0;

  constructor(options: VoiceEngineOptions) {
    super();
    this.options = { sensitivity: 0.5, ...options };
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async join(channel: VoiceChannel): Promise<void> {
    this.initPorcupine();

    const connection =
      getVoiceConnection(channel.guild.id) ??
      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        // Cast required: discord.js and @discordjs/voice ship slightly
        // mismatched GatewayVoiceState types under exactOptionalPropertyTypes.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        adapterCreator: channel.guild.voiceAdapterCreator as any,
        selfDeaf: false, // must be false to receive audio
        selfMute: false,
      });

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

    connection.on("stateChange", (_old, newState) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        this.state = "idle";
        this.activeUserId = null;
      }
    });

    this.state = "listening";
    this.attachReceiver(connection, channel.guild.id);
  }

  leave(guildId: string): void {
    getVoiceConnection(guildId)?.destroy();
    this.state = "idle";
    this.activeUserId = null;
    this.recordBuffer = [];
  }

  destroy(): void {
    this.porcupine?.release();
    this.porcupine = null;
    this.state = "idle";
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private initPorcupine(): void {
    if (this.porcupine) return;
    // Dynamic require — Porcupine is a CJS native addon
    const { Porcupine } = require("@picovoice/porcupine-node");
    this.porcupine = new Porcupine(
      this.options.picovoiceAccessKey,
      [this.options.keywordModelPath],
      [this.options.sensitivity],
    );
  }

  private attachReceiver(connection: VoiceConnection, guildId: string): void {
    const receiver: VoiceReceiver = connection.receiver;

    receiver.speaking.on("start", (userId) => {
      // Only allow the active speaker while recording; accept anyone while listening
      if (this.state === "recording" && this.activeUserId !== userId) return;

      const opusStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.Manual },
      });

      const decoder = new prism.opus.Decoder({
        rate: DISCORD_SAMPLE_RATE,
        channels: DISCORD_CHANNELS,
        frameSize: OPUS_FRAME_SIZE,
      });

      opusStream.pipe(decoder);

      // Accumulate raw bytes until we have enough for one Porcupine frame
      let carry = Buffer.alloc(0);
      const frameBytesRequired =
        this.porcupine!.frameLength * DOWNSAMPLE_FACTOR * DISCORD_CHANNELS * 2;

      decoder.on("data", (chunk: Buffer) => {
        carry = Buffer.concat([carry, chunk]);
        while (carry.length >= frameBytesRequired) {
          const raw = carry.subarray(0, frameBytesRequired);
          carry = carry.subarray(frameBytesRequired);
          const mono16k = this.stereoToMono16k(raw);
          this.processFrame(userId, guildId, mono16k);
        }
      });

      opusStream.on("end", () => {
        decoder.destroy();
        // Treat stream end as definitive silence while recording
        if (this.state === "recording" && this.activeUserId === userId) {
          this.finalizeRecording(guildId);
        }
      });

      opusStream.on("error", (err: Error) => this.emit("error", err));
      decoder.on("error", (err: Error) => this.emit("error", err));
    });
  }

  private processFrame(userId: string, guildId: string, frame: Int16Array): void {
    if (this.state === "listening") {
      const keywordIndex: number = this.porcupine!.process(frame);
      if (keywordIndex >= 0) {
        this.state = "recording";
        this.activeUserId = userId;
        this.recordBuffer = [];
        this.silenceFrameCount = 0;
        this.recordingStartedAt = Date.now();
        this.emit("wakeWord", userId, guildId);
      }
    } else if (this.state === "recording" && this.activeUserId === userId) {
      this.recordBuffer.push(frame);

      const rms = this.computeRms(frame);
      if (rms < SILENCE_RMS_THRESHOLD) {
        this.silenceFrameCount++;
      } else {
        this.silenceFrameCount = 0;
      }

      const timedOut = this.recordBuffer.length >= MAX_RECORD_FRAMES;
      const silenceDetected = this.silenceFrameCount >= SILENCE_FRAME_COUNT;

      if (timedOut || silenceDetected) {
        this.finalizeRecording(guildId);
      }
    }
  }

  private finalizeRecording(guildId: string): void {
    if (this.state !== "recording" || this.recordBuffer.length === 0) return;

    const totalLength = this.recordBuffer.reduce((n, f) => n + f.length, 0);
    const pcm = new Int16Array(totalLength);
    let offset = 0;
    for (const frame of this.recordBuffer) {
      pcm.set(frame, offset);
      offset += frame.length;
    }

    const durationMs = Date.now() - this.recordingStartedAt;
    const userId = this.activeUserId!;

    // Reset state before emitting so handlers can start a new cycle
    this.state = "listening";
    this.activeUserId = null;
    this.recordBuffer = [];
    this.silenceFrameCount = 0;

    this.emit("query", { userId, guildId, pcm, durationMs });
  }

  /**
   * Convert stereo 48kHz 16-bit PCM → mono 16kHz.
   * Averages L+R channels and takes every 3rd frame (decimation).
   */
  private stereoToMono16k(raw: Buffer): Int16Array {
    const stereoFrameCount = raw.length / (DISCORD_CHANNELS * 2);
    const outputLength = Math.floor(stereoFrameCount / DOWNSAMPLE_FACTOR);
    const out = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcFrame = i * DOWNSAMPLE_FACTOR;
      const lOffset = srcFrame * DISCORD_CHANNELS * 2;
      const rOffset = lOffset + 2;
      const l = raw.readInt16LE(lOffset);
      const r = raw.readInt16LE(rOffset);
      out[i] = Math.round((l + r) / 2);
    }

    return out;
  }

  private computeRms(frame: Int16Array): number {
    let sum = 0;
    for (const s of frame) sum += s * s;
    return Math.sqrt(sum / frame.length);
  }
}
