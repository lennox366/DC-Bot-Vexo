const fs = require("fs");
const path = require("path");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    ChannelType
} = require("discord.js");

let WAITING_VOICE_CHANNEL_ID = "1563966885635035176";
let SUPPORT_PINGS_CHANNEL_ID = "1563980823030407188";
let SUPPORT_LOG_CHANNEL_ID = process.env.SUPPORT_LOG_CHANNEL_ID?.trim() || "1559659271329808420";
let SUPPORT_PING_ROLE_ID = "1559659267219390595";
const SUPPORT_STATE_FILE = path.join(__dirname, "..", "support-tickets.json");
const SUPPORT_CONFIG_FILE = path.join(__dirname, "..", "support-config.json");
const TEAM_ROLES_CONFIG_FILE = path.join(__dirname, "..", "team-roles-config.json");

function loadSupportConfig() {
    try {
        if (fs.existsSync(SUPPORT_CONFIG_FILE)) {
            const c = JSON.parse(fs.readFileSync(SUPPORT_CONFIG_FILE, "utf8"));
            if (c.waitingVoiceChannelId) WAITING_VOICE_CHANNEL_ID = c.waitingVoiceChannelId;
            if (c.pingsChannelId) SUPPORT_PINGS_CHANNEL_ID = c.pingsChannelId;
            if (c.logChannelId) SUPPORT_LOG_CHANNEL_ID = c.logChannelId;
            if (c.pingRoleId) SUPPORT_PING_ROLE_ID = c.pingRoleId;
        }
    } catch (e) {
        console.error("❌ Support-Config konnte nicht gelesen werden:", e);
    }
}

function saveSupportConfig() {
    try {
        fs.writeFileSync(SUPPORT_CONFIG_FILE, JSON.stringify({
            waitingVoiceChannelId: WAITING_VOICE_CHANNEL_ID,
            pingsChannelId: SUPPORT_PINGS_CHANNEL_ID,
            logChannelId: SUPPORT_LOG_CHANNEL_ID,
            pingRoleId: SUPPORT_PING_ROLE_ID
        }, null, 2), "utf8");
    } catch (e) {
        console.error("❌ Support-Config konnte nicht gespeichert werden:", e);
    }
}

function loadSupportRoles() {
    try {
        const config = JSON.parse(fs.readFileSync(TEAM_ROLES_CONFIG_FILE, "utf8"));
        const supporterCategory = config.roleHierarchy.find(category =>
            category.category.toLowerCase() === "supporter"
        );
        return new Set(
            (supporterCategory?.roles || [])
                .filter(role => !role.name.includes("━"))
                .map(role => role.id)
        );
    } catch (error) {
        console.error("❌ Support-Rollen konnten nicht geladen werden:", error);
        return new Set();
    }
}

function loadSupportTickets() {
    try {
        if (!fs.existsSync(SUPPORT_STATE_FILE)) {
            return {};
        }
        const data = JSON.parse(fs.readFileSync(SUPPORT_STATE_FILE, "utf8"));
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Die Support-Ticket-Datei enthält kein gültiges Objekt.");
        }
        return data;
    } catch (error) {
        console.error("❌ Support-Tickets konnten nicht geladen werden:", error);
        return {};
    }
}

function saveSupportTickets(tickets) {
    try {
        fs.writeFileSync(SUPPORT_STATE_FILE, JSON.stringify(tickets, null, 2), "utf8");
    } catch (error) {
        console.error("❌ Support-Tickets konnten nicht gespeichert werden:", error);
        throw error;
    }
}

