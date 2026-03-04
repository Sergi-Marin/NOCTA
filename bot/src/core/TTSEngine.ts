import { Readable } from "node:stream";
import { ElevenLabsClient } from "elevenlabs";
import {
  createAudioPlayer,
  createAudioResource,
  entersState,
  AudioPlayerStatus,
  StreamType,
  NoSubscriberBehavior,
  type VoiceConnection,
} from "@discordjs/voice";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TTSEngineOptions {
  apiKey: string;
  /** ElevenLabs voice ID. Find yours at https://elevenlabs.io/app/voice-library */
  voiceId: string;
  /**
   * ElevenLabs model.
   * - eleven_turbo_v2_5 → lowest latency  (~300ms)
   * - eleven_multilingual_v2 → highest quality
   * Default: eleven_turbo_v2_5
   */
  modelId?: string;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
  };
}

// ─── TTSEngine ────────────────────────────────────────────────────────────────

export class TTSEngine {
  private readonly client: ElevenLabsClient;
  private readonly voiceId: string;
  private readonly modelId: string;
  private readonly voiceSettings: Required<NonNullable<TTSEngineOptions["voiceSettings"]>>;

  private readonly player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });

  constructor(options: TTSEngineOptions) {
    this.client = new ElevenLabsClient({ apiKey: options.apiKey });
    this.voiceId = options.voiceId;
    this.modelId = options.modelId ?? "eleven_turbo_v2_5";
    this.voiceSettings = {
      stability: options.voiceSettings?.stability ?? 0.5,
      similarityBoost: options.voiceSettings?.similarityBoost ?? 0.8,
      style: options.voiceSettings?.style ?? 0.0,
      useSpeakerBoost: options.voiceSettings?.useSpeakerBoost ?? true,
    };
  }

  /**
   * Convert `text` to speech and play it in the voice channel.
   * Resolves when playback finishes.
   */
  async speak(text: string, connection: VoiceConnection): Promise<void> {
    const audioStream = await this.client.textToSpeech.convert(this.voiceId, {
      text,
      model_id: this.modelId,
      output_format: "mp3_44100_128",
      voice_settings: {
        stability: this.voiceSettings.stability,
        similarity_boost: this.voiceSettings.similarityBoost,
        style: this.voiceSettings.style,
        use_speaker_boost: this.voiceSettings.useSpeakerBoost,
      },
    });

    // ElevenLabs returns a Web ReadableStream<Uint8Array> — convert to Node Readable
    const nodeStream =
      audioStream instanceof Readable
        ? audioStream
        : Readable.fromWeb(audioStream as Parameters<typeof Readable.fromWeb>[0]);

    const resource = createAudioResource(nodeStream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: false,
    });

    connection.subscribe(this.player);
    this.player.play(resource);

    await entersState(this.player, AudioPlayerStatus.Idle, 60_000);
  }

  /**
   * Stop current playback immediately.
   */
  stop(): void {
    this.player.stop(true);
  }

  destroy(): void {
    this.player.stop(true);
  }
}
