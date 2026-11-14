// commands/log.js
// Falls dein Projekt ein anderes Command-Loader-Schema nutzt, passe nur den Export
// an dessen bestehende Struktur an.
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { runLogTest } = require("../logging");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("log")
    .setDescription("WexRP Logging-Verwaltung")
    .addSubcommand(sub => sub.setName("test").setDescription("Testet alle eingerichteten Log-Bereiche"))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Dafür benötigst du Administratorrechte.", ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const results = await runLogTest(interaction.client, interaction.user);
      const ok = results.filter(r => r.ok).length;
      const failed = results.length - ok;
      const embed = new EmbedBuilder()
        .setColor(failed ? 0xfaa61a : 0x3ba55d)
        .setTitle("🧪 WexRP | Log-Test abgeschlossen")
        .setDescription("Es wurden ausschließlich Testnachrichten gesendet. Es wurden keine echten Serveraktionen ausgeführt.")
        .addFields(
          { name: "Gefundene Log-Bereiche", value: String(results.length), inline: true },
          { name: "Erfolgreich", value: `🟢 ${ok}`, inline: true },
          { name: "Fehlgeschlagen", value: `🔴 ${failed}`, inline: true },
          { name: "Details", value: results.map(r => `${r.ok ? "🟢" : "🔴"} ${r.category}${r.ok ? "" : ` – ${r.error}`}`).join("\n").slice(0, 1024) || "Keine Ergebnisse" }
        )
        .setFooter({ text: "WexRP | Logging System" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      return interaction.editReply({ content: `❌ Log-Test fehlgeschlagen: ${error.message}` });
    }
  }
};