function elapsedSeconds(from, to = Date.now()) {
    return Math.max(0, Math.floor((to - new Date(from).getTime()) / 1000));
}

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes} Min. ${remainingSeconds} Sek.` : `${remainingSeconds} Sek.`;
}

async function sendSupportActionLog(guild, ticket, interaction, action) {
    if (!SUPPORT_LOG_CHANNEL_ID) {
        throw new Error("SUPPORT_LOG_CHANNEL_ID ist nicht konfiguriert.");
    }

    const channel = await guild.channels.fetch(SUPPORT_LOG_CHANNEL_ID);
    if (!channel?.isTextBased() || channel.guildId !== guild.id) {
        throw new Error(`Support-Log-Kanal ${SUPPORT_LOG_CHANNEL_ID} fehlt oder ist kein Textkanal dieses Servers.`);
    }

    const botMember = guild.members.me || await guild.members.fetchMe();
    const permissions = channel.permissionsFor(botMember);
    const missingPermissions = [
        ["Nachrichten senden", PermissionFlagsBits.SendMessages],
        ["Embeds senden", PermissionFlagsBits.EmbedLinks]
    ].filter(([, permission]) => !permissions?.has(permission));
    if (missingPermissions.length > 0) {
        throw new Error(`Dem Bot fehlen im Support-Log-Kanal Rechte: ${missingPermissions.map(([name]) => name).join(", ")}.`);
    }

    const isClose = action === "close";
    const reason = typeof ticket.reason === "string" && ticket.reason.trim()
        ? ticket.reason.trim().slice(0, 1024)
        : "Im Ticket wurde kein separater Grund erfasst.";
    const embed = new EmbedBuilder()
        .setColor(isClose ? 0xED4245 : 0x57F287)
        .setTitle(isClose ? "🔴 Support-Fall geschlossen" : "🟢 Support-Fall angenommen")
        .addFields(
            { name: "Betroffenes Mitglied", value: `<@${ticket.userId}>`, inline: true },
            { name: "Bearbeiter", value: `${interaction.user}\n${interaction.user.tag}`, inline: true },
            { name: "Grund / Anmerkung", value: reason, inline: false },
            {
                name: "Support-Call",
                value: ticket.supportChannelId ? `<#${ticket.supportChannelId}>` : "Nicht verfügbar",
                inline: true
            },
            { name: "Zeitpunkt", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setTimestamp();

    await channel.send({ embeds: [embed] });
}

async function logSupportAction(interaction, ticket, action) {
    try {
        await sendSupportActionLog(interaction.guild, ticket, interaction, action);
    } catch (error) {
        console.error("❌ Support-Aktion wurde ausgeführt, aber das Support-Log konnte nicht gesendet werden:", error);
        await interaction.followUp({
            content: `⚠️ Die Support-Aktion wurde ausgeführt, aber das Support-Log ist fehlgeschlagen: ${error.message}`,
            flags: MessageFlags.Ephemeral
        }).catch(followUpError => {
            console.error("❌ Hinweis zum fehlgeschlagenen Support-Log konnte nicht angezeigt werden:", followUpError);
        });
    }
}

function createTicketEmbed(ticket, status) {
    const accepted = ticket.status === "accepted";
    const closed = ticket.status === "closed";
    const color = closed ? 0xED4245 : accepted ? 0x57F287 : 0xF1C40F;
    const statusText = closed
        ? "SUPPORT GESCHLOSSEN"
        : accepted
            ? "SUPPORT WIRD BEARBEITET"
            : "NEUER SUPPORT-FALL";

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("🎧 N O V E X  R P • S U P P O R T")
        .setDescription(`━━━━━━━━━━━━━━━━━━━━\n${accepted ? "🟢" : closed ? "🔴" : "🟡"} **${statusText}**\n━━━━━━━━━━━━━━━━━━━━`)
        .addFields(
            { name: "👤 Bürger", value: `<@${ticket.userId}>`, inline: false },
            {
                name: "🛠️ Supporter",
                value: ticket.acceptedById ? `<@${ticket.acceptedById}>` : "Noch nicht übernommen",
                inline: false
            },
            { name: "⌛ Wartezeit", value: formatDuration(elapsedSeconds(ticket.createdAt, ticket.acceptedAt || ticket.closedAt || Date.now())), inline: true }
        );

    if (ticket.acceptedAt) {
        embed.addFields({
            name: "⏱️ Support-Dauer",
            value: formatDuration(elapsedSeconds(ticket.acceptedAt, ticket.closedAt || Date.now())),
            inline: true
        });
    }
    if (status) {
        embed.setFooter({ text: status });
    }
    return embed;
}

