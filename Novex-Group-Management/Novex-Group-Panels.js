"use strict";

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require("discord.js");

const groupSystem = require("./Novex-Group-Management.js");

// =====================================================
// PANEL BUILDER
// =====================================================

function createGroupOverviewPanel() {
    const groupData = groupSystem.getGroupData();
    const members = groupSystem.getAllMembers();
    const ranks = groupSystem.getAllRanks();
    
    const activeMembers = members.filter(m => m.status === "active").length;
    const icRightsMembers = members.filter(m => m.hasICRights).length;
    
    return new EmbedBuilder()
        .setColor(0x4A90E2)
        .setTitle("💎 Novex RP Group Management")
        .setDescription(`Interne Gruppen-ID: \`${groupData.groupId}\`\n\nVerwalte die interne Novex RP Gruppe mit Rangnummern, IC-Rechte und Mitgliedern.`)
        .addFields(
            { name: "👥 Gesamtmitglieder", value: String(members.length), inline: true },
            { name: "✅ Aktive Mitglieder", value: String(activeMembers), inline: true },
            { name: "🎮 IC-Rechte", value: String(icRightsMembers), inline: true },
            { name: "🏆 Ränge", value: String(Object.keys(ranks).length), inline: true }
        )
        .setFooter({ text: "🇩🇪 Novex RP • VC • Made by Devin", iconURL: null })
        .setTimestamp();
}

function createICRightsPanel() {
    return new EmbedBuilder()
        .setColor(0x4A90E2)
        .setTitle("Ingame-Rechte")
        .setDescription("Verwalte die Ingame-Rechte des Servers.\n\n**Rechte geben:**\nGibt sofort Roblox und Discord Rollen.\n\n**Rechte entziehen:**\nEntfernt beide Rollen.\n\n**Rechte sperren:**\nEntfernt Rechte und verhindert neue Anträge bis die Sperre aufgehoben wird.\n\n**Übersicht:**\nZeigt wer Rechte hat, wer gesperrt ist und offene Anträge.")
        .addFields(
            { name: "ℹ️ Info", value: "Rechte können nicht an sich selbst oder Personen gleichen/höheren Ranges vergeben werden.\nRechte können nur von Jr. Moderator oder höher vergeben werden.", inline: false }
        )
        .setFooter({ text: "Bug gefunden oder funktioniert etwas nicht? Nutze den Befehl /bugreport", iconURL: null })
        .setTimestamp();
}

function createICRightsButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ic_give")
            .setLabel("Rechte geben")
            .setStyle(ButtonStyle.Success)
            .setEmoji("⬆️"),
        new ButtonBuilder()
            .setCustomId("ic_revoke")
            .setLabel("Rechte entziehen")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("⬇️"),
        new ButtonBuilder()
            .setCustomId("ic_overview")
            .setLabel("Übersicht")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("ℹ️"),
        new ButtonBuilder()
            .setCustomId("ic_suspend")
            .setLabel("Rechte sperren")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("�"),
        new ButtonBuilder()
            .setCustomId("ic_unsuspend")
            .setLabel("Sperre aufheben")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🔄")
    );
}

function createICApplicationPanel() {
    return new EmbedBuilder()
        .setColor(0x4A90E2)
        .setTitle("Ingame-Rechte Beantragen")
        .setDescription("So beantragst du Ingame-Rechte:\n\n**Schritt 1:** Gib deinen Roblox-Account an\n**Schritt 2:** Sende eine Join-Request an die Roblox-Community\n**Schritt 3:** Reiche deinen Antrag ein\n\nDie Leitung wird deinen Antrag prüfen. Bei Genehmigung erhältst du Ingame-Rechte und die Ingame-Rechte Rolle per DM.")
        .addFields(
            { name: "📋 Wichtig", value: "Stelle sicher, dass du alle korrekten Informationen angibst.", inline: false }
        )
        .setFooter({ text: "🇩🇪 Novex RP • VC • Made by Devin", iconURL: null })
        .setTimestamp();
}

function createGroupOverviewButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("group_add_member")
            .setLabel("👤 Mitglied hinzufügen")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("group_view_members")
            .setLabel("👥 Mitglieder ansehen")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("group_view_ranks")
            .setLabel("🏆 Ränge ansehen")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("group_view_logs")
            .setLabel("📋 Logs ansehen")
            .setStyle(ButtonStyle.Secondary)
    );
}

function createMemberSelectMenu(members) {
    const select = new StringSelectMenuBuilder()
        .setCustomId("group_member_select")
        .setPlaceholder("Mitglied auswählen...");
    
    if (members.length === 0) {
        select.addOptions({
            label: "Keine Mitglieder vorhanden",
            value: "none",
            description: "Es sind noch keine Mitglieder gespeichert"
        });
    } else {
        members.slice(0, 25).forEach(member => {
            select.addOptions({
                label: `${member.rankName} - ${member.discordId}`,
                value: member.discordId,
                description: member.status === "active" ? "Aktiv" : "Inaktiv"
            });
        });
    }
    
    return select;
}

function createMemberActionsPanel(discordId) {
    const member = groupSystem.getMember(discordId);
    if (!member) {
        return new EmbedBuilder()
            .setColor(0xF2564B)
            .setTitle("❌ Mitglied nicht gefunden")
            .setDescription("Das ausgewählte Mitglied konnte nicht gefunden werden.");
    }
    
    return new EmbedBuilder()
        .setColor(0x4A90E2)
        .setTitle(`👤 Mitglied: ${member.discordId}`)
        .addFields(
            { name: "Roblox-ID", value: member.robloxId || "Nicht verknüpft", inline: true },
            { name: "Rang", value: `${member.rankName} (Nr. ${member.rankNumber})`, inline: true },
            { name: "IC-Rechte", value: member.hasICRights ? "✅ Ja" : "❌ Nein", inline: true },
            { name: "Status", value: member.status === "active" ? "✅ Aktiv" : "❌ Inaktiv", inline: true },
            { name: "Beitritsdatum", value: new Date(member.joinDate).toLocaleDateString("de-DE"), inline: true },
            { name: "Letzte Änderung", value: new Date(member.lastRankChange).toLocaleDateString("de-DE"), inline: true }
        )
        .setFooter({ text: "Novex RP Group Management", iconURL: null })
        .setTimestamp();
}

function createRankSelectMenu() {
    const ranks = groupSystem.getAllRanks();
    const select = new StringSelectMenuBuilder()
        .setCustomId("group_rank_select")
        .setPlaceholder("Rang auswählen...");
    
    Object.entries(ranks)
        .sort(([a], [b]) => Number(b) - Number(a))
        .forEach(([rankNumber, rank]) => {
            select.addOptions({
                label: `${rank.name} (Nr. ${rankNumber})`,
                value: rankNumber,
                description: rank.description
            });
        });
    
    return select;
}

function createRankManagementPanel() {
    const ranks = groupSystem.getAllRanks();
    
    return new EmbedBuilder()
        .setColor(0x4A90E2)
        .setTitle("🏆 Rangverwaltung")
        .setDescription(`Verwalte alle ${Object.keys(ranks).length} Ränge des Novex RP Systems.`)
        .setFooter({ text: "Novex RP Group Management", iconURL: null })
        .setTimestamp();
}

function createConfirmModal(action, target) {
    return new ModalBuilder()
        .setCustomId(`group_confirm_${action}`)
        .setTitle("⚠️ Bestätigung erforderlich")
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("confirm_reason")
                    .setLabel("Grund eingeben")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Warum willst du diese Aktion durchführen?")
                    .setRequired(true)
                    .setMinLength(2)
                    .setMaxLength(500)
            )
        );
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    createGroupOverviewPanel,
    createGroupOverviewButtons,
    createICRightsPanel,
    createICRightsButtons,
    createICApplicationPanel,
    createMemberSelectMenu,
    createMemberActionsPanel,
    createRankSelectMenu,
    createRankManagementPanel,
    createConfirmModal
};
