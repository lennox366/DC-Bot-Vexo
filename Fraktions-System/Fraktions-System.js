"use strict";

const fs = require("fs");
const path = require("path");
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType
} = require("discord.js");

// =====================================================
// 🏛️ FRAKTIONS-SYSTEM
// Eigenes Design im Stil des Bots (Ticket-System-Style)
// =====================================================

const SERVER_NAME = "💫 NOVEX RP";
const COLOR = 0x8052ff;
const DATA_FILE = path.join(__dirname, "fraktionen.json");
const EPHEMERAL = { flags: MessageFlags.Ephemeral };
const DEFAULT_WARN_LIMIT = 3;
const DEFAULT_CATEGORIES = ["Staatliche Fraktion", "Illegale Fraktion", "Unternehmen", "Sonstige"];
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
            d.factions ||= {};
            return d;
        }
    } catch (e) {
        console.error("[FRAKTION] Daten konnten nicht gelesen werden:", e);
    }
    return { guilds: {}, factions: {} };
}

function saveData(d) {
    try {
        const tmp = DATA_FILE + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
        fs.renameSync(tmp, DATA_FILE);
        return true;
    } catch (e) {
        console.error("[FRAKTION] Daten konnten nicht gespeichert werden:", e);
        return false;
    }
}

function getGuildConfig(guildId) {
    const d = loadData();
    if (!d.guilds[guildId]) {
        d.guilds[guildId] = {
            announceChannelId: null,
            listChannelId: null,
            listMessageIds: [],
            warnLimit: DEFAULT_WARN_LIMIT,
            categories: [...DEFAULT_CATEGORIES]
        };
    }
    return d.guilds[guildId];
}

function saveGuildConfig(guildId, cfg) {
    const d = loadData();
    d.guilds[guildId] = cfg;
    return saveData(d);
}

function getFactions(guildId, includeDissolved = false) {
    const d = loadData();
    return Object.values(d.factions)
        .filter(f => f.guildId === guildId && (includeDissolved || f.status === "aktiv"))
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

function getFaction(id) {
    return loadData().factions[id] || null;
}

function saveFaction(f) {
    const d = loadData();
    d.factions[f.id] = f;
    return saveData(d);
}

function deleteFaction(id) {
    const d = loadData();
    delete d.factions[id];
    return saveData(d);
}

// -----------------------------------------------------
// HELPFER
// -----------------------------------------------------

function footer(text) {
    return { text: `${SERVER_NAME} • Fraktionen • ${text}` };
}

function baseEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(title)
        .setDescription(description || null)
        .setFooter(footer("Fraktionsverwaltung"))
        .setTimestamp();
}

function parseUser(input, guild) {
    const m = /<@!?(\d+)>/.exec(String(input || "")) || /^(\d{17,20})$/.exec(String(input || "").trim());
    return m ? m[1] : null;
}

async function resolveMember(guild, input) {
    const id = parseUser(input, guild);
    if (!id) return null;
    return guild.members.fetch(id).catch(() => null);
}

function fmtDate(ts) {
    return ts ? `<t:${Math.floor(ts / 1000)}:d>` : "—";
}

function fmtDateTime(ts) {
    return ts ? `<t:${Math.floor(ts / 1000)}:f>` : "—";
}

function protectionInfo(f) {
    if (!f.protectionUntil) return f.protectionExpired ? "🛡️ Spawn-Schutz: Abgelaufen" : "—";
    const now = Date.now();
    if (f.protectionUntil <= now) return "🛡️ Spawn-Schutz: Abgelaufen";
    const days = Math.ceil((f.protectionUntil - now) / 86400000);
    return `🛡️ Spawn-Schutz: Noch ${days} Tag${days === 1 ? "" : "e"} (<t:${Math.floor(f.protectionUntil / 1000)}:d>)`;
}

function factionSummaryLines(f) {
    const lines = [`👑 Leitung: ${f.leaderId ? `<@${f.leaderId}>` : "—"}`];
    if (f.leader2Id) lines.push(`👑 2. Leitung: <@${f.leader2Id}>`);
    lines.push(
        `💬 Discord: ${f.invite ? `[Server-Link](${f.invite})` : "—"}`,
        `📍 Standort: ${f.location || "—"}`,
        `🗂️ Kategorie: ${f.category || "—"}`
    );
    if (f.members != null) lines.push(`👥 Mitglieder: ${f.members}`);
    lines.push(protectionInfo(f), `⚠️ Verwarnungen: ${f.warns.length}`);
    return lines;
}

// -----------------------------------------------------
// LOG + BEKANNTMACHUNG
// -----------------------------------------------------

async function logAction(guild, embed) {
    const channelId = process.env.BOT_LOG_CHANNEL_ID;
    if (!channelId) return;
    const ch = await guild.channels.fetch(channelId).catch(() => guild.client.channels.fetch(channelId).catch(() => null));
    if (ch && ch.isTextBased()) await ch.send({ embeds: [embed] }).catch(() => {});
}

