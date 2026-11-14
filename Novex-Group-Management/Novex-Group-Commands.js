"use strict";

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const groupSystem = require("./Novex-Group-Management.js");
const panels = require("./Novex-Group-Panels.js");

// =====================================================
// SLASH COMMANDS
// =====================================================

const groupManagementCommand = new SlashCommandBuilder()
    .setName("ec-panel")
    .setDescription("Ingame-Rechte Panel")
    .addSubcommand(sub =>
        sub.setName("panel")
            .setDescription("Zeigt das IC-Rechte Panel")
    )
    .addSubcommand(sub =>
        sub.setName("geben")
            .setDescription("IC-Rechte an einen Benutzer geben")
            .addUserOption(option =>
                option.setName("benutzer")
                    .setDescription("Discord-Benutzer")
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName("beantragen")
            .setDescription("IC-Rechte beantragen")
            .addStringOption(option =>
                option.setName("roblox-id")
                    .setDescription("Deine Roblox-ID")
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName("antragentext")
            .setDescription("IC-Rechte Antragsnachricht senden")
    );

// =====================================================
// COMMAND HANDLER
// =====================================================

async function handleGroupCommand(interaction) {
    if (!interaction.isChatInputCommand()) return;
    
    const subcommand = interaction.options.getSubcommand();
    
    try {
        switch (subcommand) {
            case "panel":
                await handlePanel(interaction);
                break;
            case "geben":
                await handleGive(interaction);
                break;
            case "beantragen":
                await handleApply(interaction);
                break;
            case "antragentext":
                await handleApplicationText(interaction);
                break;
        }
    } catch (error) {
        console.error("❌ EC-Panel Command Fehler:", error);
        if (interaction.deferred) {
            await interaction.editReply("❌ Fehler beim Ausführen des Befehls.").catch(() => {});
        }
    }
}

async function handlePanel(interaction) {
    const panel = panels.createICRightsPanel();
    const buttons = panels.createICRightsButtons();
    
    await interaction.channel.send({ embeds: [panel], components: [buttons] });
    await interaction.reply({ content: "✅ Panel gesendet!", flags: 64 });
}

async function handleGive(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
            content: "❌ Keine Berechtigung. ManageGuild erforderlich.",
            flags: 64
        });
    }
    
    const user = interaction.options.getUser("benutzer");
    const result = groupSystem.syncICRights(user.id, true, interaction.user.id);
    
    if (result.success) {
        await interaction.channel.send(`✅ IC-Rechte an ${user} vergeben!`);
        await interaction.reply({ content: "✅ Rechte vergeben!", flags: 64 });
    } else {
        await interaction.reply({
            content: `❌ ${result.error}`,
            flags: 64
        });
    }
}

async function handleApply(interaction) {
    const robloxId = interaction.options.getString("roblox-id");
    
    // Modal für Benutzer-ID und Discord-ID
    const modal = new ModalBuilder()
        .setCustomId("ic_apply_modal")
        .setTitle("IC-Rechte Beantragen")
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("discord_id")
                    .setLabel("Deine Discord-ID")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Deine Discord-ID")
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("roblox_username")
                    .setLabel("Dein Roblox-Benutzername")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Dein Roblox-Benutzername")
                    .setRequired(true)
            )
        );
    
    await interaction.showModal(modal);
}

async function handleApplicationText(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
            content: "❌ Keine Berechtigung. ManageGuild erforderlich.",
            flags: 64
        });
    }
    
    const panel = panels.createICApplicationPanel();
    await interaction.channel.send({ embeds: [panel] });
    
    await interaction.reply({
        content: "✅ IC-Rechte Antragsnachricht gesendet!",
        flags: 64
    });
}

async function handleMember(interaction) {
    const user = interaction.options.getUser("benutzer");
    const members = groupSystem.getAllMembers();
    
    if (user) {
        const member = groupSystem.getMember(user.id);
        if (!member) {
            return interaction.editReply("❌ Mitglied nicht im System gefunden.");
        }
        
        const panel = panels.createMemberActionsPanel(user.id);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`group_edit_rank_${user.id}`)
                .setLabel("🏆 Rang ändern")
                .setStyle(ButtonStyle.Primary)
        );
        
        await interaction.editReply({ embeds: [panel], components: [row] });
    } else {
        const select = panels.createMemberSelectMenu(members);
        const row = new ActionRowBuilder().addComponents(select);
        
        await interaction.editReply({
            content: "👤 Wähle ein Mitglied aus:",
            components: [row]
        });
    }
}

