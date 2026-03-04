import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../client.js";
import { NoctaClient } from "../client.js";
import { buildGuildContext } from "../utils/context.js";

const MAX_EMBED_LENGTH = 4000;

export default {
  data: new SlashCommandBuilder()
    .setName("nocta")
    .setDescription("Ask NOCTA a question via text (voice-free fallback)")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("What do you want to ask?")
        .setRequired(true)
        .setMaxLength(1000),
    ),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const client = interaction.client as NoctaClient;

    if (!client.ai) {
      await interaction.reply({
        content: "The AI engine is not configured. Make sure `ANTHROPIC_API_KEY` is set.",
        ephemeral: true,
      });
      return;
    }

    const query = interaction.options.getString("query", true);
    await interaction.deferReply();

    try {
      const { context } = await buildGuildContext({
        guildId: interaction.guildId,
        guildName: interaction.guild.name,
        guildOwnerId: interaction.guild.ownerId,
        guildIconUrl: interaction.guild.iconURL(),
        userId: interaction.user.id,
        username: interaction.user.username,
        avatarUrl: interaction.user.displayAvatarURL(),
      });

      const response = await client.ai.respond(query, context);

      const truncated =
        response.length > MAX_EMBED_LENGTH
          ? response.slice(0, MAX_EMBED_LENGTH - 3) + "..."
          : response;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({
          name: interaction.user.displayName,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .addFields({ name: "Query", value: query })
        .addFields({ name: "Response", value: truncated })
        .setFooter({ text: `Plan: ${context.plan}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[/nocta]", err);
      await interaction.editReply("Something went wrong while contacting the AI. Try again.");
    }
  },
} satisfies Command;