async function sendAnnouncement(guild, faction, kind) {
    const cfg = getGuildConfig(guild.id);
    if (!cfg.announceChannelId) return false;
    const ch = await guild.channels.fetch(cfg.announceChannelId).catch(() => null);
    if (!ch || !ch.isTextBased()) return false;

    let title, color, extra = [];
    if (kind === "create") {
        title = "🟩 FRAKTION OFFIZIELL";
        color = 0x3ba55d;
        extra = [
            `**Fraktionsinformationen**`,
            `💼 Fraktion: **${faction.name}**`,
            `👑 Leitung: ${faction.leaderId ? `<@${faction.leaderId}>` : "—"}`,
            `👑 2. Leitung: ${faction.leader2Id ? `<@${faction.leader2Id}>` : "—"}`,
            `🛡️ Spawn-Schutz bis: ${faction.protectionUntil ? fmtDateTime(faction.protectionUntil) : "Keiner"}`,
            `📍 Standort: ${faction.location || "—"}`,
            `💬 Discord-Server: ${faction.invite || "—"}`,
            ``,
            `Mit freundlichen Grüßen`,
            SERVER_NAME
        ];
    } else if (kind === "dissolve") {
        title = "🟥 FRAKTION AUFGELÖST";
        color = 0xed4245;
        extra = [
            `Die Fraktion **${faction.name}** wurde offiziell aufgelöst.`,
            `📋 Grund: ${faction.dissolveReason || "—"}`,
            ``,
            `Mit freundlichen Grüßen`,
            SERVER_NAME
        ];
    } else if (kind === "warn") {
        title = "⚠️ FRAKTIONS-WARNUNG";
        color = 0xfaa61a;
        extra = [
            `Die Fraktion **${faction.name}** hat eine Verwarnung erhalten.`,
            `📋 Grund: ${faction._warnReason || "—"}`,
            `👮 Vergeben von: <@${faction._warnBy || "—"}>`,
            `📊 Warns: ${faction.warns.length}/${getGuildConfig(guild.id).warnLimit || DEFAULT_WARN_LIMIT}`,
            ``,
            SERVER_NAME
        ];
    } else if (kind === "warnLimit") {
        title = "⚠️ WARNLIMIT ERREICHT";
        color = 0xfaa61a;
        extra = [
            `Die Fraktion **${faction.name}** hat das Warnlimit erreicht (${faction.warns.length}/${getGuildConfig(guild.id).warnLimit}).`,
            `Bitte prüfe die Fraktion administrativ.`,
            ``,
            SERVER_NAME
        ];
    } else if (kind === "delete") {
        title = "🗑️ FRAKTION GELÖSCHT";
        color = 0xed4245;
        extra = [
            `Die Fraktion **${faction.name}** wurde endgültig aus dem System entfernt.`,
            `👮 Durchgeführt von: <@${faction._deletedBy || "—"}>`,
            ``,
            SERVER_NAME
        ];
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(extra.join("\n"))
        .setFooter(footer("Fraktionen"))
        .setTimestamp();
    if (faction.logo) embed.setThumbnail(faction.logo);
    await ch.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
    return true;
}

// -----------------------------------------------------
// FRARLISTE (auto-aktualisiert, paginiert)
// -----------------------------------------------------

function buildListPages(guild, factions) {
    const pages = [];
    let fields = [];
    let chars = 0;

    const flush = () => {
        if (!fields.length) return;
        pages.push(fields);
        fields = [];
        chars = 0;
    };

    for (const f of factions) {
        const statusEmoji = f.status === "aufgeloest" ? "🟥" : "🟩";
        const value = [
            ...factionSummaryLines(f)
        ].join("\n");
        const field = {
            name: `${statusEmoji} ${f.name} (${f.category || "Ohne Kategorie"})`,
            value: value.slice(0, 1024),
            inline: false
        };
        const fieldLen = field.name.length + field.value.length + 10;
        if (fields.length >= LIST_PAGE_FIELDS || chars + fieldLen > LIST_PAGE_CHARS) flush();
        fields.push(field);
        chars += fieldLen;
    }
    flush();

    if (!pages.length) {
        pages.push([{ name: "Fraktionen", value: "Derzeit sind keine aktiven Fraktionen registriert.", inline: false }]);
    }
    return pages;
}

async function refreshGuildList(guild) {
    const cfg = getGuildConfig(guild.id);
    if (!cfg.listChannelId) return false;
    const ch = await guild.channels.fetch(cfg.listChannelId).catch(() => null);
    if (!ch || !ch.isTextBased()) return false;

    const factions = getFactions(guild.id);
    const pages = buildListPages(guild, factions);

    // Bestehende Listennachrichten aktualisieren
    for (let i = 0; i < pages.length; i++) {
        const embed = new EmbedBuilder()
            .setColor(COLOR)
            .setTitle(`🏛️ ${SERVER_NAME.replace("💫 ", "")} • FRAKTIONSLISTE`)
            .setDescription(factions.length ? `**${factions.length}** aktive Fraktion${factions.length === 1 ? "" : "en"} • Seite ${i + 1}/${pages.length}` : "Derzeit sind keine aktiven Fraktionen registriert.")
            .addFields(pages[i])
            .setFooter(footer("Fraktionsliste • automatisch"))
            .setTimestamp();
        const msgId = cfg.listMessageIds[i];
        if (msgId) {
            const msg = await ch.messages.fetch(msgId).catch(() => null);
            if (msg) {
                await msg.edit({ embeds: [embed] }).catch(() => {});
                continue;
            }
        }
        const sent = await ch.send({ embeds: [embed] }).catch(() => null);
        if (sent) {
            cfg.listMessageIds[i] = sent.id;
        }
    }

    // Überschüssige Seiten löschen
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
            console.error(`[FRAKTION] Listen-Refresh ${guild.id}:`, e.message);
        }
    }
}

// -----------------------------------------------------
// PANEL
// -----------------------------------------------------

function buildPanel() {
    const embed = baseEmbed(
        "🏛️ FRAKTIONSVERWALTUNG",
        "Zentrale Verwaltung der Fraktionen.\n\nWähle eine Aktion aus:"
    );
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("frak_add").setLabel("Fraktion hinzufügen").setEmoji("➕").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("frak_edit").setLabel("Fraktion bearbeiten").setEmoji("✏️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("frak_dissolve").setLabel("Fraktion auflösen").setEmoji("❌").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("frak_delete").setLabel("Fraktion löschen").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("frak_warn").setLabel("Fraktion verwarnen").setEmoji("⚠️").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("frak_overview").setLabel("Fraktionsübersicht").setEmoji("📋").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("frak_search").setLabel("Fraktion suchen").setEmoji("🔎").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("frak_history").setLabel("Fraktionshistorie").setEmoji("📜").setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row1, row2] };
}

function factionPickRow(factions, customId, placeholder) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder || "Fraktion auswählen...")
        .setMinValues(1)
        .setMaxValues(1);
    for (const f of factions.slice(0, 25)) {
        select.addOptions({
            label: f.name.slice(0, 100),
            value: f.id,
            description: `${f.category || "Ohne Kategorie"} • ${f.status === "aufgeloest" ? "Aufgelöst" : "Aktiv"}`.slice(0, 100)
        });
    }
    return new ActionRowBuilder().addComponents(select);
}

