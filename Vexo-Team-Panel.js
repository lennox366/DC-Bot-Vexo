// =====================================================
// VEXO SYSTEM – TEAMVERWALTUNGSPANEL (discord.js v14)
// =====================================================
// Eigenständiges Modul: kollidiert nicht mit dem
// bestehenden Team-System (eigene customIds „vxp_").
//
// Einbindung in index.js:
//   const { initVexoTeamPanel, sendVexoTeamPanel } = require("./Vexo-Team-Panel");
//   initVexoTeamPanel(client);   // einmalig nach client-Erstellung
// Panel posten: !vexpanel (nur berechtigte Nutzer)
// =====================================================

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// =====================================================
// ⚙️ KONFIGURATION – HIER DEINE IDs EINTRAGEN
// =====================================================

const CONFIG = {
    // Kanal, in dem die Protokoll-Embeds landen (Leer = Log deaktiviert)
    LOG_CHANNEL_ID: "",

    // Rollen, die das Panel benutzen dürfen (Bot-Owner & Admins
    // sind immer erlaubt). z. B. ["1569408282949329108"]
    ALLOWED_ROLE_IDS: [],

    // Rolle, die neue Teammitglieder beim Beitritt bekommen
    JOIN_ROLE_ID: "",

    // Rolle, die gekickte Mitglieder stattdessen bekommen (optional, "" = aus)
    CITIZEN_ROLE_ID: "",

    // Rang-Leiter von OBEN nach UNTEN.
    // Uprank = eine Stufe höher, Downrank = eine Stufe tiefer.
    //roleId = Discord-Rollen-ID, label = Anzeigename
    RANKS: [
        // { roleId: "123456789012345678", label: "Owner" },
        // { roleId: "123456789012345679", label: "Admin" },
        // { roleId: "123456789012345680", label: "Moderator" }
    ],

    // Alle Team-Rollen, die bei Kick/Downrank entfernt werden
    // (wird aus RANKS + JOIN_ROLE_ID automatisch gebildet)

    // Speicher-Dateien (nicht ändern)
    WARNS_FILE: path.join(__dirname, "vexo-team-warns.json"),
    HISTORY_FILE: path.join(__dirname, "vexo-team-history.json"),

    MAX_WARNS: 3,
    PANEL_COLOR: 0x7B2FF7
};

// =====================================================
// DATEN & HILFSFUNKTIONEN
// =====================================================

function loadJson(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, "utf8")) || fallback;
    } catch (error) {
        console.error(`❌ [Vexo-Panel] Fehler beim Lesen von ${path.basename(file)}:`, error.message);
        return fallback;
    }
}

function saveJson(file, data) {
    try {
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
        fs.renameSync(tmp, file);
        return true;
    } catch (error) {
        console.error(`❌ [Vexo-Panel] Fehler beim Schreiben von ${path.basename(file)}:`, error.message);
        return false;
    }
}

