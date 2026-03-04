import { SlashCommandBuilder } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import type { Command } from "../client.js";
import { NoctaClient } from "../client.js";

export default {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("NOCTA leaves the current voice channel"),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const client = interaction.client as NoctaClient;
    const guildId = interaction.guildId;

    const connection = getVoiceConnection(guildId);
    if (!connection) {
      await interaction.reply({ content: "I'm not in a voice channel.", ephemeral: true });
      return;
    }

    client.pipeline?.leave(guildId);

    await interaction.reply({ content: "Left the voice channel. Goodbye!", ephemeral: true });
  },
} satisfies Command;
