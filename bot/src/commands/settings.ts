import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../client.js";
import { getOrCreateGuild } from "../utils/context.js";

const PLAN_COLORS: Record<string, number> = {
  FREE: 0x99aab5,
  PRO: 0x5865f2,
  PREMIUM: 0xfaa61a,
};

export default {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Show current configuration for this server"),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = await getOrCreateGuild(
        interaction.guildId,
        interaction.guild.name,
        interaction.guild.ownerId,
        interaction.guild.iconURL(),
      );

      const s = guild.settings;

      const channelMention = (id: string | null | undefined): string =>
        id ? `<#${id}>` : "*not set*";

      const roleMention = (id: string | null | undefined): string =>
        id ? `<@&${id}>` : "*not set*";

      const embed = new EmbedBuilder()
        .setTitle(`${interaction.guild.name} — Settings`)
        .setColor(PLAN_COLORS["FREE"] ?? 0x99aab5)
        .setThumbnail(interaction.guild.iconURL())
        .addFields(
          {
            name: "🔧 General",
            value: [
              `**Prefix:** \`${s?.prefix ?? "!"}\``,
              `**Language:** \`${s?.language ?? "en"}\``,
            ].join("\n"),
            inline: true,
          },
          {
            name: "📢 Channels",
            value: [
              `**Log channel:** ${channelMention(s?.logChannelId)}`,
              `**Welcome channel:** ${channelMention(s?.welcomeChannelId)}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "👥 Roles",
            value: [
              `**Mod role:** ${roleMention(s?.modRoleId)}`,
              `**Admin role:** ${roleMention(s?.adminRoleId)}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "💬 Welcome message",
            value: s?.welcomeMessage
              ? `\`\`\`${s.welcomeMessage.slice(0, 200)}\`\`\``
              : "*not set*",
          },
          {
            name: "🧩 Active modules",
            value:
              guild.activeModules.length > 0
                ? guild.activeModules.map((m) => `\`${m}\``).join(", ")
                : "*none*",
          },
        )
        .setFooter({ text: `Guild ID: ${guild.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[/settings]", err);
      await interaction.editReply("Failed to fetch server settings.");
    }
  },
} satisfies Command;