function createTicketComponents(ticket) {
    if (ticket.status === "open") {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`support:accept:${ticket.guildId}:${ticket.userId}`)
                    .setLabel("Übernehmen")
                    .setEmoji("🟢")
                    .setStyle(ButtonStyle.Success)
            )
        ];
    }
    if (ticket.status === "accepted") {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`support:close:${ticket.guildId}:${ticket.userId}`)
                    .setLabel("Schließen")
                    .setEmoji("🔴")
                    .setStyle(ButtonStyle.Danger)
            )
        ];
    }
    return [];
}

const supportSetupCommand = new SlashCommandBuilder()
    .setName("supportsetup")
    .setDescription("Konfiguriert den Support-Warteraum und Support-Pings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName("aktion").setDescription("Aktion").setRequired(true)
        .addChoices(
            { name: "Wartekanal (Voice) setzen", value: "wartekanal" },
            { name: "Ping-Kanal setzen", value: "pingkanal" },
            { name: "Ping-Rolle setzen", value: "pingrolle" },
            { name: "Log-Kanal setzen", value: "logkanal" },
            { name: "Status anzeigen", value: "status" }
        ))
    .addChannelOption(o => o.setName("kanal").setDescription("Kanal").addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildText))
    .addRoleOption(o => o.setName("rolle").setDescription("Rolle (für pingrolle)"));

