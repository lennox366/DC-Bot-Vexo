"use strict";

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

// =====================================================
// CONFIGURATION
// =====================================================

const CONFIG = {
    restoreCordUrl: "https://restorecord.com/verify/1510593847972073653?verifying=1",
    designColor: 0x4A90E2, // Dunkelblau
    footer: "Novex RP | Verification System",
    unverifiedRoleId: "1569408306697736202", // Unverifizierte Rolle
    citizenRoleId: "1569408304780681216" // Bürgerrolle
};

// =====================================================
// EMBED ERSTELLEN
// =====================================================

function createVerifyEmbed() {
    return new EmbedBuilder()
        .setColor(CONFIG.designColor)
        .setTitle("🔐 Novex RP | Verification")
        .setDescription("🎃 Willkommen bei Novex RP!\n\nUm dem Server beizutreten, musst du dich zuerst verifizieren.\nKlicke unten auf Verify oder Verifizieren, um Zugriff auf alle Kanäle und Bereiche des Servers zu erhalten.\n\nViel Spaß auf Novex RP! 🇩🇪")
        .setFooter({ text: CONFIG.footer, iconURL: null })
        .setTimestamp();
}

// =====================================================
// BUTTON ERSTELLEN
// =====================================================

function createVerifyButton() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("🔐 Verify")
            .setStyle(ButtonStyle.Link)
            .setURL(CONFIG.restoreCordUrl),
        new ButtonBuilder()
            .setLabel("✅ Verifizieren")
            .setStyle(ButtonStyle.Success)
            .setCustomId("verify_button")
    );
}

// =====================================================
// SLASH COMMAND
// =====================================================

const verifyPanelCommand = new SlashCommandBuilder()
    .setName("verify-panel")
    .setDescription("Erstellt ein Verify-Panel")
    .addChannelOption(option =>
        option.setName("kanal")
            .setDescription("Kanal, wo das Panel gepostet werden soll (optional)")
            .setRequired(false)
    );

// =====================================================
// COMMAND HANDLER
// =====================================================

async function handleVerifyPanelCommand(interaction) {
    if (!interaction.isChatInputCommand()) return;
    
    // Prüfen, ob bereits beantwortet
    if (interaction.replied || interaction.deferred) return;
    
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
            content: "❌ Keine Berechtigung. ManageGuild erforderlich.",
            flags: 64
        });
    }
    
    try {
        const channelOption = interaction.options.getChannel("kanal");
        const targetChannel = channelOption || interaction.channel;
        
        const embed = createVerifyEmbed();
        const button = createVerifyButton();
        
        await targetChannel.send({ embeds: [embed], components: [button] });
        
        await interaction.reply({
            content: `✅ Verify-Panel in ${targetChannel} gesendet!`,
            flags: 64
        });
    } catch (error) {
        console.error("❌ Verify Panel Command Fehler:", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ Fehler beim Senden des Verify-Panels.",
                flags: 64
            });
        }
    }
}

async function handleVerifyButton(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "verify_button") return;
    
    const member = interaction.member;
    
    try {
        await interaction.deferReply({ flags: 64 });
        
        // Unverifizierte Rolle entfernen
        if (member.roles.cache.has(CONFIG.unverifiedRoleId)) {
            await member.roles.remove(CONFIG.unverifiedRoleId);
        }
        
        // Bürgerrolle hinzufügen
        if (!member.roles.cache.has(CONFIG.citizenRoleId)) {
            await member.roles.add(CONFIG.citizenRoleId);
        }
        
        await interaction.editReply({
            content: "✅ Du hast dich erfolgreich verifiziert! Willkommen bei Novex RP!"
        });
    } catch (error) {
        console.error("❌ Verify Button Fehler:", error);
        await interaction.editReply({
            content: "❌ Fehler beim Verifizieren. Bitte kontaktiere einen Admin."
        });
    }
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    command: verifyPanelCommand,
    handle: handleVerifyPanelCommand,
    handleButton: handleVerifyButton
};
