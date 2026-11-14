"use strict";

const fs = require("fs");
const path = require("path");
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType
} = require("discord.js");

// =====================================================
// 🟢 SCHICHT-SYSTEM
// =====================================================

const SERVER_NAME = "💫 NOVEX RP";
const COLOR = 0x3ba55d;
const DATA_FILE = path.join(__dirname, "schichten.json");
const EPHEMERAL = { flags: MessageFlags.Ephemeral };

// Rollen, die Zeit hinzufügen/löschen dürfen (Founder, Serverbesitzer, Developer, Owner)
const TIME_MANAGER_ROLE_IDS = new Set([
    "1569408183976464535", // Server Founder
    "1569713562744659978", // Serverbesitzer
    "1569408198362927186", // Developer
    "1569408193275109527", // Owner
    "1569408194541781072", // Co.Owner
    "1569408194541781072"
]);
const LIST_PAGE_CHARS = 5200;
const LIST_PAGE_FIELDS = 24;

// -----------------------------------------------------
// DATEN
// -----------------------------------------------------

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
            d.guilds ||= {};
            d.entries ||= {};
            return d;
        }
    } catch (e) {
        console.error("[SCHICHT] Daten konnten nicht gelesen werden:", e);
    }
    return { guilds: {}, entries: {} };
}

function saveData(d) {
    try {
        const tmp = DATA_FILE + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
        fs.renameSync(tmp, DATA_FILE);
        return true;
    } catch (e) {
        console.error("[SCHICHT] Daten konnten nicht gespeichert werden:", e);
        return false;
    }
}

function getGuildConfig(guildId) {
    const d = loadData();
    if (!d.guilds[guildId]) {
        d.guilds[guildId] = { code: null, roleId: null, listChannelId: null, listMessageIds: [] };
    }
    return d.guilds[guildId];
}

function saveGuildConfig(guildId, cfg) {
    const d = loadData();
    d.guilds[guildId] = cfg;
    return saveData(d);
}

function entryKey(guildId, userId) { return `${guildId}:${userId}`; }

function getEntry(guildId, userId) {
    return loadData().entries[entryKey(guildId, userId)] || null;
}

function getGuildEntries(guildId) {
    return Object.values(loadData().entries)
        .filter(e => e.guildId === guildId)
        .sort((a, b) => a.joinedAt - b.joinedAt);
}

function saveEntry(entry) {
    const d = loadData();
    d.entries[entryKey(entry.guildId, entry.userId)] = entry;
    return saveData(d);
}

// -----------------------------------------------------
// HELPFER
// -----------------------------------------------------

function footer(text) {
    return { text: `${SERVER_NAME} • Schicht-System • ${text}` };
}

function baseEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(title)
        .setDescription(description || null)
        .setFooter(footer("Schichtverwaltung"))
        .setTimestamp();
}

function fmtDuration(minutes) {
    if (!minutes) return "0 Min.";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
}

function canManageTime(interaction) {
    const member = interaction.member;
    if (!member) return false;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    if (interaction.user.id === interaction.guild?.ownerId) return true;
    const roleIds = member.roles?.cache ? [...member.roles.cache.keys()] : (member.roles || []);
    if (roleIds.some(id => TIME_MANAGER_ROLE_IDS.has(id))) return true;
    const ownerId = interaction.client.application?.owner?.id;
    if (ownerId && interaction.user.id === ownerId) return true;
    return false;
}

// -----------------------------------------------------
// SCHICHTLISTE (auto-aktualisiert, paginiert)
// -----------------------------------------------------

function buildListPages(entries) {
    const pages = [];
    let fields = [];
    let chars = 0;

    const flush = () => {
        if (!fields.length) return;
        pages.push(fields);
        fields = [];
        chars = 0;
    };

    for (const e of entries) {
        const status = e.active ? "🟢 Auf Schicht" : "⚪ Abgemeldet";
        const value = [
            `👤 <@${e.userId}>`,
            `📅 Beigetreten: <t:${Math.floor(e.joinedAt / 1000)}:d>`,
            `⏱️ Gesamte Zeit: **${fmtDuration(e.totalMinutes)}**`,
            e.active ? `🟢 Status: Auf Schicht` : `⚪ Status: Abgemeldet`
        ].join("\n");
        const field = { name: `${status} • Eintrag ${entries.indexOf(e) + 1}`, value: value.slice(0, 1024), inline: false };
        const len = field.name.length + field.value.length + 10;
        if (fields.length >= LIST_PAGE_FIELDS || chars + len > LIST_PAGE_CHARS) flush();
        fields.push(field);
        chars += len;
    }
    flush();

    if (!pages.length) {
        pages.push([{ name: "Schichten", value: "Noch niemand hat sich für eine Schicht eingetragen.", inline: false }]);
    }
    return pages;
}

function timeButtonsRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("schicht_zeit_add").setLabel("Zeit hinzufügen").setEmoji("⏱️").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("schicht_zeit_del").setLabel("Zeit löschen").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
    );
}

async function refreshGuildList(guild) {
    const cfg = getGuildConfig(guild.id);
    if (!cfg.listChannelId) return false;
    const ch = await guild.channels.fetch(cfg.listChannelId).catch(() => null);
    if (!ch || !ch.isTextBased()) return false;

    const entries = getGuildEntries(guild.id);
    const active = entries.filter(e => e.active);
    const pages = buildListPages(entries);

    for (let i = 0; i < pages.length; i++) {
        const embed = new EmbedBuilder()
            .setColor(COLOR)
            .setTitle(`🟢 ${SERVER_NAME.replace("💫 ", "")} • SCHICHTLISTE`)
            .setDescription(`**${active.length}** auf Schicht • **${entries.length}** Einträge insgesamt • Seite ${i + 1}/${pages.length}`)
            .addFields(pages[i])
            .setFooter(footer("Schichtliste • automatisch"))
            .setTimestamp();
        const msgId = cfg.listMessageIds[i];
        if (msgId) {
            const msg = await ch.messages.fetch(msgId).catch(() => null);
            if (msg) {
                await msg.edit({ embeds: [embed], components: [timeButtonsRow()] }).catch(() => {});
                continue;
            }
        }
        const sent = await ch.send({ embeds: [embed], components: [timeButtonsRow()] }).catch(() => null);
        if (sent) cfg.listMessageIds[i] = sent.id;
    }

    for (let i = pages.length; i < cfg.listMessageIds.length; i++) {
        const msg = await ch.messages.fetch(cfg.listMessageIds[i]).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
    }
    cfg.listMessageIds = cfg.listMessageIds.slice(0, pages.length);
    saveGuildConfig(guild.id, cfg);
    return true;
}

async function refreshAllLists(client) {
    for (const guild of client.guilds.cache.values()) {
        try {
            if (getGuildConfig(guild.id).listChannelId) await refreshGuildList(guild);
        } catch (e) {
            console.error(`[SCHICHT] Listen-Refresh ${guild.id}:`, e.message);
        }
    }
}

// -----------------------------------------------------
// PANEL
// -----------------------------------------------------

function buildPanel() {
    const embed = baseEmbed(
        "🟢 SCHICHT-SYSTEM",
        "Tritt deiner Schicht bei, um Support-Pings annehmen zu können.\n\nDrücke den Button und gib den Schicht-Code ein."
    );
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("schicht_join").setLabel("Schicht antreten").setEmoji("🟢").setStyle(ButtonStyle.Success)
    );
    return { embeds: [embed], components: [row] };
}

// -----------------------------------------------------
// MODALS
// -----------------------------------------------------

function codeModal() {
    return new ModalBuilder()
        .setCustomId("schicht_code_modal")
        .setTitle("🟢 Schicht-Code eingeben")
        .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("code")
                .setLabel("Schicht-Code")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder("Code eingeben...")
        ));
}

function zeitModal(action) {
    return new ModalBuilder()
        .setCustomId(`schicht_zeit_${action}_modal`)
        .setTitle(action === "add" ? "⏱️ Zeit hinzufügen" : "🗑️ Zeit löschen")
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("user").setLabel("User (ID oder @Mention)").setStyle(TextInputStyle.Short).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("minutes").setLabel("Minuten").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("z.B. 60")
            )
        );
}

function parseUserId(input) {
    const m = /<@!?(\d+)>/.exec(String(input || "")) || /^(\d{17,20})$/.exec(String(input || "").trim());
    return m ? m[1] : null;
}

// -----------------------------------------------------
// INTERACTION-HANDLER
// -----------------------------------------------------