function factionDetailEmbed(f) {
    const statusEmoji = f.status === "aufgeloest" ? "🟥" : "🟩";
    const embed = baseEmbed(
        `${statusEmoji} ${f.name}`,
        f.description || null
    );
    embed.addFields({ name: "Fraktionsinformationen", value: factionSummaryLines(f).join("\n") });
    if (f.foundedAt) embed.addFields({ name: "📅 Gründung", value: fmtDate(f.foundedAt), inline: true });
    if (f.status === "aufgeloest") {
        embed.addFields({ name: "📜 Auflösung", value: `**Grund:** ${f.dissolveReason || "—"}\n**Datum:** ${fmtDateTime(f.dissolvedAt)}`, inline: false });
    }
    if (f.warns.length) {
        const warnText = f.warns.slice(-10).map((w, i) =>
            `**${i + 1}.** ${w.reason}\n└ ${fmtDateTime(w.at)} • von <@${w.by}>`
        ).join("\n");
        embed.addFields({ name: `⚠️ Verwarnungen (${f.warns.length}/${getGuildConfig(f.guildId).warnLimit || DEFAULT_WARN_LIMIT})`, value: warnText.slice(0, 1024), inline: false });
    }
    if (f.logo) embed.setThumbnail(f.logo);
    return embed;
}

// -----------------------------------------------------
// MODALS
// -----------------------------------------------------

function textInput(id, label, style, required, placeholder) {
    const input = new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label.slice(0, 45))
        .setStyle(style)
        .setRequired(required);
    if (placeholder) input.setPlaceholder(placeholder.slice(0, 100));
    return input;
}

function row(input) {
    return new ActionRowBuilder().addComponents(input);
}

function addModal1() {
    return new ModalBuilder()
        .setCustomId("frak_add_modal1")
        .setTitle("➕ Fraktion hinzufügen")
        .addComponents(
            row(textInput("name", "Fraktionsname *", TextInputStyle.Short, true, "z.B. Black The Santos")),
            row(textInput("leader", "Fraktionsleiter (User-ID oder @Mention) *", TextInputStyle.Short, true)),
            row(textInput("location", "Standort *", TextInputStyle.Short, true)),
            row(textInput("category", "Kategorie *", TextInputStyle.Short, true)),
            row(textInput("invite", "Discord-Server-Link *", TextInputStyle.Short, true, "https://discord.gg/..."))
        );
}

function addModal2() {
    return new ModalBuilder()
        .setCustomId("frak_add_modal2")
        .setTitle("➕ Fraktion: optionale Details")
        .addComponents(
            row(textInput("leader2", "2. Leitung (optional)", TextInputStyle.Short, false)),
            row(textInput("description", "Beschreibung", TextInputStyle.Paragraph, false)),
            row(textInput("logo", "Logo-URL (Bild)", TextInputStyle.Short, false)),
            row(textInput("protectionDays", "Spawn-Schutz (Tage, z.B. 7)", TextInputStyle.Short, false))
        );
}

function editFieldModal(fid, field, label, current) {
    return new ModalBuilder()
        .setCustomId(`frak_edit_modal_${fid}_${field}`)
        .setTitle(`✏️ ${label}`.slice(0, 45))
        .addComponents(row(textInput("value", `${label} (aktuell: ${String(current ?? "—").slice(0, 60)})`, field === "description" ? TextInputStyle.Paragraph : TextInputStyle.Short, field !== "leader2" && field !== "invite" && field !== "description" && field !== "logo" && field !== "founded" && field !== "protectionDays")));
}

function warnModal(fid, factionName) {
    return new ModalBuilder()
        .setCustomId(`frak_warn_reason_${fid}`)
        .setTitle(`⚠️ Verwarnung: ${factionName}`.slice(0, 45))
        .addComponents(row(textInput("reason", "Grund der Verwarnung *", TextInputStyle.Paragraph, true)));
}

function dissolveModal(fid, factionName) {
    return new ModalBuilder()
        .setCustomId(`frak_dissolve_reason_${fid}`)
        .setTitle(`❌ Auflösen: ${factionName}`.slice(0, 45))
        .addComponents(row(textInput("reason", "Auflösungsgrund *", TextInputStyle.Paragraph, true)));
}

function searchModal() {
    return new ModalBuilder()
        .setCustomId("frak_search_modal")
        .setTitle("🔎 Fraktion suchen")
        .addComponents(row(textInput("query", "Name, Standort oder Kategorie", TextInputStyle.Short, true)));
}

const EDIT_FIELDS = [
    ["name", "Name"], ["leader", "Leitung"], ["leader2", "2. Leitung"],
    ["invite", "Discord-Link"], ["location", "Standort"], ["category", "Kategorie"],
    ["members", "Mitgliederzahl"], ["description", "Beschreibung"], ["logo", "Logo-URL"],
    ["founded", "Gründungsdatum (TT.MM.JJJJ)"], ["protectionDays", "Spawn-Schutz (Tage)"]
];

const pendingAdds = new Map(); // userId -> draft faction
const pendingDissolveReasons = new Map(); // factionId -> reason

