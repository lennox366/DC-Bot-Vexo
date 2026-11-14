"use strict";

const fs = require("fs");
const path = require("path");
const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

// =====================================================
// 📊 TEAM-STATISTIK (/statistik teamler)
// =====================================================

const SERVER_NAME = "💫 NOVEX RP";
const COLOR = 0x8052ff;
const CONFIG_FILE = path.join(__dirname, "..", "team-roles-config.json");
const EPHEMERAL = { flags: MessageFlags.Ephemeral };

function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    } catch (e) {
        console.error("[TEAM-STAT] Config konnte nicht gelesen werden:", e.message);
        return { staffRoleId: null, roleHierarchy: [] };
    }
}

function allTeamRoleIds(config) {
    const ids = new Set();
    for (const cat of config.roleHierarchy || []) {
        for (const r of cat.roles || []) ids.add(r.id);
    }
    if (config.staffRoleId) ids.add(config.staffRoleId);
    return ids;
}

async function buildTeamlerEmbed(guild) {
    const config = loadConfig();
    const teamRoleIds = allTeamRoleIds(config);
    const members = await guild.members.fetch();

    // Kategorie -> Map<userId, member>
    const byCategory = new Map();
    const seen = new Set();
    for (const cat of config.roleHierarchy || []) {
        byCategory.set(cat.category, new Map());
    }

    for (const member of members.values()) {
        if (member.user.bot) continue;
        const matching = [...member.roles.cache.keys()].filter(id => teamRoleIds.has(id));
        if (!matching.length || seen.has(member.id)) continue;
        seen.add(member.id);
        // Ein Member kann in mehreren Kategorien auftauchen – wir nehmen die erste passende Kategorie
        for (const cat of config.roleHierarchy || []) {
            const catRoleIds = new Set((cat.roles || []).map(r => r.id));
            if (matching.some(id => catRoleIds.has(id))) {
                byCategory.get(cat.category).set(member.id, member);
                break;
            }
        }
    }

    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`👥 ${SERVER_NAME.replace("💫 ", "")} • TEAMLER-STATISTIK`)
        .setDescription(`**${seen.size}** Teamler auf dem Server`)
        .setFooter({ text: `${SERVER_NAME} • Team-Statistik` })
        .setTimestamp();

    const fields = [];
    for (const [category, map] of byCategory) {
        if (!map.size) continue;
        const names = [...map.values()]
            .sort((a, b) => a.displayName.localeCompare(b.displayName, "de"))
            .slice(0, 20)
            .map(m => `• <@${m.id}>`)
            .join("\n");
        const extra = map.size > 20 ? `\n*… und ${map.size - 20} weitere*` : "";
        fields.push({ name: `${category} (${map.size})`, value: (names + extra).slice(0, 1024), inline: false });
    }

    // Staff-Rolle separat, falls nicht in Hierarchie
    if (config.staffRoleId) {
        const staffMembers = [...members.values()].filter(m => !m.user.bot && m.roles.cache.has(config.staffRoleId));
        if (staffMembers.length) {
            fields.push({
                name: `⭐ Staff Team (${staffMembers.length})`,
                value: staffMembers.slice(0, 20).map(m => `• <@${m.id}>`).join("\n").slice(0, 1024),
                inline: false
            });
        }
    }

    if (!fields.length) {
        embed.setDescription("Derzeit sind keine Teamler mit konfigurierten Team-Rollen auf dem Server.");
    } else {
        embed.addFields(fields.slice(0, 25));
    }
    return embed;
}

const teamStatistikCommand = new SlashCommandBuilder()
    .setName("statistik")
    .setDescription("Server-Statistiken")
    .addSubcommand(s => s.setName("teamler").setDescription("Zeigt alle Teamler und deren Anzahl"));

async function handleTeamStatistik(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "statistik") return;
    if (!interaction.guild) return interaction.reply({ content: "❌ Nur auf Servern.", ...EPHEMERAL });
    const sub = interaction.options.getSubcommand();
    if (sub !== "teamler") return;
    await interaction.deferReply(EPHEMERAL);
    try {
        const embed = await buildTeamlerEmbed(interaction.guild);
        return interaction.editReply({ embeds: [embed] });
    } catch (e) {
        console.error("[TEAM-STAT] Fehler:", e);
        return interaction.editReply("❌ Statistiken konnten nicht erstellt werden.");
    }
}

let initialized = false;
function initializeTeamStatistik(client) {
    if (initialized) return;
    initialized = true;
    client.on("interactionCreate", handleTeamStatistik);
    async function register() {
        for (const guild of client.guilds.cache.values()) {
            try { await guild.commands.create(teamStatistikCommand.toJSON()); }
            catch (e) { console.error("[TEAM-STAT] Registrierung:", e.message); }
        }
    }
    if (client.isReady()) void register();
    else client.once("clientReady", () => void register());
    client.on("guildCreate", async g => {
        try { await g.commands.create(teamStatistikCommand.toJSON()); }
        catch (e) { console.error("[TEAM-STAT] guildCreate:", e.message); }
    });
    console.log("📊 Team-Statistik-System initialisiert (/statistik teamler).");
}

module.exports = { initializeTeamStatistik, command: teamStatistikCommand };