async function handleRank(interaction) {
    const action = interaction.options.getString("action");
    
    switch (action) {
        case "list":
            const panel = panels.createRankManagementPanel();
            await interaction.editReply({ embeds: [panel] });
            break;
        case "create":
            await interaction.editReply("⚠️ Rang erstellen: Bitte benutze das Dashboard oder kontaktiere einen Admin.");
            break;
        case "update":
            await interaction.editReply("⚠️ Rang aktualisieren: Bitte benutze das Dashboard oder kontaktiere einen Admin.");
            break;
    }
}

async function handleIC(interaction) {
    const user = interaction.options.getUser("benutzer");
    const grant = interaction.options.getBoolean("erteilen");
    
    const result = groupSystem.syncICRights(user.id, grant, interaction.user.id);
    
    if (result.success) {
        await interaction.editReply(result.created 
            ? "✅ Neues Mitglied erstellt und IC-Rechte zugewiesen."
            : result.unchanged 
                ? "ℹ️ Keine Änderung nötig."
                : "✅ IC-Rechte erfolgreich aktualisiert."
        );
    } else {
        await interaction.editReply(`❌ ${result.error}`);
    }
}

// =====================================================
// INTERACTION HANDLER
// =====================================================

async function handleGroupInteraction(interaction) {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
    
    try {
        // IC-Rechte Panel Buttons
        if (interaction.customId === "ic_give") {
            await interaction.reply({
                content: "⬆️ Rechte geben: Bitte benutze `/ec-panel geben <benutzer>`",
                flags: 64
            });
        }
        
        if (interaction.customId === "ic_revoke") {
            await interaction.reply({
                content: "⬇️ Rechte entziehen: Bitte benutze `/ec-panel geben <benutzer>` und entferne die Rechte",
                flags: 64
            });
        }
        
        if (interaction.customId === "ic_overview") {
            const members = groupSystem.getAllMembers();
            const icMembers = members.filter(m => m.hasICRights);
            
            const overviewEmbed = new EmbedBuilder()
                .setColor(0x4A90E2)
                .setTitle("📋 IC-Rechte Übersicht")
                .setDescription(`Mitglieder mit IC-Rechten: ${icMembers.length}`)
                .addFields(
                    icMembers.slice(0, 10).map(m => ({
                        name: `<@${m.discordId}>`,
                        value: `Rang: ${m.rankName} (Nr. ${m.rankNumber})`,
                        inline: true
                    }))
                )
                .setFooter({ text: "🇩🇪 Novex RP • VC • Made by Devin", iconURL: null })
                .setTimestamp();
            
            await interaction.update({ embeds: [overviewEmbed] });
        }
        
        if (interaction.customId === "ic_suspend") {
            await interaction.reply({
                content: "🔧 Rechte sperren: Funktion in Entwicklung",
                flags: 64
            });
        }
        
        if (interaction.customId === "ic_unsuspend") {
            await interaction.reply({
                content: "🔄 Sperre aufheben: Funktion in Entwicklung",
                flags: 64
            });
        }
        
        // Modal Submit Handler
        if (interaction.customId === "ic_apply_modal") {
            const discordId = interaction.fields.getTextInputValue("discord_id");
            const robloxUsername = interaction.fields.getTextInputValue("roblox_username");
            
            await interaction.reply({
                content: `✅ Antrag eingereicht!\n\nDiscord-ID: ${discordId}\nRoblox-Benutzername: ${robloxUsername}\n\nDie Leitung wird deinen Antrag prüfen.`,
                flags: 64
            });
        }
    } catch (error) {
        console.error("❌ Group Interaction Fehler:", error);
    }
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    command: groupManagementCommand,
    handle: handleGroupCommand,
    handleInteraction: handleGroupInteraction
};
