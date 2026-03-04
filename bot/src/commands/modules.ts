import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../client.js";
import { NoctaClient } from "../client.js";
import { getOrCreateGuild } from "../utils/context.js";

export default {
  data: new SlashCommandBuilder()
    .setName("modules")
    .setDescription("Show available and active modules for this server"),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
      return;
    }

    const client = interaction.client as NoctaClient;
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = await getOrCreateGuild(
        interaction.guildId,
        interaction.guild.name,
        interaction.guild.ownerId,
        interaction.guild.iconURL(),
      );

      const available = client.moduleLoader?.discoverAvailable() ?? [];
      const active = new Set(guild.activeModules);

      const formatModuleList = (names: string[]): string =>
        names.length > 0 ? names.map((n) => `\`${n}\``).join(", ") : "*none*";

      const activeNames = available.filter((n) => active.has(n));
      const inactiveNames = available.filter((n) => !active.has(n));

      // Modules active in DB but not on disk (orphaned)
      const orphanedNames = guild.activeModules.filter((n) => !available.includes(n));

      const embed = new EmbedBuilder()
        .setTitle("NOCTA Modules")
        .setColor(0x5865f2)
        .setThumbnail(interaction.guild.iconURL())
        .addFields(
          {
            name: `✅ Active (${activeNames.length})`,
            value: formatModuleList(activeNames),
          },
          {
            name: `⭕ Available (${inactiveNames.length})`,
            value: formatModuleList(inactiveNames),
          },
        )
        .setFooter({ text: `${available.length} module(s) installed` })
        .setTimestamp();

      if (orphanedNames.length > 0) {
        embed.addFields({
          name: "⚠️ Orphaned (in DB but not on disk)",
          value: formatModuleList(orphanedNames),
        });
      }

      if (available.length === 0) {
        embed.setDescription(
          "No modules are installed yet. Add module directories to `bot/src/modules/`.",
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[/modules]", err);
      await interaction.editReply("Failed to fetch module information.");
    }
  },
} satisfies Command;
