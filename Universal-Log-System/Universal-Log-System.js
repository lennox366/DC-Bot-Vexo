"use strict";

const fs = require("fs");
const path = require("path");
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder
} = require("discord.js");

// =====================================================
// LOG-DATEIEN REGISTRIERUNG
// =====================================================

const LOG_FILES = {
    "box": {
        path: "./Universal-Log-System/box-logs.json",
        description: "Box-Logs"
    },
    "gang": {
        path: "./Gang-System/gangs.json",
        description: "Gang-Logs"
    },
    "group": {
        path: "./Novex-Group-Management/novex-group-data.json",
        description: "Group-Management Logs"
    },
    "ticket": {
        path: "./Ticket-System.json",
        description: "Ticket-Logs"
    },
    "rp": {
        path: "./data/rp-logs.json",
        description: "RP-Logs"
    },
    "novex-group": {
        path: "./Novex-Group-Management/novex-group-logs.json",
        description: "Novex Group Logs"
    }
};

// =====================================================
// LOG LESEN
// =====================================================

function readLog(name) {
    const logConfig = LOG_FILES[name];
    if (!logConfig) {
        return { success: false, error: "Log nicht gefunden" };
    }
    
    const filePath = path.join(__dirname, logConfig.path);
    
    if (!fs.existsSync(filePath)) {
        return { success: false, error: "Log-Datei existiert nicht" };
    }
    
    try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return { success: true, data, description: logConfig.description };
    } catch (error) {
        return { success: false, error: "Fehler beim Lesen des Logs" };
    }
}

// =====================================================
// EMBED ERSTELLEN
// =====================================================

function createLogEmbed(name, logData) {
    const embed = new EmbedBuilder()
        .setColor(0x4A90E2)
        .setTitle(`📋 ${logData.description}`)
        .setDescription(`Log: ${name}`)
        .setFooter({ text: "🇩🇪 Novex RP • VC • Made by Devin", iconURL: null })
        .setTimestamp();
    
    // Log-Daten formatieren
    if (Array.isArray(logData.data)) {
        const logs = logData.data.slice(-10).reverse(); // Letzte 10 Logs
        if (logs.length > 0) {
            embed.addFields(
                logs.map((log, index) => ({
                    name: `Log #${index + 1}`,
                    value: JSON.stringify(log).substring(0, 1000),
                    inline: false
                }))
            );
        } else {
            embed.addFields({ name: "Leer", value: "Keine Logs vorhanden", inline: false });
        }
    } else if (typeof logData.data === "object") {
        embed.addFields(
            Object.entries(logData.data).slice(0, 10).map(([key, value]) => ({
                name: key,
                value: JSON.stringify(value).substring(0, 1000),
                inline: false
            }))
        );
    } else {
        embed.addFields({ name: "Inhalt", value: String(logData.data).substring(0, 1000), inline: false });
    }
    
    return embed;
}

// =====================================================
// SLASH COMMAND
// =====================================================

const LOG_NAME_CHOICES = [
    { name: "box", value: "box" },
    { name: "gang", value: "gang" },
    { name: "group", value: "group" },
    { name: "ticket", value: "ticket" },
    { name: "rp", value: "rp" },
    { name: "novex-group", value: "novex-group" }
];

const logCommand = new SlashCommandBuilder()
    .setName("log")
    .setDescription("Logs anzeigen und Logging-System testen")
    .addSubcommand(subcommand =>
        subcommand
            .setName("test")
            .setDescription("Testet alle WexRP-Log-Bereiche (nur Administratoren)")
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("anzeigen")
            .setDescription("Zeigt einen Log-Bereich an")
            .addStringOption(option =>
                option.setName("name")
                    .setDescription("Log-Name")
                    .setRequired(true)
                    .addChoices(...LOG_NAME_CHOICES)
            )
    );

// =====================================================
// COMMAND HANDLER
// =====================================================

async function handleLogTest(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: "❌ Dafür benötigst du Administratorrechte.",
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        const { runLogTest } = require("../logging");
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const results = await runLogTest(interaction.client, interaction.user);
        const ok = results.filter(r => r.ok).length;
        const failed = results.length - ok;

        const detailLines = results.map(r => `${r.ok ? "🟢" : "🔴"} ${r.category}${r.ok ? "" : ` – ${r.error}`}`);
        const detailFields = [];
        let chunk = "";
        for (const line of detailLines) {
            if ((chunk + "\n" + line).length > 1000) {
                detailFields.push({ name: detailFields.length ? "Details (Fortsetzung)" : "Details", value: chunk, inline: false });
                chunk = line;
            } else {
                chunk = chunk ? chunk + "\n" + line : line;
            }
        }
        if (chunk) {
            detailFields.push({ name: detailFields.length ? "Details (Fortsetzung)" : "Details", value: chunk, inline: false });
        }

        const embed = new EmbedBuilder()
            .setColor(failed ? 0xfaa61a : 0x3ba55d)
            .setTitle("🧪 Log-Test abgeschlossen")
            .setDescription("Jedem konfigurierten Log-Ziel wurde eine Testnachricht gesendet. Es wurden keine echten Serveraktionen ausgeführt.")
            .addFields(
                { name: "Getestete Log-Ziele", value: String(results.length), inline: true },
                { name: "Erfolgreich", value: `🟢 ${ok}`, inline: true },
                { name: "Fehlgeschlagen", value: `🔴 ${failed}`, inline: true },
                ...(detailFields.length ? detailFields : [{ name: "Details", value: "Keine Ergebnisse", inline: false }])
            )
            .setFooter({ text: "Log-Test" })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error("❌ /log test Fehler:", error);
        const content = `❌ Log-Test fehlgeschlagen: ${error.message}`;
        if (interaction.deferred || interaction.replied) {
            return interaction.editReply({ content });
        }
        return interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
}

async function handleLogCommand(interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.options.getSubcommand() === "test") {
        return handleLogTest(interaction);
    }

    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
            content: "❌ Keine Berechtigung. ManageGuild erforderlich.",
            flags: 64
        });
    }
    
    const logName = interaction.options.getString("name");
    
    try {
        await interaction.deferReply({ flags: 64 });
        
        const logResult = readLog(logName);
        
        if (!logResult.success) {
            return interaction.editReply(`❌ ${logResult.error}`);
        }
        
        const embed = createLogEmbed(logName, logResult);
        
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Log Command Fehler:", error);
        await interaction.editReply("❌ Fehler beim Ausführen des Befehls.");
    }
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    command: logCommand,
    handle: handleLogCommand,
    readLog,
    LOG_FILES
};