// ---- Berechtigungen ----
function hasPanelPermission(member) {
    if (!member) return false;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    if (member.user?.id === member.client?.user?.id) return true;
    return CONFIG.ALLOWED_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

// ---- Nutzer-Eingabe (Mention oder ID) → GuildMember ----
async function resolveMember(guild, input) {
    const match = String(input || "").match(/(\d{17,20})/);
    if (!match) return null;
    return guild.members.fetch(match[1]).catch(() => null);
}

// ---- Rang-Logik ----
function allManagedRoleIds() {
    const ids = new Set(CONFIG.RANKS.map(r => r.roleId));
    if (CONFIG.JOIN_ROLE_ID) ids.add(CONFIG.JOIN_ROLE_ID);
    return [...ids].filter(Boolean);
}

function currentRankIndex(member) {
    for (let i = 0; i < CONFIG.RANKS.length; i++) {
        if (member.roles.cache.has(CONFIG.RANKS[i].roleId)) return i;
    }
    return -1;
}

async function setMemberRank(guild, member, targetIndex, reason) {
    const targetRoleId = CONFIG.RANKS[targetIndex]?.roleId;
    if (!targetRoleId) throw new Error("Zielrang ist nicht konfiguriert.");

    const botMember = guild.members.me || await guild.members.fetchMe();
    const toRemove = allManagedRoleIds().filter(id => id !== targetRoleId && member.roles.cache.has(id));
    const changed = [...toRemove, targetRoleId];
    const blocked = changed
        .map(id => guild.roles.cache.get(id))
        .filter(Boolean)
        .find(role => role.position >= botMember.roles.highest.position);
    if (blocked) {
        throw new Error(`Rolle „${blocked.name}“ liegt über der höchsten Bot-Rolle.`);
    }

    if (toRemove.length) await member.roles.remove(toRemove, reason);
    if (!member.roles.cache.has(targetRoleId)) {
        await member.roles.add(targetRoleId, reason);
    }
    return { added: [targetRoleId], removed: toRemove, rankLabel: CONFIG.RANKS[targetIndex].label };
}

// ---- Warn-Speicher ----
function getWarns(guildId, userId) {
    const data = loadJson(CONFIG.WARNS_FILE, {});
    if (!data[guildId]) data[guildId] = {};
    if (!data[guildId][userId]) data[guildId][userId] = [];
    return { data, list: data[guildId][userId] };
}

function saveWarns(data) {
    return saveJson(CONFIG.WARNS_FILE, data);
}

// ---- Aktions-Historie ----
function addHistoryEntry(guildId, entry) {
    const data = loadJson(CONFIG.HISTORY_FILE, {});
    if (!data[guildId]) data[guildId] = [];
    data[guildId].unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), ...entry });
    data[guildId] = data[guildId].slice(0, 100); // max. 100 Einträge
    saveJson(CONFIG.HISTORY_FILE, data);
}

function getHistory(guildId) {
    return loadJson(CONFIG.HISTORY_FILE, {})[guildId] || [];
}

// ---- Protokoll-Log ----
async function sendActionLog(guild, { title, color, lines }) {
    if (!CONFIG.LOG_CHANNEL_ID) {
        console.warn(`⚠️ [Vexo-Panel] LOG_CHANNEL_ID nicht gesetzt – Log „${title}“ nur in Konsole.`);
        console.log(`[Vexo-Panel] ${title}:`, lines.join(" | "));
        return false;
    }
    try {
        const channel = await guild.channels.fetch(CONFIG.LOG_CHANNEL_ID).catch(() => null);
        if (!channel?.isTextBased()) {
            console.error(`❌ [Vexo-Panel] Log-Kanal ${CONFIG.LOG_CHANNEL_ID} nicht gefunden/kein Textkanal.`);
            return false;
        }
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(
                "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n" +
                lines.map(l => `${l}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`).join("\n")
            )
            .setFooter({ text: "Vexo System • Teamverwaltung" })
            .setTimestamp();
        await channel.send({ embeds: [embed] });
        return true;
    } catch (error) {
        console.error(`❌ [Vexo-Panel] Log-Versand fehlgeschlagen:`, error.message);
        return false;
    }
}

// =====================================================
// PANEL-AUFBAU
// =====================================================

function panelEmbed() {
    return new EmbedBuilder()
        .setColor(CONFIG.PANEL_COLOR)
        .setTitle("👥 ・ TEAMVERWALTUNG ・ Vexo System")
        .setDescription(
            "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n" +
            "⚡ Verwalte dein Team schnell, sicher und übersichtlich.\n" +
            "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬"
        )
        .addFields(
            { name: "📈 Rang-Aktionen", value: "Uprank / Downrank", inline: true },
            { name: "⚠️ Verwarnungen", value: "Warnen / Warnung zurücknehmen", inline: true },
            { name: "🛡️ Team", value: "Beitreten / Kick / Historie", inline: true }
        )
        .setFooter({ text: "Vexo System • Teamverwaltung" })
        .setTimestamp();
}

