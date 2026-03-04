import { SlashCommandBuilder, ChannelType, type VoiceChannel } from "discord.js";
import type { Command } from "../client.js";
import { NoctaClient } from "../client.js";

export default {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("NOCTA joins your voice channel and starts listening for the wake word"),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const client = interaction.client as NoctaClient;

    // ── Validate user is in a voice channel ──────────────────────────────────
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.reply({
        content: "You need to be in a voice channel first.",
        ephemeral: true,
      });
      return;
    }

    // ── Check bot permissions ────────────────────────────────────────────────
    const me = interaction.guild.members.me;
    if (!voiceChannel.permissionsFor(me!).has(["Connect", "Speak"])) {
      await interaction.reply({
        content: "I don't have permission to join or speak in that channel.",
        ephemeral: true,
      });
      return;
    }

    // ── Check voice pipeline is initialised ──────────────────────────────────
    if (!client.pipeline) {
      await interaction.reply({
        content: "The voice pipeline is not configured. Make sure `PICOVOICE_ACCESS_KEY` and `ELEVENLABS_API_KEY` are set.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await client.pipeline.join(voiceChannel as VoiceChannel);
      await interaction.editReply(
        `Joined **${voiceChannel.name}**. Say **"Nocta"** to wake me up.`,
      );
    } catch (err) {
      console.error("[/join]", err);
      await interaction.editReply("Failed to join the voice channel. Check the logs.");
    }
  },
} satisfies Command;