function initializeSupportSystem(client) {
    loadSupportConfig();
    const supporterRoleIds = loadSupportRoles();
    const tickets = loadSupportTickets();

    function isSupporter(member) {
        const roles = member?.roles?.cache;
        const roleIds = roles
            ? new Set(roles.keys())
            : new Set(Array.isArray(member?.roles) ? member.roles : []);

        return roleIds.has(SUPPORT_PING_ROLE_ID) ||
            [...supporterRoleIds].some(roleId => roleIds.has(roleId));
    }

    async function syncWaitingMembers() {
        try {
            const waitChannel = await client.channels.fetch(WAITING_VOICE_CHANNEL_ID);
            if (!waitChannel?.isVoiceBased()) {
                console.warn(`⚠️ Support-Wartekanal ${WAITING_VOICE_CHANNEL_ID} fehlt oder ist kein Voice-Kanal.`);
                return;
            }

            const guild = waitChannel.guild;
            const pingChannel = await guild.channels.fetch(SUPPORT_PINGS_CHANNEL_ID);
            if (!pingChannel?.isTextBased()) {
                console.warn(`⚠️ Support-Ping-Kanal ${SUPPORT_PINGS_CHANNEL_ID} fehlt oder ist kein Text-Kanal auf ${guild.name}.`);
                return;
            }

            const permissions = pingChannel.permissionsFor(client.user);
            const requiredPermissions = [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks
            ];
            const missingPermissions = requiredPermissions.filter(permission => !permissions?.has(permission));
            if (missingPermissions.length > 0) {
                console.warn(
                    `⚠️ Im Support-Ping-Kanal fehlen Bot-Rechte auf ${guild.name}: ${missingPermissions.join(", ")}.`
                );
                return;
            }

            const waitingMembers = [...waitChannel.members.values()].filter(member => !member.user.bot);
            console.log(
                `ℹ️ Support-Startprüfung: Wartekanal „${waitChannel.name}“ auf ${guild.name}, ${waitingMembers.length} Bürger im Kanal.`
            );
            for (const member of waitingMembers) {
                await createSupportRequest(member);
            }
        } catch (error) {
            console.error("❌ Support-Abgleich beim Botstart fehlgeschlagen:", error);
        }
    }

    async function createSupportRequest(member, { forceNew = false } = {}) {
        const ticketKey = `${member.guild.id}:${member.id}`;
        const existing = tickets[ticketKey];
        if (!forceNew && existing && (existing.status === "open" || existing.status === "accepted")) {
            return;
        }

        const pingChannel = await client.channels.fetch(SUPPORT_PINGS_CHANNEL_ID);
        if (!pingChannel?.isTextBased() || pingChannel.guildId !== member.guild.id) {
            throw new Error(`Support-Pings-Kanal ${SUPPORT_PINGS_CHANNEL_ID} ist nicht verfügbar.`);
        }

        const pingPermissions = pingChannel.permissionsFor(client.user);
        const missingPingPermissions = [
            ["ViewChannel", PermissionFlagsBits.ViewChannel],
            ["SendMessages", PermissionFlagsBits.SendMessages],
            ["EmbedLinks", PermissionFlagsBits.EmbedLinks]
        ].filter(([, permission]) => !pingPermissions?.has(permission));
        if (missingPingPermissions.length > 0) {
            throw new Error(
                `Dem Bot fehlen im privaten Support-Ping-Kanal „${pingChannel.name}“ Rechte: ${missingPingPermissions.map(([name]) => name).join(", ")}.`
            );
        }

        const pingRole = await member.guild.roles.fetch(SUPPORT_PING_ROLE_ID).catch(() => null);
        if (!pingRole) {
            console.warn(`⚠️ Support-Ping-Rolle ${SUPPORT_PING_ROLE_ID} fehlt auf ${member.guild.name}; der Support-Fall wird ohne Rollen-Ping erstellt.`);
        } else if (
            !pingRole.mentionable &&
            !pingChannel.permissionsFor(client.user)?.has(PermissionFlagsBits.MentionEveryone)
        ) {
            console.warn(`⚠️ Die Support-Ping-Rolle ${SUPPORT_PING_ROLE_ID} ist nicht erwähnbar. Aktiviere „Rolle erwähnen“ für die Rolle oder gib dem Bot „Erwähne @everyone, @here und alle Rollen“.`);
        }

        const ticket = {
            guildId: member.guild.id,
            userId: member.id,
            waitChannelId: WAITING_VOICE_CHANNEL_ID,
            messageId: null,
            textChannelId: pingChannel.id,
            status: "open",
            createdAt: new Date().toISOString(),
            acceptedById: null,
            acceptedAt: null,
            supportChannelId: null,
            closedAt: null,
            blockedCallChannelIds: [
                ...(Array.isArray(existing?.blockedCallChannelIds) ? existing.blockedCallChannelIds : []),
                ...(existing?.blockedCallChannelId ? [existing.blockedCallChannelId] : [])
            ]
        };

        tickets[ticketKey] = ticket;
        saveSupportTickets(tickets);

        const content = pingRole ? `<@&${SUPPORT_PING_ROLE_ID}> 🎧 Ein neuer Support-Fall wartet!` : "🎧 Ein neuer Support-Fall wartet!";
        let message;
        try {
            message = await pingChannel.send({
                content,
                embeds: [createTicketEmbed(ticket)],
                components: createTicketComponents(ticket),
                allowedMentions: {
                    roles: pingRole ? [SUPPORT_PING_ROLE_ID] : []
                }
            });
        } catch (error) {
            delete tickets[ticketKey];
            saveSupportTickets(tickets);
            throw error;
        }
        ticket.messageId = message.id;
        saveSupportTickets(tickets);
        console.log(`✅ Support-Fall erstellt für ${member.user.tag}.`);
    }

    client.on("voiceStateUpdate", async (oldState, newState) => {
        try {
            if (!newState.guild || oldState.channelId === newState.channelId) {
                return;
            }

            const member = newState.member || oldState.member;
            if (!member || member.user.bot) {
                return;
            }

            if (newState.channelId === WAITING_VOICE_CHANNEL_ID) {
                console.log(`ℹ️ ${member.user.tag} ist dem Support-Wartekanal auf ${newState.guild.name} beigetreten.`);
                await createSupportRequest(member, { forceNew: true });
            }
        } catch (error) {
            console.error("❌ Fehler beim Verarbeiten des Support-Voice-Status:", error);
        }
    });

    client.once("clientReady", () => {
        void syncWaitingMembers();
        void (async () => {
            for (const guild of client.guilds.cache.values()) {
                try { await guild.commands.create(supportSetupCommand.toJSON()); }
                catch (e) { console.error("[SUPPORT] setup-Registrierung:", e.message); }
            }
        })();
    });

    client.on("guildCreate", async g => {
        try { await g.commands.create(supportSetupCommand.toJSON()); }
        catch (e) { console.error("[SUPPORT] guildCreate:", e.message); }
    });

    client.on("interactionCreate", async interaction => {
        if (interaction.isChatInputCommand() && interaction.commandName === "supportsetup") {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: "🔒 Du benötigst die Berechtigung „Server verwalten“.", flags: MessageFlags.Ephemeral });
            }
            const aktion = interaction.options.getString("aktion", true);
            const kanal = interaction.options.getChannel("kanal");
            const rolle = interaction.options.getRole("rolle");
            if (aktion === "status") {
                return interaction.reply({
                    content: `**Support-Setup**\n• Wartekanal: <#${WAITING_VOICE_CHANNEL_ID}>\n• Ping-Kanal: <#${SUPPORT_PINGS_CHANNEL_ID}>\n• Ping-Rolle: <@&${SUPPORT_PING_ROLE_ID}>\n• Log-Kanal: <#${SUPPORT_LOG_CHANNEL_ID}>`,
                    flags: MessageFlags.Ephemeral
                });
            }
            if (aktion === "wartekanal") {
                if (!kanal || kanal.type !== ChannelType.GuildVoice) return interaction.reply({ content: "❌ Bitte einen Sprachkanal angeben.", flags: MessageFlags.Ephemeral });
                WAITING_VOICE_CHANNEL_ID = kanal.id; saveSupportConfig();
                return interaction.reply({ content: `✅ Wartekanal auf ${kanal} gesetzt.`, flags: MessageFlags.Ephemeral });
            }
            if (aktion === "pingkanal") {
                if (!kanal || !kanal.isTextBased()) return interaction.reply({ content: "❌ Bitte einen Textkanal angeben.", flags: MessageFlags.Ephemeral });
                SUPPORT_PINGS_CHANNEL_ID = kanal.id; saveSupportConfig();
                return interaction.reply({ content: `✅ Ping-Kanal auf <#${kanal.id}> gesetzt.`, flags: MessageFlags.Ephemeral });
            }
            if (aktion === "pingrolle") {
                if (!rolle) return interaction.reply({ content: "❌ Bitte eine Rolle angeben.", flags: MessageFlags.Ephemeral });
                SUPPORT_PING_ROLE_ID = rolle.id; saveSupportConfig();
                return interaction.reply({ content: `✅ Ping-Rolle auf ${rolle} gesetzt.`, flags: MessageFlags.Ephemeral });
            }
            if (aktion === "logkanal") {
                if (!kanal || !kanal.isTextBased()) return interaction.reply({ content: "❌ Bitte einen Textkanal angeben.", flags: MessageFlags.Ephemeral });
                SUPPORT_LOG_CHANNEL_ID = kanal.id; saveSupportConfig();
                return interaction.reply({ content: `✅ Log-Kanal auf <#${kanal.id}> gesetzt.`, flags: MessageFlags.Ephemeral });
            }
            return interaction.reply({ content: "❌ Unbekannte Aktion.", flags: MessageFlags.Ephemeral });
        }
        if (!interaction.isButton() || !interaction.customId.startsWith("support:")) {
            return;
        }

        const [, action, guildId, userId] = interaction.customId.split(":");
        if (!guildId || !userId || interaction.guildId !== guildId) {
            return interaction.reply({
                content: "❌ Dieser Support-Fall ist ungültig.",
                flags: MessageFlags.Ephemeral
            });
        }

        const ticketKey = `${guildId}:${userId}`;
        const ticket = tickets[ticketKey];
        if (!ticket || !ticket.messageId || ticket.messageId !== interaction.message.id) {
            return interaction.reply({
                content: "ℹ️ Dieser Support-Fall ist nicht mehr aktiv.",
                flags: MessageFlags.Ephemeral
            });
        }
        if (!isSupporter(interaction.member)) {
            return interaction.reply({
                content: "❌ Nur Mitglieder mit der Support-Ping-Rolle oder einer Support-Team-Rolle können diesen Fall übernehmen oder schließen.",
                flags: MessageFlags.Ephemeral
            });
        }

        // Schicht-Pflicht: Wenn das Schicht-System auf diesem Server Einträge hat,
        // darf nur übernommen werden, wer aktuell auf Schicht ist.
        if (action === "accept" && typeof global.isOnShiftActive === "function" && global.isOnShiftActive(guildId)) {
            if (!global.isOnShift(guildId, interaction.user.id)) {
                return interaction.reply({
                    content: "❌ Du bist nicht auf Schicht. Tritt zuerst über das Schicht-Panel bei, um Support-Pings anzunehmen.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        await interaction.deferUpdate();

        try {
            const guild = interaction.guild;
            const applicant = await guild.members.fetch(userId).catch(() => null);

            if (action === "accept") {
                if (ticket.status !== "open") {
                    return interaction.followUp({
                        content: "ℹ️ Dieser Support-Fall wurde bereits übernommen oder geschlossen.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const supporterVoiceChannel = interaction.member.voice?.channel;
                if (!supporterVoiceChannel || supporterVoiceChannel.id === WAITING_VOICE_CHANNEL_ID) {
                    return interaction.followUp({
                        content: "❌ Betrete zuerst deinen Support-Call, damit der Bürger dorthin verschoben werden kann.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                if (!applicant) {
                    return interaction.followUp({
                        content: "❌ Der Bürger ist nicht mehr auf diesem Server.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                if (!guild.members.me?.permissions.has("MoveMembers")) {
                    return interaction.followUp({
                        content: "❌ Dem Bot fehlt die Berechtigung „Mitglieder verschieben“.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                ticket.status = "accepted";
                ticket.acceptedById = interaction.user.id;
                ticket.acceptedAt = new Date().toISOString();
                ticket.supportChannelId = supporterVoiceChannel.id;
                saveSupportTickets(tickets);

                try {
                    await applicant.voice.setChannel(supporterVoiceChannel, "Support-Fall übernommen");
                } catch (error) {
                    ticket.status = "open";
                    ticket.acceptedById = null;
                    ticket.acceptedAt = null;
                    ticket.supportChannelId = null;
                    saveSupportTickets(tickets);
                    throw error;
                }

                // Nur erfolgreiche Support-Ping-Übernahmen zählen.
                // Die Nachrichten-ID verhindert doppelte Punkte für denselben Ping.
                try {
                    if (typeof global.recordSupportPingTakeover === "function") {
                        global.recordSupportPingTakeover(guildId, interaction.user.id, ticket.messageId);
                    } else {
                        console.warn("Support-Leaderboard: Statistik-Funktion in index.js nicht gefunden.");
                    }
                } catch (statsError) {
                    console.error("Support-Leaderboard: Übernahme konnte nicht gezählt werden:", statsError);
                }

                await logSupportAction(interaction, ticket, action);
                await interaction.message.edit({
                    embeds: [createTicketEmbed(ticket)],
                    components: createTicketComponents(ticket)
                });
                return;
            }

            if (action === "close") {
                if (ticket.status !== "accepted") {
                    return interaction.followUp({
                        content: "ℹ️ Dieser Support-Fall ist nicht aktiv.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                ticket.status = "closed";
                ticket.closedAt = new Date().toISOString();
                ticket.blockedCallChannelIds = [
                    ...new Set([
                        ...(Array.isArray(ticket.blockedCallChannelIds) ? ticket.blockedCallChannelIds : []),
                        ticket.supportChannelId
                    ].filter(Boolean))
                ];
                saveSupportTickets(tickets);

                await logSupportAction(interaction, ticket, action);
                if (applicant?.voice.channelId === ticket.supportChannelId) {
                    await applicant.voice.disconnect("Support-Fall geschlossen. Für neuen Support erneut dem Wartekanal beitreten.");
                }

                await interaction.message.edit({
                    embeds: [createTicketEmbed(ticket)],
                    components: []
                });
            }
        } catch (error) {
            console.error("❌ Fehler bei der Support-Fall-Aktion:", error);
            await interaction.followUp({
                content: "❌ Die Support-Aktion ist fehlgeschlagen. Prüfe die Bot-Rechte für Nachrichten und Sprachkanäle.",
                flags: MessageFlags.Ephemeral
            });
        }
    });

    console.log("✅ Support-Warteschlange initialisiert.");
}

module.exports = { initializeSupportSystem, supportSetupCommand };