function panelComponents() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("vxp_uprank").setLabel("Uprank").setEmoji("⬆️").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("vxp_downrank").setLabel("Downrank").setEmoji("⬇️").setStyle(ButtonStyle.Secondary)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("vxp_warn").setLabel("Warnen").setEmoji("⚠️").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("vxp_warnback").setLabel("Warnung zurück").setEmoji("↩️").setStyle(ButtonStyle.Primary)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("vxp_join").setLabel("Team beitreten").setEmoji("🚪").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("vxp_kick").setLabel("Teamkick").setEmoji("🥾").setStyle(ButtonStyle.Danger)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("vxp_history").setLabel("Teamhistorie").setEmoji("📜").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("vxp_settings").setLabel("Einstellungen").setEmoji("⚙️").setStyle(ButtonStyle.Secondary)
        )
    ];
}

function panelPayload() {
    return { embeds: [panelEmbed()], components: panelComponents() };
}

async function sendVexoTeamPanel(channel) {
    return channel.send(panelPayload());
}

// =====================================================
// MODALS
// =====================================================

const ACTION_META = {
    join:   { title: "Team beitreten",  emoji: "🚪", color: 0x57F287, logTitle: "🎉 TEAM BEITRITT" },
    uprank: { title: "Uprank",          emoji: "⬆️", color: 0x57F287, logTitle: "⬆️ TEAM UPRANK" },
    downrank:{ title: "Downrank",       emoji: "⬇️", color: 0xED4245, logTitle: "⬇️ TEAM DOWNRANK" },
    warn:   { title: "Verwarnen",       emoji: "⚠️", color: 0xFEE75C, logTitle: "⚠️ TEAM WARN" },
    kick:   { title: "Teamkick",        emoji: "🥾", color: 0xED4245, logTitle: "❌ TEAM KICK" }
};

function buildActionModal(action) {
    const meta = ACTION_META[action];
    return new ModalBuilder()
        .setCustomId(`vxp_modal_${action}`)
        .setTitle(`${meta.emoji} ${meta.title}`.slice(0, 45))
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("target")
                    .setLabel("Nutzer (ID oder @Mention)")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("z. B. @username oder 123456789012345678")
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("reason")
                    .setLabel("Grund (Pflicht)")
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(2)
                    .setMaxLength(500)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("note")
                    .setLabel("Notiz (optional)")
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(false)
            )
        );
}

// =====================================================
// AKTIONS-AUSFÜHRUNG
// =====================================================