async function handleSchichtInteraction(interaction) {
    if (!interaction.guild) return;
    const cid = interaction.customId || "";
    const isSchicht = cid.startsWith("schicht_") || interaction.commandName === "schichtpanel" || interaction.commandName === "schichtliste" || interaction.commandName === "schichtsetup";
    if (!isSchicht) return;

    const guild = interaction.guild;
    const cfg = getGuildConfig(guild.id);

    try {
        // ---------- SLASH ----------
        if (interaction.isChatInputCommand()) {
            const name = interaction.commandName;

            if (name === "schichtpanel") {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: "🔒 Du benötigst die Berechtigung „Server verwalten“.", ...EPHEMERAL });
                }
                await interaction.deferReply(EPHEMERAL);
                await interaction.channel.send(buildPanel());
                return interaction.editReply("✅ Schicht-Panel wurde erstellt.");
            }

            if (name === "schichtliste") {
                await interaction.deferReply(EPHEMERAL);
                if (!cfg.listChannelId) {
                    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                        return interaction.editReply("❌ Die Schichtliste ist nicht konfiguriert. Ein Admin muss `/schichtliste` einmal in den gewünschten Kanal ausführen.");
                    }
                    cfg.listChannelId = interaction.channelId;
                    saveGuildConfig(guild.id, cfg);
                }
                const ok = await refreshGuildList(guild);
                return interaction.editReply(ok
                    ? `✅ Schichtliste in <#${cfg.listChannelId}> aktualisiert (${getGuildEntries(guild.id).length} Einträge).`
                    : "❌ Listenkanal ist nicht erreichbar.");
            }

            if (name === "schichtsetup") {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: "🔒 Du benötigst die Berechtigung „Server verwalten“.", ...EPHEMERAL });
                }
                const aktion = interaction.options.getString("aktion", true);
                if (aktion === "code") {
                    const code = interaction.options.getString("code");
                    if (!code) return interaction.reply({ content: "❌ Bitte einen Code angeben.", ...EPHEMERAL });
                    cfg.code = code;
                    saveGuildConfig(guild.id, cfg);
                    return interaction.reply({ content: `✅ Schicht-Code auf \`${code}\` gesetzt.`, ...EPHEMERAL });
                }
                if (aktion === "rolle") {
                    const role = interaction.options.getRole("rolle");
                    if (!role) return interaction.reply({ content: "❌ Bitte eine Rolle angeben.", ...EPHEMERAL });
                    cfg.roleId = role.id;
                    saveGuildConfig(guild.id, cfg);
                    return interaction.reply({ content: `✅ Schicht-Rolle auf ${role} gesetzt.`, ...EPHEMERAL });
                }
                if (aktion === "status") {
                    return interaction.reply({
                        content: `**Schicht-Setup**\n• Code: ${cfg.code ? `\`${cfg.code}\`` : "❌ nicht gesetzt"}\n• Rolle: ${cfg.roleId ? `<@&${cfg.roleId}>` : "❌ nicht gesetzt"}\n• Liste: ${cfg.listChannelId ? `<#${cfg.listChannelId}>` : "❌ nicht gesetzt"}`,
                        ...EPHEMERAL
                    });
                }
                return interaction.reply({ content: "❌ Unbekannte Aktion.", ...EPHEMERAL });
            }
            return;
        }

        // ---------- BUTTONS ----------
        if (interaction.isButton()) {
            if (cid === "schicht_join") {
                if (!cfg.code || !cfg.roleId) {
                    return interaction.reply({ content: "❌ Schicht-System ist nicht eingerichtet (Code/Rolle fehlen — `/schichtsetup`).", ...EPHEMERAL });
                }
                const existing = getEntry(guild.id, interaction.user.id);
                if (existing?.active) {
                    // Schicht beenden
                    existing.active = false;
                    existing.offDutyAt = Date.now();
                    saveEntry(existing);
                    await interaction.member.roles.remove(cfg.roleId).catch(() => {});
                    await refreshGuildList(guild);
                    return interaction.reply({ content: "⚪ Du hast die Schicht beendet.", ...EPHEMERAL });
                }
                return interaction.showModal(codeModal());
            }

            if (cid === "schicht_zeit_add" || cid === "schicht_zeit_del") {
                if (!canManageTime(interaction)) {
                    return interaction.reply({ content: "🔒 Nur Founder, Serverbesitzer, Developer, Owner oder Administratoren dürfen die Schichtzeit bearbeiten.", ...EPHEMERAL });
                }
                return interaction.showModal(zeitModal(cid === "schicht_zeit_add" ? "add" : "del"));
            }
            return;
        }

        // ---------- MODALS ----------
        if (interaction.isModalSubmit()) {
            if (cid === "schicht_code_modal") {
                const code = (interaction.fields.getTextInputValue("code", false) || "").trim();
                if (code !== cfg.code) {
                    return interaction.reply({ content: "❌ Falscher Schicht-Code.", ...EPHEMERAL });
                }
                await interaction.deferReply(EPHEMERAL);
                const member = interaction.member;
                const existing = getEntry(guild.id, interaction.user.id);
                if (existing) {
                    existing.active = true;
                    existing.joinedAt = Date.now();
                    existing.offDutyAt = null;
                    saveEntry(existing);
                } else {
                    saveEntry({
                        guildId: guild.id,
                        userId: interaction.user.id,
                        joinedAt: Date.now(),
                        totalMinutes: 0,
                        active: true,
                        history: []
                    });
                }
                await member.roles.add(cfg.roleId, "Schicht angetreten").catch(e => {
                    console.error("[SCHICHT] Rolle konnte nicht vergeben werden:", e.message);
                });
                await refreshGuildList(guild);
                return interaction.editReply("🟢 Du bist jetzt **auf Schicht**. Du kannst jetzt Support-Pings annehmen.");
            }

            if (cid === "schicht_zeit_add_modal" || cid === "schicht_zeit_del_modal") {
                if (!canManageTime(interaction)) {
                    return interaction.reply({ content: "🔒 Keine Berechtigung.", ...EPHEMERAL });
                }
                const userId = parseUserId(interaction.fields.getTextInputValue("user", false));
                const minutes = Number((interaction.fields.getTextInputValue("minutes", false) || "").trim());
                if (!userId || !Number.isFinite(minutes) || minutes <= 0) {
                    return interaction.reply({ content: "❌ Ungültige Eingabe (User + positive Minutenzahl nötig).", ...EPHEMERAL });
                }
                const member = await guild.members.fetch(userId).catch(() => null);
                if (!member) return interaction.reply({ content: "❌ User nicht auf dem Server.", ...EPHEMERAL });

                let entry = getEntry(guild.id, userId);
                if (!entry) {
                    entry = { guildId: guild.id, userId, joinedAt: Date.now(), totalMinutes: 0, active: false, history: [] };
                }
                const isAdd = cid === "schicht_zeit_add_modal";
                const delta = isAdd ? minutes : -minutes;
                entry.totalMinutes = Math.max(0, (entry.totalMinutes || 0) + delta);
                entry.history.push({ by: interaction.user.id, at: Date.now(), minutes: delta });
                saveEntry(entry);
                await refreshGuildList(guild);
                return interaction.reply({
                    content: `${isAdd ? "✅" : "🗑️"} ${isAdd ? "" : ""}${isAdd ? "Hinzugefügt" : "Entfernt"}: **${minutes} Min.** für <@${userId}> • Neu: **${fmtDuration(entry.totalMinutes)}**`,
                    ...EPHEMERAL
                });
            }
            return;
        }
    } catch (e) {
        console.error("[SCHICHT] Interaktion-Fehler:", e);
        const payload = { content: "❌ Ein Fehler ist im Schicht-System aufgetreten.", ...EPHEMERAL };
        try {
            if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
            else await interaction.reply(payload);
        } catch (_) {}
    }
}

// Export für Support-System: Schicht-Pflicht prüfen
function isOnShiftActive(guildId) {
    return Object.values(loadData().entries).some(e => e.guildId === guildId);
}
function isOnShift(guildId, userId) {
    const e = getEntry(guildId, userId);
    return !!(e && e.active);
}
global.isOnShiftActive = isOnShiftActive;
global.isOnShift = isOnShift;

// -----------------------------------------------------
// SLASH COMMANDS
// -----------------------------------------------------

const commands = [
    new SlashCommandBuilder().setName("schichtpanel").setDescription("Erstellt das Schicht-Panel")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder().setName("schichtliste").setDescription("Aktualisiert die Schichtliste"),
    new SlashCommandBuilder().setName("schichtsetup").setDescription("Konfiguriert das Schicht-System")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o.setName("aktion").setDescription("Aktion").setRequired(true)
            .addChoices(
                { name: "Code setzen", value: "code" },
                { name: "Schicht-Rolle setzen", value: "rolle" },
                { name: "Status anzeigen", value: "status" }
            ))
        .addStringOption(o => o.setName("code").setDescription("Neuer Schicht-Code"))
        .addRoleOption(o => o.setName("rolle").setDescription("Schicht-Rolle"))
];

let initialized = false;

function initializeSchichtSystem(client) {
    if (initialized) return;
    if (!client) throw new Error("Discord-Client fehlt.");
    initialized = true;

    client.on("interactionCreate", handleSchichtInteraction);

    async function register() {
        for (const guild of client.guilds.cache.values()) {
            for (const cmd of commands) {
                try {
                    await guild.commands.create(cmd.toJSON());
                } catch (e) {
                    console.error("[SCHICHT] Slash-Registrierung:", e.message);
                }
            }
        }
    }

    if (client.isReady()) {
        void register();
        setTimeout(() => refreshAllLists(client).catch(() => {}), 20000);
    } else {
        client.once("clientReady", () => {
            void register();
            setTimeout(() => refreshAllLists(client).catch(() => {}), 20000);
        });
    }

    client.on("guildCreate", async g => {
        for (const cmd of commands) {
            try {
                await g.commands.create(cmd.toJSON());
            } catch (e) {
                console.error("[SCHICHT] guildCreate-Registrierung:", e.message);
            }
        }
    });

    console.log("🟢 Schicht-System initialisiert (/schichtpanel, /schichtliste, /schichtsetup).");
}

module.exports = {
    initializeSchichtSystem,
    commands,
    refreshGuildList
};
