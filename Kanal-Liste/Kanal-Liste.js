"use strict";

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

// =====================================================
// SLASH COMMAND
// =====================================================

const kanalListCommand = new SlashCommandBuilder()
    .setName("kanal")
    .setDescription("Kanal-Management")
    .addSubcommand(sub =>
        sub.setName("id")
            .setDescription("Zeigt alle Kanäle mit IDs")
    )
    .addSubcommand(sub =>
        sub.setName("commands")
            .setDescription("Zeigt alle Slash-Commands")
    );

// =====================================================
// COMMAND HANDLER
// =====================================================

async function handleKanalCommand(interaction) {
    if (!interaction.isChatInputCommand()) return;
    
    // Prüfen, ob die Interaction bereits beantwortet wurde
    if (interaction.replied || interaction.deferred) {
        return;
    }
    
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
            content: "❌ Keine Berechtigung. ManageGuild erforderlich.",
            flags: 64
        });
    }
    
    const subcommand = interaction.options.getSubcommand();
    
    try {
        await interaction.deferReply({ flags: 64 });
        
        if (subcommand === "id") {
            await handleKanalId(interaction);
        }
        if (subcommand === "commands") {
            await handleCommands(interaction);
        }
    } catch (error) {
        console.error("❌ Kanal Command Fehler:", error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ Fehler beim Ausführen des Befehls.",
                    flags: 64
                });
            } else {
                await interaction.editReply("❌ Fehler beim Ausführen des Befehls.");
            }
        } catch (replyError) {
            console.error("❌ Kanal Command: Fehlerantwort fehlgeschlagen:", replyError.message);
        }
    }
}

async function handleKanalId(interaction) {
    const guild = interaction.guild;
    
    if (!guild) {
        return interaction.editReply("❌ Server nicht gefunden.");
    }
    
    const channels = guild.channels.cache;
    
    // Alle Kanäle als einfache Liste
    let channelList = `📋 Alle Kanäle von **${guild.name}**\n\n`;
    
    channels.forEach(channel => {
        let emoji = "";
        if (channel.type === ChannelType.GuildText) emoji = "💬";
        else if (channel.type === ChannelType.GuildVoice) emoji = "🔊";
        else if (channel.type === ChannelType.GuildCategory) emoji = "📁";
        else if (channel.type === ChannelType.GuildAnnouncement) emoji = "📢";
        else if (channel.type === ChannelType.GuildForum) emoji = "�";
        else emoji = "📌";
        
        channelList += `${emoji} ${channel.name} - \`${channel.id}\`\n`;
    });
    
    // Nachricht in Chunks aufteilen (max 2000 Zeichen)
    const chunks = [];
    const chunkSize = 1900;
    
    for (let i = 0; i < channelList.length; i += chunkSize) {
        chunks.push(channelList.substring(i, i + chunkSize));
    }
    
    // Erste Nachricht als reply
    await interaction.editReply(chunks[0]);
    
    // Weitere Chunks als followUp
    for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp(chunks[i]);
    }
}

async function handleCommands(interaction) {
    const guild = interaction.guild;
    
    if (!guild) {
        return interaction.editReply("❌ Server nicht gefunden.");
    }
    
    const commands = await guild.commands.fetch();
    
    const embed = new EmbedBuilder()
        .setColor(0x4A90E2)
        .setTitle("📋 Alle Slash-Commands")
        .setDescription(`Server: ${guild.name}\nGesamt: ${commands.size} Commands`)
        .setFooter({ text: "🇩🇪 Novex RP • VC • Made by Devin", iconURL: null })
        .setTimestamp();
    
    // Commands nach Kategorien gruppieren
    const commandsByCategory = {};
    commands.forEach(cmd => {
        const category = cmd.name.split(" ")[0] || "Allgemein";
        if (!commandsByCategory[category]) {
            commandsByCategory[category] = [];
        }
        commandsByCategory[category].push(cmd);
    });
    
    // Commands als Embed-Felder hinzufügen
    Object.entries(commandsByCategory).forEach(([category, cmds]) => {
        const commandList = cmds.map(c => `/${c.name} - ${c.description}`).join("\n");
        embed.addFields({
            name: `${category} (${cmds.length})`,
            value: commandList.substring(0, 1024),
            inline: false
        });
    });
    
    await interaction.editReply({ embeds: [embed] });
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    command: kanalListCommand,
    handle: handleKanalCommand
};