async function executeAction(interaction, action) {
    const guild = interaction.guild;
    const executor = interaction.member;
    const meta = ACTION_META[action];

    const targetInput = interaction.fields.getTextInputValue("target").trim();
    const reason = interaction.fields.getTextInputValue("reason").trim();
    const note = interaction.fields.getTextInputValue("note")?.trim() || null;

    if (reason.length < 2) {
        return interaction.reply({ content: "❌ Der Grund muss mindestens 2 Zeichen enthalten.", flags: MessageFlags.Ephemeral });
    }

    const target = await resolveMember(guild, targetInput);
    if (!target) {
        return interaction.reply({ content: "❌ Nutzer nicht gefunden. Bitte ID oder Mention angeben.", flags: MessageFlags.Ephemeral });
    }
    if (target.id === interaction.user.id || target.id === guild.ownerId) {
        return interaction.reply({ content: "❌ Dieses Mitglied kann nicht bearbeitet werden.", flags: MessageFlags.Ephemeral });
    }

    const warnings = [];
    let summary = "";

    try {
        if (action === "join") {
            if (!CONFIG.JOIN_ROLE_ID) throw new Error("JOIN_ROLE_ID ist nicht konfiguriert.");
            if (allManagedRoleIds().some(id => target.roles.cache.has(id))) {
                throw new Error("Das Mitglied besitzt bereits Teamrollen.");
            }
            const role = guild.roles.cache.get(CONFIG.JOIN_ROLE_ID);
            if (!role) throw new Error(`Rolle ${CONFIG.JOIN_ROLE_ID} existiert auf diesem Server nicht.`);
            await target.roles.add(CONFIG.JOIN_ROLE_ID, `Teambeitritt: ${reason}`);
            summary = `**${target.user.tag}** ist dem Team beigetreten (${role}).`;

        } else if (action === "kick") {
            const toRemove = allManagedRoleIds().filter(id => target.roles.cache.has(id));
            if (toRemove.length === 0) throw new Error("Das Mitglied besitzt keine verwalteten Teamrollen.");
            await target.roles.remove(toRemove, `Teamkick: ${reason}`);
            if (CONFIG.CITIZEN_ROLE_ID && guild.roles.cache.has(CONFIG.CITIZEN_ROLE_ID)) {
                await target.roles.add(CONFIG.CITIZEN_ROLE_ID, "Teamkick: Bürger-Rolle").catch(e => warnings.push(`Bürger-Rolle nicht vergebbar: ${e.message}`));
            }
            summary = `**${target.user.tag}** wurde aus dem Team entfernt.`;

        } else if (action === "uprank" || action === "downrank") {
            if (CONFIG.RANKS.length === 0) throw new Error("Keine Ränge in CONFIG.RANKS konfiguriert.");
            const current = currentRankIndex(target);
            if (current === -1) throw new Error("Das Mitglied hat keinen erkannten Teamrang.");
            const next = action === "uprank" ? current - 1 : current + 1;
            if (next < 0 || next >= CONFIG.RANKS.length) {
                throw new Error(action === "uprank" ? "Das Mitglied ist bereits auf der höchsten Position." : "Das Mitglied ist bereits auf der niedrigsten Position.");
            }
            const result = await setMemberRank(guild, target, next, `${action}: ${reason}`);
            summary = `**${target.user.tag}**: ${CONFIG.RANKS[current]?.label || "?"} → **${result.rankLabel}**.`;

        } else if (action === "warn") {
            const { data, list } = getWarns(guild.id, target.id);
            if (list.length >= CONFIG.MAX_WARNS) {
                throw new Error(`Maximal ${CONFIG.MAX_WARNS} aktive Warnungen erreicht (${list.length}/${CONFIG.MAX_WARNS}).`);
            }
            list.push({ reason, note, by: interaction.user.tag, byId: interaction.user.id, at: new Date().toISOString() });
            if (!saveWarns(data)) throw new Error("Warnung konnte nicht gespeichert werden.");
            summary = `**${target.user.tag}** verwarnt (${list.length}/${CONFIG.MAX_WARNS}).`;
        }
    } catch (error) {
        console.error(`❌ [Vexo-Panel] Aktion ${action} fehlgeschlagen:`, error);
        return interaction.reply({ content: `❌ Aktion fehlgeschlagen: ${error.message}`, flags: MessageFlags.Ephemeral });
    }

    // ---- Protokoll-Log ----
    const logOk = await sendActionLog(guild, {
        title: meta.logTitle,
        color: meta.color,
        lines: [
            `👤 MITGLIED: ${target}`,
            `👮 DURCH: ${interaction.user}`,
            ...(note ? [`📝 NOTIZ: ${note}`] : []),
            `📄 GRUND: > ${reason}`,
            `🕐 WANN: ${new Date().toLocaleString("de-DE")}`
        ]
    });
    if (!logOk) warnings.push("Protokoll-Log konnte nicht gesendet werden (LOG_CHANNEL_ID prüfen).");

    // ---- Historie ----
    addHistoryEntry(guild.id, {
        action, targetId: target.id, targetTag: target.user.tag,
        by: interaction.user.tag, reason, note
    });

    return interaction.reply({
        content: `✅ ${summary}` + (warnings.length ? `\n⚠️ ${warnings.join("\n⚠️ ")}` : ""),
        flags: MessageFlags.Ephemeral
    });
}

// =====================================================
// WARNUNG ZURÜCKNEHMEN
// =====================================================

function warnbackEmbed(guildId, target) {
    const { list } = getWarns(guildId, target.id);
    if (list.length === 0) return null;
    const embed = new EmbedBuilder()
        .setColor(CONFIG.PANEL_COLOR)
        .setTitle(`⚠️ Aktive Warnungen – ${target.user.tag}`)
        .setDescription(
            list.map((w, i) =>
                `**#${i + 1}** • ${w.reason.slice(0, 80)}\n└ Von: ${w.by} • ${new Date(w.at).toLocaleDateString("de-DE")}`
            ).join("\n\n")
        )
        .setFooter({ text: `Vexo System • Teamverwaltung • ${list.length}/${CONFIG.MAX_WARNS}` });
    return { embed, count: list.length };
}