async function finalizeFaction(guild, interaction, draft) {
    const cfg = getGuildConfig(guild.id);
    const name = draft.name.trim();
    if (!name) return interaction.editReply({ content: "❌ Fraktionsname fehlt.", ...EPHEMERAL });
    if (getFactions(guild.id).some(f => f.name.toLowerCase() === name.toLowerCase())) {
        return interaction.editReply({ content: "❌ Eine Fraktion mit diesem Namen existiert bereits.", ...EPHEMERAL });
    }

    const leader = await resolveMember(guild, draft.leader);
    if (!leader) return interaction.editReply({ content: "❌ Fraktionsleitung nicht gefunden (gültige User-ID oder @Mention nötig).", ...EPHEMERAL });

    if (!draft.invite || !draft.invite.trim().startsWith("http")) {
        return interaction.editReply({ content: "❌ Discord-Server-Link fehlt oder ist ungültig (https://discord.gg/...).", ...EPHEMERAL });
    }

    let leader2Id = null;
    if (draft.leader2 && String(draft.leader2).trim()) {
        const m2 = await resolveMember(guild, draft.leader2);
        if (m2) leader2Id = m2.id;
    }

    const protectionDays = draft.protectionDays && /^\d+$/.test(draft.protectionDays.trim()) ? Number(draft.protectionDays.trim()) : 0;
    let foundedAt = null;
    if (draft.founded) {
        const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(draft.founded.trim());
        if (dm) foundedAt = new Date(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1])).getTime();
    }

    const faction = {
        id: `${guild.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        guildId: guild.id,
        name,
        leaderId: leader.id,
        leader2Id,
        invite: draft.invite.trim(),
        location: draft.location || null,
        category: draft.category || null,
        members: null,
        description: draft.description || null,
        logo: draft.logo && draft.logo.startsWith("http") ? draft.logo.trim() : null,
        foundedAt: foundedAt || Date.now(),
        protectionUntil: protectionDays > 0 ? Date.now() + protectionDays * 86400000 : null,
        protectionExpired: false,
        status: "aktiv",
        warns: [],
        createdAt: Date.now(),
        createdBy: interaction.user.id,
        updatedAt: Date.now(),
        dissolvedAt: null,
        dissolvedBy: null,
        dissolveReason: null
    };

    pendingAdds.delete(interaction.user.id);
    if (!saveFaction(faction)) {
        return interaction.editReply({ content: "❌ Fraktion konnte nicht gespeichert werden.", ...EPHEMERAL });
    }

    const ok = await refreshGuildList(guild);
    await sendAnnouncement(guild, faction, "create");
    await logAction(guild, baseEmbed("🏛️ Fraktion erstellt", `**${name}** wurde von <@${interaction.user.id}> registriert.`));

    return interaction.editReply({
        content: `✅ Fraktion **${name}** wurde erstellt.${ok ? "" : "\n⚠️ Fraktionsliste ist nicht konfiguriert (/fraktion setup)."}`,
        embeds: [factionDetailEmbed(faction)],
        ...EPHEMERAL
    });
}

// -----------------------------------------------------
// INTERACTION-HANDLER
// -----------------------------------------------------

async function handleFraktionInteraction(interaction) {
    if (!interaction.guild) return;
    const cid = interaction.customId || "";
    if (!cid.startsWith("frak_") && interaction.commandName !== "fraktion") return;

    const guild = interaction.guild;
    const cfg = getGuildConfig(guild.id);

    try {
        // ---------- SLASH COMMANDS ----------
        if (interaction.isChatInputCommand() && interaction.commandName === "fraktion") {
            const sub = interaction.options.getSubcommand();

            if (sub === "liste") {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: "🔒 Du benötigst die Berechtigung „Server verwalten“.", ...EPHEMERAL });
                }
                await interaction.deferReply(EPHEMERAL);
                if (!cfg.listChannelId) {
                    cfg.listChannelId = interaction.channelId;
                    saveGuildConfig(guild.id, cfg);
                }
                const ok = await refreshGuildList(guild);
                return interaction.editReply({
                    content: ok
                        ? `✅ Fraktionsliste in <#${cfg.listChannelId}> aktualisiert (${getFactions(guild.id).length} aktive Fraktionen).`
                        : "❌ Listenkanal ist nicht erreichbar. Prüfe /fraktion setup."
                });
            }

            if (sub === "panel") {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: "🔒 Du benötigst die Berechtigung „Server verwalten“.", ...EPHEMERAL });
                }
                await interaction.deferReply(EPHEMERAL);
                await interaction.channel.send(buildPanel());
                return interaction.editReply("✅ Fraktions-Panel wurde erstellt.");
            }

            if (sub === "info") {
                await interaction.deferReply(EPHEMERAL);
                const factions = getFactions(guild.id);
                if (!factions.length) return interaction.editReply("ℹ️ Derzeit sind keine aktiven Fraktionen registriert.");
                return interaction.editReply({
                    content: "Wähle eine Fraktion für Details:",
                    ...EPHEMERAL,
                    components: [factionPickRow(factions, "frak_info_pick")]
                });
            }

            if (sub === "suche") {
                return interaction.showModal(searchModal());
            }

            if (sub === "statistik") {
                const active = getFactions(guild.id);
                const all = getFactions(guild.id, true);
                const dissolved = all.filter(f => f.status === "aufgeloest");
                const byCat = {};
                for (const f of active) byCat[f.category || "Ohne Kategorie"] = (byCat[f.category || "Ohne Kategorie"] || 0) + 1;
                const totalWarns = all.reduce((s, f) => s + f.warns.length, 0);
                const protectedCount = active.filter(f => f.protectionUntil && f.protectionUntil > Date.now()).length;
                const embed = baseEmbed("📊 Fraktionsstatistik", null)
                    .addFields(
                        { name: "Aktive Fraktionen", value: String(active.length), inline: true },
                        { name: "Aufgelöste Fraktionen", value: String(dissolved.length), inline: true },
                        { name: "Verwarnungen gesamt", value: String(totalWarns), inline: true },
                        { name: "Aktiver Spawn-Schutz", value: String(protectedCount), inline: true },
                        { name: "Nach Kategorie", value: Object.entries(byCat).map(([k, v]) => `• ${k}: ${v}`).join("\n") || "—", inline: false }
                    );
                return interaction.reply({ embeds: [embed], ...EPHEMERAL });
            }

            if (sub === "setup") {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: "🔒 Du benötigst die Berechtigung „Server verwalten“.", ...EPHEMERAL });
                }
                const aktion = interaction.options.getString("aktion", true);
                if (aktion === "announce") {
                    const ch = interaction.options.getChannel("kanal");
                    if (!ch || !ch.isTextBased()) return interaction.reply({ content: "❌ Bitte einen Textkanal angeben.", ...EPHEMERAL });
                    cfg.announceChannelId = ch.id;
                    saveGuildConfig(guild.id, cfg);
                    return interaction.reply({ content: `✅ Bekanntmachungskanal auf <#${ch.id}> gesetzt.`, ...EPHEMERAL });
                }
                if (aktion === "liste") {
                    const ch = interaction.options.getChannel("kanal");
                    if (!ch || !ch.isTextBased()) return interaction.reply({ content: "❌ Bitte einen Textkanal angeben.", ...EPHEMERAL });
                    cfg.listChannelId = ch.id;
                    cfg.listMessageIds = [];
                    saveGuildConfig(guild.id, cfg);
                    await refreshGuildList(guild);
                    return interaction.reply({ content: `✅ Fraktionsliste wird jetzt in <#${ch.id}> gepflegt.`, ...EPHEMERAL });
                }
                if (aktion === "warnlimit") {
                    const zahl = interaction.options.getInteger("zahl");
                    if (!zahl || zahl < 1) return interaction.reply({ content: "❌ Bitte eine gültige Zahl angeben.", ...EPHEMERAL });
                    cfg.warnLimit = zahl;
                    saveGuildConfig(guild.id, cfg);
                    return interaction.reply({ content: `✅ Warnlimit auf **${zahl}** gesetzt.`, ...EPHEMERAL });
                }
                if (aktion === "kategorien") {
                    const text = interaction.options.getString("text");
                    if (!text) return interaction.reply({ content: "❌ Bitte Kategorien angeben (Komma-getrennt).", ...EPHEMERAL });
                    cfg.categories = text.split(",").map(s => s.trim()).filter(Boolean);
                    saveGuildConfig(guild.id, cfg);
                    return interaction.reply({ content: `✅ Kategorien gespeichert: ${cfg.categories.join(", ")}`, ...EPHEMERAL });
                }
                return interaction.reply({ content: "❌ Unbekannte Aktion.", ...EPHEMERAL });
            }

            return;
        }

        // ---------- BUTTONS ----------
        if (interaction.isButton()) {
            if (cid === "frak_add") {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: "🔒 Du benötigst die Berechtigung „Server verwalten“.", ...EPHEMERAL });
                }
                pendingAdds.set(interaction.user.id, { guildId: guild.id });
                return interaction.showModal(addModal1());
            }

            if (cid === "frak_edit") {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: "🔒 Du benötigst die Berechtigung „Server verwalten“.", ...EPHEMERAL });
                }
                const factions = getFactions(guild.id);
                if (!factions.length) return interaction.reply({ content: "ℹ️ Keine aktiven Fraktionen vorhanden.", ...EPHEMERAL });
                return interaction.reply({
                    content: "Welche Fraktion bearbeiten?",
                    ...EPHEMERAL,
                    components: [factionPickRow(factions, "frak_edit_pick")]
                });
            }

            if (cid === "frak_dissolve") {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: "🔒 Du benötigst die Berechtigung „Server verwalten“.", ...EPHEMERAL });
                }
                const factions = getFactions(guild.id);
                if (!factions.length) return interaction.reply({ content: "ℹ️ Keine aktiven Fraktionen vorhanden.", ...EPHEMERAL });
                return interaction.reply({
                    content: "Welche Fraktion auflösen?",
                    ...EPHEMERAL,
                    components: [factionPickRow(factions, "frak_dissolve_pick")]
                });
            }

            if (cid === "frak_delete") {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: "🔒 Nur Administratoren dürfen Fraktionen löschen.", ...EPHEMERAL });
                }
                const factions = getFactions(guild.id, true);
                if (!factions.length) return interaction.reply({ content: "ℹ️ Keine Fraktionen vorhanden.", ...EPHEMERAL });
                return interaction.reply({
                    content: "Welche Fraktion endgültig löschen?",
                    ...EPHEMERAL,
                    components: [factionPickRow(factions, "frak_delete_pick")]
                });
            }

            if (cid === "frak_warn") {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: "🔒 Du benötigst die Berechtigung „Server verwalten“.", ...EPHEMERAL });
                }
                const factions = getFactions(guild.id);
                if (!factions.length) return interaction.reply({ content: "ℹ️ Keine aktiven Fraktionen vorhanden.", ...EPHEMERAL });
                return interaction.reply({
                    content: "Welche Fraktion verwarnen?",
                    ...EPHEMERAL,
                    components: [factionPickRow(factions, "frak_warn_pick")]
                });
            }

            if (cid === "frak_overview") {
                await interaction.deferReply(EPHEMERAL);
                const active = getFactions(guild.id);
                const all = getFactions(guild.id, true);
                const byCat = {};
                for (const f of active) byCat[f.category || "Ohne Kategorie"] = (byCat[f.category || "Ohne Kategorie"] || 0) + 1;
                const embed = baseEmbed("📋 Fraktionsübersicht", null)
                    .addFields(
                        { name: "Aktiv", value: String(active.length), inline: true },
                        { name: "Insgesamt (inkl. Archiv)", value: String(all.length), inline: true },
                        { name: "Warnlimit", value: String(cfg.warnLimit || DEFAULT_WARN_LIMIT), inline: true },
                        { name: "Fraktionen", value: active.map(f => `• ${f.name} — ${f.category || "—"}`).join("\n").slice(0, 1024) || "—", inline: false }
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            if (cid === "frak_search") {
                return interaction.showModal(searchModal());
            }

            if (cid === "frak_history") {
                const archived = getFactions(guild.id, true).filter(f => f.status === "aufgeloest");
                const embed = baseEmbed("📜 Fraktionshistorie", null).addFields({
                    name: `Archiv (${archived.length})`,
                    value: archived.slice(0, 20).map(f =>
                        `• **${f.name}** — aufgelöst ${fmtDateTime(f.dissolvedAt)}\n└ ${f.dissolveReason || "Kein Grund"}`
                    ).join("\n").slice(0, 1024) || "Noch keine aufgelösten Fraktionen."
                });
                return interaction.reply({ embeds: [embed], ...EPHEMERAL });
            }

            // Bestätigungen
            if (cid.startsWith("frak_dissolve_confirm_")) {
                const fid = cid.replace("frak_dissolve_confirm_", "");
                const f = getFaction(fid);
                if (!f || f.status !== "aktiv") return interaction.reply({ content: "❌ Fraktion nicht gefunden oder bereits aufgelöst.", ...EPHEMERAL });
                f.status = "aufgeloest";
                f.dissolvedAt = Date.now();
                f.dissolvedBy = interaction.user.id;
                f.dissolveReason = pendingDissolveReasons.get(fid) || null;
                pendingDissolveReasons.delete(fid);
                f.updatedAt = Date.now();
                saveFaction(f);
                await refreshGuildList(guild);
                await sendAnnouncement(guild, f, "dissolve");
                await logAction(guild, baseEmbed("❌ Fraktion aufgelöst", `**${f.name}** wurde von <@${interaction.user.id}> aufgelöst.`));
                return interaction.update({ content: `✅ Fraktion **${f.name}** wurde aufgelöst.`, embeds: [], components: [] });
            }

            if (cid.startsWith("frak_delete_confirm_")) {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: "🔒 Nur Administratoren dürfen Fraktionen löschen.", ...EPHEMERAL });
                }
                const fid = cid.replace("frak_delete_confirm_", "");
                const f = getFaction(fid);
                if (!f) return interaction.reply({ content: "❌ Fraktion nicht gefunden.", ...EPHEMERAL });
                f._deletedBy = interaction.user.id;
                await sendAnnouncement(guild, f, "delete");
                deleteFaction(fid);
                await refreshGuildList(guild);
                await logAction(guild, baseEmbed("🗑️ Fraktion gelöscht", `**${f.name}** wurde von <@${interaction.user.id}> endgültig gelöscht.`));
                return interaction.update({ content: `✅ Fraktion **${f.name}** wurde endgültig gelöscht.`, embeds: [], components: [] });
            }
        }

        // ---------- SELECT MENUS ----------
        if (interaction.isStringSelectMenu()) {
            const values = interaction.values;

            if (cid === "frak_info_pick") {
                const f = getFaction(values[0]);
                if (!f) return interaction.update({ content: "❌ Fraktion nicht gefunden.", embeds: [], components: [] });
                return interaction.update({ content: null, embeds: [factionDetailEmbed(f)], components: [] });
            }

            if (cid === "frak_edit_pick") {
                const f = getFaction(values[0]);
                if (!f) return interaction.update({ content: "❌ Fraktion nicht gefunden.", embeds: [], components: [] });
                const fieldSelect = new StringSelectMenuBuilder()
                    .setCustomId(`frak_edit_field_${f.id}`)
                    .setPlaceholder("Welches Feld ändern?")
                    .addOptions(EDIT_FIELDS.map(([k, l]) => ({ label: l, value: k })));
                return interaction.update({
                    content: `✏️ **${f.name}** — welches Feld ändern?`,
                    embeds: [],
                    components: [new ActionRowBuilder().addComponents(fieldSelect)]
                });
            }

            if (cid.startsWith("frak_edit_field_")) {
                const fid = cid.replace("frak_edit_field_", "");
                const f = getFaction(fid);
                if (!f) return interaction.update({ content: "❌ Fraktion nicht gefunden.", embeds: [], components: [] });
                const field = values[0];
                const fieldDef = EDIT_FIELDS.find(([k]) => k === field);
                if (!fieldDef) return;
                const cur = field === "leader" ? (f.leaderId ? `<@${f.leaderId}>` : "")
                    : field === "leader2" ? (f.leader2Id ? `<@${f.leader2Id}>` : "")
                    : field === "members" ? (f.members ?? "")
                    : field === "protectionDays" ? ""
                    : f[field] ?? "";
                return interaction.showModal(editFieldModal(fid, field, fieldDef[1], cur));
            }

            if (cid === "frak_dissolve_pick") {
                const f = getFaction(values[0]);
                if (!f) return interaction.update({ content: "❌ Fraktion nicht gefunden.", embeds: [], components: [] });
                return interaction.showModal(dissolveModal(f.id, f.name));
            }

            if (cid === "frak_delete_pick") {
                const f = getFaction(values[0]);
                if (!f) return interaction.update({ content: "❌ Fraktion nicht gefunden.", embeds: [], components: [] });
                const confirm = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`frak_delete_confirm_${f.id}`).setLabel("Endgültig löschen").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId("frak_cancel").setLabel("Abbrechen").setStyle(ButtonStyle.Secondary)
                );
                return interaction.update({
                    content: `⚠️ **${f.name}** wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
                    embeds: [],
                    components: [confirm]
                });
            }

            if (cid === "frak_warn_pick") {
                const f = getFaction(values[0]);
                if (!f) return interaction.update({ content: "❌ Fraktion nicht gefunden.", embeds: [], components: [] });
                return interaction.showModal(warnModal(f.id, f.name));
            }
            return;
        }

        // ---------- MODALS ----------
        if (interaction.isModalSubmit()) {
            // Fraktion hinzufügen – Schritt 1
            if (cid === "frak_add_modal1") {
                const draft = {
                    guildId: guild.id,
                    name: interaction.fields.getTextInputValue("name", false) || "",
                    leader: interaction.fields.getTextInputValue("leader", false) || "",
                    location: interaction.fields.getTextInputValue("location", false) || "",
                    category: interaction.fields.getTextInputValue("category", false) || "",
                    invite: interaction.fields.getTextInputValue("invite", false) || ""
                };
                pendingAdds.set(interaction.user.id, draft);
                await interaction.reply({
                    content: "📋 Pflichtangaben gespeichert. Möchtest du optionale Details (2. Leitung, Beschreibung, Logo, Spawn-Schutz) ergänzen oder direkt speichern?",
                    ...EPHEMERAL,
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("frak_add_details").setLabel("Details ergänzen").setEmoji("📝").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("frak_add_save").setLabel("Direkt speichern").setEmoji("💾").setStyle(ButtonStyle.Success)
                    )]
                });
                return;
            }

            // Fraktion hinzufügen – optionale Details
            if (cid === "frak_add_modal2") {
                const draft = pendingAdds.get(interaction.user.id) || { guildId: guild.id };
                Object.assign(draft, {
                    leader2: interaction.fields.getTextInputValue("leader2", false) || "",
                    description: interaction.fields.getTextInputValue("description", false) || "",
                    logo: interaction.fields.getTextInputValue("logo", false) || "",
                    protectionDays: interaction.fields.getTextInputValue("protectionDays", false) || ""
                });
                pendingAdds.set(interaction.user.id, draft);
                await interaction.deferReply(EPHEMERAL);
                return finalizeFaction(guild, interaction, draft);
            }

            // Bearbeiten
            if (cid.startsWith("frak_edit_modal_")) {
                const rest = cid.replace("frak_edit_modal_", "");
                const idx = rest.lastIndexOf("_");
                const fid = rest.slice(0, idx);
                const field = rest.slice(idx + 1);
                const f = getFaction(fid);
                if (!f) return interaction.reply({ content: "❌ Fraktion nicht gefunden.", ...EPHEMERAL });
                const value = (interaction.fields.getTextInputValue("value", false) || "").trim();
                if (value === "") return interaction.reply({ content: "❌ Leeres Feld — nichts geändert.", ...EPHEMERAL });

                if (field === "leader" || field === "leader2") {
                    const m = await resolveMember(guild, value);
                    if (!m) return interaction.reply({ content: "❌ User nicht gefunden (ID oder @Mention nötig).", ...EPHEMERAL });
                    if (field === "leader") f.leaderId = m.id; else f.leader2Id = m.id;
                } else if (field === "members") {
                    if (!/^\d+$/.test(value)) return interaction.reply({ content: "❌ Mitgliederzahl muss eine Zahl sein.", ...EPHEMERAL });
                    f.members = Number(value);
                } else if (field === "protectionDays") {
                    if (!/^\d+$/.test(value)) return interaction.reply({ content: "❌ Bitte eine Zahl angeben.", ...EPHEMERAL });
                    f.protectionUntil = Number(value) > 0 ? Date.now() + Number(value) * 86400000 : null;
                    f.protectionExpired = false;
                } else if (field === "founded") {
                    const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
                    if (!dm) return interaction.reply({ content: "❌ Format: TT.MM.JJJJ", ...EPHEMERAL });
                    f.foundedAt = new Date(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1])).getTime();
                } else if (field === "invite" || field === "logo") {
                    if (value !== "-" && !value.startsWith("http")) return interaction.reply({ content: "❌ Bitte eine gültige URL angeben (oder `-` zum Entfernen).", ...EPHEMERAL });
                    f[field] = value === "-" ? null : value;
                } else if (field === "name") {
                    if (getFactions(guild.id).some(x => x.id !== f.id && x.name.toLowerCase() === value.toLowerCase())) {
                        return interaction.reply({ content: "❌ Name existiert bereits.", ...EPHEMERAL });
                    }
                    f.name = value;
                } else {
                    f[field] = value;
                }
                f.updatedAt = Date.now();
                saveFaction(f);
                await refreshGuildList(guild);
                await logAction(guild, baseEmbed("✏️ Fraktion bearbeitet", `**${f.name}** wurde von <@${interaction.user.id}> bearbeitet.`));
                return interaction.reply({ content: `✅ **${f.name}** aktualisiert.`, embeds: [factionDetailEmbed(f)], ...EPHEMERAL });
            }

            // Auflösung – Grund
            if (cid.startsWith("frak_dissolve_reason_")) {
                const fid = cid.replace("frak_dissolve_reason_", "");
                const f = getFaction(fid);
                if (!f) return interaction.reply({ content: "❌ Fraktion nicht gefunden.", ...EPHEMERAL });
                const reason = (interaction.fields.getTextInputValue("reason", false) || "").trim();
                if (!reason) return interaction.reply({ content: "❌ Bitte einen Grund angeben.", ...EPHEMERAL });
                pendingDissolveReasons.set(fid, reason);
                const confirm = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`frak_dissolve_confirm_${fid}`).setLabel("Auflösung bestätigen").setEmoji("❌").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId("frak_cancel").setLabel("Abbrechen").setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({
                    content: `⚠️ **${f.name}** auflösen?\n**Grund:** ${reason}\nDie Fraktion wird ins Archiv verschoben.`,
                    ...EPHEMERAL,
                    components: [confirm]
                });
            }

            // Verwarnung
            if (cid.startsWith("frak_warn_reason_")) {
                const fid = cid.replace("frak_warn_reason_", "");
                const f = getFaction(fid);
                if (!f) return interaction.reply({ content: "❌ Fraktion nicht gefunden.", ...EPHEMERAL });
                const reason = (interaction.fields.getTextInputValue("reason", false) || "").trim();
                if (!reason) return interaction.reply({ content: "❌ Bitte einen Grund angeben.", ...EPHEMERAL });
                f.warns.push({ reason, by: interaction.user.id, at: Date.now() });
                f.updatedAt = Date.now();
                f._warnReason = reason;
                f._warnBy = interaction.user.id;
                saveFaction(f);
                await refreshGuildList(guild);
                await sendAnnouncement(guild, f, "warn");
                delete f._warnReason;
                delete f._warnBy;
                saveFaction(f);
                await logAction(guild, baseEmbed("⚠️ Fraktion verwarnnt", `**${f.name}**: ${reason} (von <@${interaction.user.id}>)`));
                const limit = cfg.warnLimit || DEFAULT_WARN_LIMIT;
                if (f.warns.length >= limit) await sendAnnouncement(guild, f, "warnLimit");
                return interaction.reply({
                    content: `✅ Verwarnung für **${f.name}** hinzugefügt (${f.warns.length}/${limit}).`,
                    embeds: [factionDetailEmbed(f)],
                    ...EPHEMERAL
                });
            }

            // Suche
            if (cid === "frak_search_modal") {
                const q = (interaction.fields.getTextInputValue("query", false) || "").trim().toLowerCase();
                const results = getFactions(guild.id, true).filter(f =>
                    f.name.toLowerCase().includes(q) ||
                    (f.location || "").toLowerCase().includes(q) ||
                    (f.category || "").toLowerCase().includes(q)
                );
                const embed = baseEmbed(`🔎 Suchergebnisse für „${q}“`, null).addFields({
                    name: `${results.length} Treffer`,
                    value: results.slice(0, 15).map(f =>
                        `${f.status === "aufgeloest" ? "🟥" : "🟩"} **${f.name}** — ${f.category || "—"} • ${f.location || "—"}`
                    ).join("\n").slice(0, 1024) || "Keine Treffer."
                });
                return interaction.reply({ embeds: [embed], ...EPHEMERAL });
            }
            return;
        }

        // ---------- BUTTON-NACHFOLGEN (Details / Direkt speichern / Abbrechen) ----------
        if (interaction.isButton()) {
            if (cid === "frak_cancel") {
                return interaction.update({ content: "❌ Abgebrochen.", embeds: [], components: [] });
            }
            if (cid === "frak_add_details") {
                const draft = pendingAdds.get(interaction.user.id);
                if (!draft || draft.guildId !== guild.id) return interaction.reply({ content: "❌ Entwurf nicht gefunden — bitte erneut starten.", ...EPHEMERAL });
                return interaction.showModal(addModal2());
            }
            if (cid === "frak_add_save") {
                const draft = pendingAdds.get(interaction.user.id);
                if (!draft || draft.guildId !== guild.id) return interaction.reply({ content: "❌ Entwurf nicht gefunden — bitte erneut starten.", ...EPHEMERAL });
                await interaction.deferUpdate();
                pendingAdds.delete(interaction.user.id);
                await finalizeFaction(guild, interaction, draft);
                return;
            }
        }
    } catch (e) {
        console.error("[FRAKTION] Interaktion-Fehler:", e);
        const payload = { content: "❌ Ein Fehler ist im Fraktionssystem aufgetreten.", ...EPHEMERAL };
        try {
            if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
            else await interaction.reply(payload);
        } catch (_) {}
    }
}

// -----------------------------------------------------
// SLASH COMMAND DEFINITION
// -----------------------------------------------------

const fraktionCommand = new SlashCommandBuilder()
    .setName("fraktion")
    .setDescription("Fraktionsverwaltung")
    .addSubcommand(s => s.setName("liste").setDescription("Aktualisiert und zeigt die Fraktionsliste"))
    .addSubcommand(s => s.setName("panel").setDescription("Erstellt das Fraktionsverwaltungs-Panel"))
    .addSubcommand(s => s.setName("info").setDescription("Zeigt Details einer Fraktion"))
    .addSubcommand(s => s.setName("suche").setDescription("Sucht Fraktionen nach Name, Standort oder Kategorie"))
    .addSubcommand(s => s.setName("statistik").setDescription("Zeigt Fraktionsstatistiken"))
    .addSubcommand(s => s.setName("setup").setDescription("Konfiguriert das Fraktionssystem")
        .addStringOption(o => o.setName("aktion").setDescription("Aktion").setRequired(true)
            .addChoices(
                { name: "Bekanntmachungskanal setzen", value: "announce" },
                { name: "Listenkanal setzen", value: "liste" },
                { name: "Warnlimit setzen", value: "warnlimit" },
                { name: "Kategorien setzen", value: "kategorien" }
            ))
        .addChannelOption(o => o.setName("kanal").setDescription("Kanal (für announce/liste)").addChannelTypes(ChannelType.GuildText))
        .addIntegerOption(o => o.setName("zahl").setDescription("Warnlimit (für warnlimit)"))
        .addStringOption(o => o.setName("text").setDescription("Kategorien, Komma-getrennt (für kategorien)")));

// -----------------------------------------------------
// INITIALISIERUNG
// -----------------------------------------------------

let initialized = false;

function initializeFraktionsSystem(client) {
    if (initialized) return;
    if (!client) throw new Error("Discord-Client fehlt.");
    initialized = true;

    client.on("interactionCreate", handleFraktionInteraction);

    async function register() {
        const cmd = fraktionCommand.toJSON();
        for (const guild of client.guilds.cache.values()) {
            try {
                await guild.commands.create(cmd);
            } catch (e) {
                console.error("[FRAKTION] Slash-Registrierung:", e.message);
            }
        }
    }

    if (client.isReady()) {
        void register();
        setTimeout(() => refreshAllLists(client).catch(() => {}), 15000);
    } else {
        client.once("clientReady", () => {
            void register();
            setTimeout(() => refreshAllLists(client).catch(() => {}), 15000);
        });
    }

    client.on("guildCreate", async g => {
        try {
            await g.commands.create(fraktionCommand.toJSON());
        } catch (e) {
            console.error("[FRAKTION] guildCreate-Registrierung:", e.message);
        }
    });

    // Aufbauschutz-Ablauf stündlich in den Listen nachziehen
    const timer = setInterval(() => {
        if (client.isReady()) refreshAllLists(client).catch(() => {});
    }, 60 * 60 * 1000);
    timer.unref?.();

    console.log("🏛️ Fraktions-System initialisiert (/fraktion).");
}

module.exports = {
    initializeFraktionsSystem,
    command: fraktionCommand,
    refreshGuildList,
    getFactions
};