// =====================================================
// INITIALISIERUNG
// =====================================================

function initVexoTeamPanel(client) {

    // Panel über !vexpanel posten
    client.on("messageCreate", async message => {
        if (message.author.bot || !message.content.startsWith("!vexpanel")) return;
        if (!hasPanelPermission(message.member)) {
            return message.reply("❌ Du hast keine Berechtigung für die Teamverwaltung.");
        }
        try {
            await sendVexoTeamPanel(message.channel);
        } catch (error) {
            console.error("❌ [Vexo-Panel] Panel konnte nicht gesendet werden:", error);
            await message.reply("❌ Panel konnte nicht gesendet werden.").catch(() => {});
        }
    });

    client.on("interactionCreate", async interaction => {
        try {
            // ---- Panel-Buttons ----
            if (interaction.isButton() && interaction.customId.startsWith("vxp_")) {
                const id = interaction.customId;

                if (id === "vxp_settings") {
                    if (!hasPanelPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Keine Berechtigung.", flags: MessageFlags.Ephemeral });
                    }
                    const missing = [
                        !CONFIG.LOG_CHANNEL_ID && "LOG_CHANNEL_ID",
                        CONFIG.ALLOWED_ROLE_IDS.length === 0 && "ALLOWED_ROLE_IDS",
                        !CONFIG.JOIN_ROLE_ID && "JOIN_ROLE_ID",
                        CONFIG.RANKS.length === 0 && "RANKS"
                    ].filter(Boolean);
                    return interaction.reply({
                        content: missing.length
                            ? `⚠️ **Konfiguration unvollständig:**\n${missing.map(m => `• ${m}`).join("\n")}`
                            : "✅ **Konfiguration vollständig.**\n• Log-Kanal, Rollen und Ränge sind gesetzt.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (id === "vxp_history") {
                    if (!hasPanelPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Keine Berechtigung.", flags: MessageFlags.Ephemeral });
                    }
                    // Modal für Mitglieder-Abfrage
                    const modal = new ModalBuilder()
                        .setCustomId("vxp_hist_modal")
                        .setTitle("📜 Teamhistorie")
                        .addComponents(new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("target")
                                .setLabel("Nutzer (ID oder @Mention)")
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                        ));
                    return interaction.showModal(modal);
                }

                if (id === "vxp_warnback") {
                    if (!hasPanelPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Keine Berechtigung.", flags: MessageFlags.Ephemeral });
                    }
                    const modal = new ModalBuilder()
                        .setCustomId("vxp_warnback_modal")
                        .setTitle("↩️ Warnung zurücknehmen")
                        .addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder().setCustomId("target").setLabel("Nutzer (ID oder @Mention)").setStyle(TextInputStyle.Short).setRequired(true)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder().setCustomId("warnIndex").setLabel("Nummer der Warnung (z. B. 1)").setStyle(TextInputStyle.Short).setRequired(true)
                            ),
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder().setCustomId("reason").setLabel("Grund (Pflicht)").setStyle(TextInputStyle.Paragraph).setMinLength(2).setMaxLength(500).setRequired(true)
                            )
                        );
                    return interaction.showModal(modal);
                }

                const action = id.replace("vxp_", "");
                if (ACTION_META[action]) {
                    if (!hasPanelPermission(interaction.member)) {
                        return interaction.reply({ content: "❌ Keine Berechtigung für die Teamverwaltung.", flags: MessageFlags.Ephemeral });
                    }
                    return interaction.showModal(buildActionModal(action));
                }

                return interaction.reply({ content: "❌ Unbekannte Aktion.", flags: MessageFlags.Ephemeral });
            }

            // ---- Modals ----
            if (interaction.isModalSubmit() && interaction.customId.startsWith("vxp_modal_")) {
                const action = interaction.customId.replace("vxp_modal_", "");
                if (!hasPanelPermission(interaction.member)) {
                    return interaction.reply({ content: "❌ Keine Berechtigung.", flags: MessageFlags.Ephemeral });
                }
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                return executeAction(interaction, action);
            }

            // ---- Historie-Modal ----
            if (interaction.isModalSubmit() && interaction.customId === "vxp_hist_modal") {
                if (!hasPanelPermission(interaction.member)) {
                    return interaction.reply({ content: "❌ Keine Berechtigung.", flags: MessageFlags.Ephemeral });
                }
                const target = await resolveMember(interaction.guild, interaction.fields.getTextInputValue("target"));
                if (!target) {
                    return interaction.reply({ content: "❌ Nutzer nicht gefunden.", flags: MessageFlags.Ephemeral });
                }
                const history = getHistory(interaction.guild.id)
                    .filter(h => h.targetId === target.id)
                    .slice(0, 10);
                if (history.length === 0) {
                    return interaction.reply({ content: `📜 Keine Teamaktionen für **${target.user.tag}** gefunden.`, flags: MessageFlags.Ephemeral });
                }
                const embed = new EmbedBuilder()
                    .setColor(CONFIG.PANEL_COLOR)
                    .setTitle(`📜 Teamhistorie – ${target.user.tag}`)
                    .setDescription(
                        history.map((h, i) =>
                            `**${i + 1}.** ${ACTION_META[h.action]?.emoji || "•"} ${h.action} • von ${h.by}\n└ ${h.reason.slice(0, 100)} • ${new Date(h.at).toLocaleString("de-DE")}`
                        ).join("\n\n")
                    )
                    .setFooter({ text: `Vexo System • Teamverwaltung • ${history.length} Einträge` });
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            // ---- Warnung zurücknehmen ----
            if (interaction.isModalSubmit() && interaction.customId === "vxp_warnback_modal") {
                if (!hasPanelPermission(interaction.member)) {
                    return interaction.reply({ content: "❌ Keine Berechtigung.", flags: MessageFlags.Ephemeral });
                }
                const target = await resolveMember(interaction.guild, interaction.fields.getTextInputValue("target"));
                const index = parseInt(interaction.fields.getTextInputValue("warnIndex"), 10) - 1;
                const reason = interaction.fields.getTextInputValue("reason").trim();

                if (!target) return interaction.reply({ content: "❌ Nutzer nicht gefunden.", flags: MessageFlags.Ephemeral });
                if (reason.length < 2) return interaction.reply({ content: "❌ Grund zu kurz.", flags: MessageFlags.Ephemeral });

                const { data, list } = getWarns(interaction.guild.id, target.id);
                if (index < 0 || index >= list.length) {
                    return interaction.reply({ content: `❌ Warnung #${index + 1} existiert nicht (${list.length} aktiv).`, flags: MessageFlags.Ephemeral });
                }
                const removed = list.splice(index, 1)[0];
                if (!saveWarns(data)) {
                    list.splice(index, 0, removed); // rollback
                    return interaction.reply({ content: "❌ Entfernen fehlgeschlagen (Speicher).", flags: MessageFlags.Ephemeral });
                }

                await sendActionLog(interaction.guild, {
                    title: "🔄 TEAM WARN ENTFERNT",
                    color: 0x57F287,
                    lines: [
                        `👤 MITGLIED: ${target}`,
                        `👮 DURCH: ${interaction.user}`,
                        `🗑️ ENTFERNT: #${index + 1} – ${removed.reason}`,
                        `📊 WARNUNGEN: ${list.length}/${CONFIG.MAX_WARNS}`,
                        `📄 GRUND: > ${reason}`,
                        `🕐 WANN: ${new Date().toLocaleString("de-DE")}`
                    ]
                });

                addHistoryEntry(interaction.guild.id, {
                    action: "warnback", targetId: target.id, targetTag: target.user.tag,
                    by: interaction.user.tag, reason, note: `Warnung #${index + 1} entfernt`
                });

                return interaction.reply({
                    content: `✅ Warnung #${index + 1} von **${target.user.tag}** entfernt (${list.length}/${CONFIG.MAX_WARNS}).`,
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch (error) {
            console.error("❌ [Vexo-Panel] Interaktionsfehler:", error);
            if (interaction.isRepliable?.() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    });

    console.log("✅ [Vexo-Panel] Teamverwaltungs-Panel initialisiert.");
}

module.exports = { initVexoTeamPanel, sendVexoTeamPanel, panelPayload };
