
"use strict";

const fs = require("fs");
const path = require("path");

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder
} = require("discord.js");

// =====================================================
// VEXO RP TICKET SYSTEM
// discord.js v14
// =====================================================

const SERVER_NAME = "💫 𝐕𝐞𝐱𝐨 𝐑𝐏 ┃ 𝐕𝟏";
const COLOR = 0x9B59B6;
const TIMEZONE = "Europe/Berlin";

const CONFIG_FILE = path.join(
    __dirname,
    "Ticket-System.json"
);

const DATA_FILE = path.join(
    __dirname,
    "Ticket-Daten.json"
);


const BOT_OWNER_USER_IDS = [
    "1322191083303731201"
];


const REMINDER_INTERVAL = 2 * 60 * 60 * 1000;
const REMINDER_CHECK_INTERVAL = 5 * 60 * 1000;

// =====================================================
// DISCORD-KATEGORIEN
// =====================================================

const DISCORD_CATEGORIES = {
    allgemeinerSupport: "1559659275163275335",
    teambeschwerden: "1559659275163275336",
    highteamFragen: "1559659275163275337",
    fehlerReport: "1559659275163275338",
    entbannungsantrag: "1559659275163275339",
    leitungsFragen: "1559659275163275340",
    muendlicheBewerbung: "1559659275163275341",
    bauGenehmigungen: "1559659275163275342",
    fraktionenWaffenscheine: "1559659275163275343"
};

// =====================================================
// DISCORD-ROLLEN
// =====================================================

const ROLES = {
    // Globale Leitung / Ausnahmen
    serverbesitzer: "1559659267441819694",
    founder: "1559659267441819689",
    mitgruender: "1559659267349553270",
    owner: "1559659267408134201",
    coowner: "1559659267408134200",
    developer: "1559659267395428541",
    stvDeveloper: "1561119043983773696",

    // Projektleitung
    leitendeProjektleitung: "1559659267395428537",
    projektleitung: "1559659267395428536",
    stvProjektleitung: "1559659267395428535",

    // Management
    leitenderManager: "1559659267349553269",
    manager: "1559659267349553268",
    stvManager: "1559659267349553267",

    // Supervisor
    leitenderSupervisor: "1559659267349553264",
    supervisor: "1559659267349553263",
    stvSupervisor: "1559659267324256375",

    // Teamleitung
    leitendeTeamleitung: "1559659267324256370",
    teamleitung: "1559659267324256369",
    stvTeamleitung: "1559659267324256368",

    // Administration
    headAdmin: "1559659267299217466",
    seniorAdmin: "1559659267299217465",
    admin: "1559659267299217464",
    juniorAdmin: "1559659267299217463",

    // Moderation
    headMod: "1559659267299217461",
    seniorMod: "1559659267299217460",
    mod: "1559659267299217459",
    juniorMod: "1559659267269595155",

    // Support
    headSup: "1559659267269595153",
    seniorSup: "1559659267269595152",
    sup: "1559659267269595151",
    testSup: "1559659267269595150",

    // Fraktionsverwaltung
    fraktionsverwaltung: "1559659267307339842",
    stvFraktionsverwaltung: "1559659267307339841"
};

// =====================================================
// ROLLENGRUPPEN
// =====================================================

const ROLE_GROUPS = {
    support: [
        ROLES.headSup,
        ROLES.seniorSup,
        ROLES.sup,
        ROLES.testSup
    ],

    moderation: [
        ROLES.headMod,
        ROLES.seniorMod,
        ROLES.mod,
        ROLES.juniorMod
    ],

    administration: [
        ROLES.headAdmin,
        ROLES.seniorAdmin,
        ROLES.admin,
        ROLES.juniorAdmin
    ],

    management: [
        ROLES.leitenderManager,
        ROLES.manager,
        ROLES.stvManager
    ],

    supervisor: [
        ROLES.leitenderSupervisor,
        ROLES.supervisor,
        ROLES.stvSupervisor
    ],

    teamleitung: [
        ROLES.leitendeTeamleitung,
        ROLES.teamleitung,
        ROLES.stvTeamleitung
    ],

    projektleitung: [
        ROLES.leitendeProjektleitung,
        ROLES.projektleitung,
        ROLES.stvProjektleitung
    ],

    serverleitung: [
        ROLES.serverbesitzer,
        ROLES.founder,
        ROLES.mitgruender,
        ROLES.owner,
        ROLES.coowner
    ],

    fraktionsverwaltung: [
        ROLES.fraktionsverwaltung,
        ROLES.stvFraktionsverwaltung
    ]
};

ROLE_GROUPS.highteam = [
    ...ROLE_GROUPS.teamleitung,
    ...ROLE_GROUPS.supervisor,
    ...ROLE_GROUPS.management,
    ...ROLE_GROUPS.projektleitung,
    ...ROLE_GROUPS.serverleitung
];

ROLE_GROUPS.leitungsebene = [
    ...ROLE_GROUPS.highteam
];

ROLE_GROUPS.staff = [
    ...ROLE_GROUPS.support,
    ...ROLE_GROUPS.moderation,
    ...ROLE_GROUPS.administration
];

// Rollen, die ALLE Tickets bearbeiten dürfen.
const GLOBAL_ACCESS_ROLES = [
    ROLES.serverbesitzer,
    ROLES.founder,
    ROLES.mitgruender,
    ROLES.owner,
    ROLES.coowner,
    ROLES.developer,
    ROLES.stvDeveloper
];

// =====================================================
// 13 TICKET-ARTEN
// =====================================================

const TICKET_TYPES = [
    {
        id: "entbannung",
        label: "Entbannung",
        emoji: "🔓",
        description: "Antrag auf Entbannung",
        categoryId: DISCORD_CATEGORIES.entbannungsantrag,
        roleIds: [
            ...ROLE_GROUPS.moderation,
            ...ROLE_GROUPS.administration
        ]
    },
    {
        id: "intern",
        label: "Intern",
        emoji: "🔒",
        description: "Interne Angelegenheiten",
        categoryId: DISCORD_CATEGORIES.highteamFragen,
        roleIds: [
            ...ROLE_GROUPS.leitungsebene
        ]
    },
    {
        id: "highteam",
        label: "High Team",
        emoji: "👑",
        description: "Kontakt zum High Team",
        categoryId: DISCORD_CATEGORIES.highteamFragen,
        roleIds: [
            ...ROLE_GROUPS.highteam
        ]
    },
    {
        id: "coowner",
        label: "Co-Owner / Owner",
        emoji: "🏛️",
        description: "Kontakt zur Serverleitung",
        categoryId: DISCORD_CATEGORIES.leitungsFragen,
        roleIds: [
            ROLES.coowner,
            ROLES.owner
        ]
    },
    {
        id: "teambeschwerde",
        label: "Team Beschwerde",
        emoji: "📢",
        description: "Beschwerde über Teammitglieder",
        categoryId: DISCORD_CATEGORIES.teambeschwerden,
        roleIds: [
            ...ROLE_GROUPS.administration
        ]
    },
    {
        id: "anliegen",
        label: "Anliegen",
        emoji: "📝",
        description: "Allgemeine Anliegen",
        categoryId: DISCORD_CATEGORIES.allgemeinerSupport,
        roleIds: [
            ...ROLE_GROUPS.support,
            ...ROLE_GROUPS.moderation,
            ...ROLE_GROUPS.administration
        ]
    },
    {
        id: "beschwerde",
        label: "Generelle Beschwerden",
        emoji: "⚠️",
        description: "Allgemeine Beschwerden",
        categoryId: DISCORD_CATEGORIES.allgemeinerSupport,
        roleIds: [
            ...ROLE_GROUPS.highteam
        ]
    },
    {
        id: "serverwechsel",
        label: "Server Wechsel",
        emoji: "🔄",
        description: "Anfrage zum Serverwechsel",
        categoryId: DISCORD_CATEGORIES.leitungsFragen,
        roleIds: [
            ...ROLE_GROUPS.projektleitung
        ]
    },
    {
        id: "partner",
        label: "Partner Ticket",
        emoji: "🤝",
        description: "Partnerschaftsanfragen",
        categoryId: DISCORD_CATEGORIES.leitungsFragen,
        roleIds: [
            ...ROLE_GROUPS.management,
            ...ROLE_GROUPS.moderation,
            ...ROLE_GROUPS.administration
        ]
    },
    {
        id: "fraktion",
        label: "Fraktion",
        emoji: "🏢",
        description: "Fraktionsanliegen",
        categoryId: DISCORD_CATEGORIES.fraktionenWaffenscheine,
        roleIds: [
            ...ROLE_GROUPS.fraktionsverwaltung
        ]
    },
    {
        id: "waffenschein",
        label: "Waffenschein",
        emoji: "📋",
        description: "Waffenschein beantragen",
        categoryId: DISCORD_CATEGORIES.fraktionenWaffenscheine,
        roleIds: [
            ...ROLE_GROUPS.fraktionsverwaltung
        ]
    },
    {
        id: "contentcreator",
        label: "Content Creator",
        emoji: "🎨",
        description: "Content-Creator-Anfragen",
        categoryId: DISCORD_CATEGORIES.allgemeinerSupport,
        roleIds: [
            ...ROLE_GROUPS.highteam
        ]
    },
    {
        id: "fragen",
        label: "Fragen",
        emoji: "❓",
        description: "Allgemeine Fragen",
        categoryId: DISCORD_CATEGORIES.allgemeinerSupport,
        roleIds: [
            ...ROLE_GROUPS.staff
        ]
    }
];

// =====================================================
// DATEIEN LESEN / SPEICHERN
// =====================================================

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            return fallback;
        }

        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch (error) {
        console.error("[TICKET] JSON-Lesefehler:", error);
        return fallback;
    }
}

function writeJSON(file, data) {
    try {
        const temporaryFile = file + ".tmp";

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        fs.renameSync(temporaryFile, file);

        return true;
    } catch (error) {
        console.error("[TICKET] JSON-Speicherfehler:", error);
        return false;
    }
}

function loadData() {
    const data = readJSON(DATA_FILE, {
        tickets: {}
    });

    if (!data.tickets) {
        data.tickets = {};
    }

    return data;
}

function saveData(data) {
    return writeJSON(DATA_FILE, data);
}

// =====================================================
// KONFIGURATION
// =====================================================

function getGuildConfig(guildId) {
    const all = readJSON(CONFIG_FILE, {
        guilds: {}
    });

    const saved = all.guilds?.[guildId] || {};

    return {
        logChannelId: null,
        nightLock: true,
        name: SERVER_NAME,
        ...saved
    };
}

function saveGuildConfig(guildId, config) {
    const all = readJSON(CONFIG_FILE, {
        guilds: {}
    });

    if (!all.guilds) {
        all.guilds = {};
    }

    all.guilds[guildId] = config;

    return writeJSON(CONFIG_FILE, all);
}

// =====================================================
// ZEIT / NACHTSPERRE
// =====================================================

function getBerlinHour() {
    return Number(
        new Intl.DateTimeFormat("en-GB", {
            timeZone: TIMEZONE,
            hour: "numeric",
            hourCycle: "h23"
        }).format(new Date())
    );
}

function isNightLock(config) {
    return (
        config.nightLock !== false &&
        getBerlinHour() < 8
    );
}

// =====================================================
// ROLLEN / BERECHTIGUNGEN
// =====================================================

function getTicketType(typeId) {
    return TICKET_TYPES.find(
        type => type.id === typeId
    );
}

function uniqueIds(ids) {
    return [...new Set(ids.filter(Boolean))];
}

function getTicketRoleIds(guild, typeId) {
    const type = getTicketType(typeId);

    if (!type) return [];

    return uniqueIds(type.roleIds).filter(roleId => {
        return guild.roles.cache.has(roleId);
    });
}

function getGlobalRoleIds(guild) {
    return uniqueIds(GLOBAL_ACCESS_ROLES).filter(
        roleId => guild.roles.cache.has(roleId)
    );
}

function isGlobalStaff(member) {
    if (!member) return false;

    // Tatsächlicher Discord-Serverbesitzer
    if (
        member.id === member.guild.ownerId
    ) {
        return true;
    }

    // Explizit eingetragener Bot-Owner
    if (
        BOT_OWNER_USER_IDS.includes(member.id)
    ) {
        return true;
    }

    // Globale Ausnahmerollen
    return GLOBAL_ACCESS_ROLES.some(roleId => {
        return member.roles.cache.has(roleId);
    });
}

function isStaff(member, typeId) {
    if (!member) return false;

    if (isGlobalStaff(member)) {
        return true;
    }

    const type = getTicketType(typeId);

    if (!type) return false;

    // Ausschließlich die für diesen Ticket-Typ
    // zuständigen Rollen dürfen übernehmen/schließen.
    return type.roleIds.some(roleId => {
        return member.roles.cache.has(roleId);
    });
}

function getDisplayName(member) {
    return (
        member.displayName ||
        member.user?.globalName ||
        member.user?.username ||
        "Unbekannt"
    );
}

// =====================================================
// PANEL
// =====================================================

function buildPanel(guild, config) {
    const name = config.name || SERVER_NAME;

    const categories = TICKET_TYPES.map(type => {
        return `${type.emoji} **${type.label}**`;
    }).join("\n");

    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`🎫 ${name} • Ticketsystem`)
        .setDescription(
            [
                "━━━━━━━━━━━━━━━━━━━━━━━━",
                "",
                "## Willkommen beim Support!",
                "",
                "Du benötigst Hilfe oder hast ein Anliegen?",
                "Unser Team hilft dir gerne weiter.",
                "",
                "**📂 Ticket-Kategorien:**",
                "",
                categories,
                "",
                "━━━━━━━━━━━━━━━━━━━━━━━━",
                "",
                "**🎟️ So funktioniert es:**",
                "",
                "1. Klicke auf **Ticket erstellen**.",
                "2. Wähle die passende Kategorie.",
                "3. Beschreibe dein Anliegen.",
                "4. Das zuständige Team wird benachrichtigt.",
                "",
                "━━━━━━━━━━━━━━━━━━━━━━━━",
                "",
                config.nightLock !== false
                    ? "🌙 Nachtsperre: 00:00–08:00 Uhr"
                    : "🌙 Nachtsperre: Deaktiviert",
                "",
                "🔒 Private Support-Tickets",
                "🔔 Automatische Team-Benachrichtigung",
                "",
                "━━━━━━━━━━━━━━━━━━━━━━━━"
            ].join("\n")
        )
        .setFooter({
            text: `${name} • Support`
        })
        .setTimestamp();

    const button = new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("Ticket erstellen")
        .setEmoji("🎟️")
        .setStyle(ButtonStyle.Primary);

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder()
                .addComponents(button)
        ]
    };
}

// =====================================================
// KATEGORIE-AUSWAHL
// =====================================================

function buildTicketSelect() {
    const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle("🎫 Ticket-Kategorie auswählen")
        .setDescription(
            "Bitte wähle die passende Kategorie für dein Anliegen."
        );

    const select = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("📂 Ticket-Kategorie wählen ...")
        .addOptions(
            TICKET_TYPES.map(type => ({
                label: type.label,
                value: type.id,
                description: type.description,
                emoji: type.emoji
            }))
        );

    const cancel = new ButtonBuilder()
        .setCustomId("ticket_cancel")
        .setLabel("Abbrechen")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Secondary);

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder()
                .addComponents(select),
            new ActionRowBuilder()
                .addComponents(cancel)
        ],
        flags: 64
    };
}

// =====================================================
// TICKET-BUTTONS
// =====================================================

function ticketButtons(claimed = false) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_claim")
                .setLabel("Übernehmen")
                .setEmoji("🙋")
                .setStyle(ButtonStyle.Success)
                .setDisabled(claimed),

            new ButtonBuilder()
                .setCustomId("ticket_close")
                .setLabel("Schließen")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger)
        );
}

// =====================================================
// FEHLERMELDUNGEN
// =====================================================

function describeFailure(result) {
    switch (result?.reason) {
        case "night":
            return (
                "🌙 Zwischen 00:00 und 08:00 Uhr " +
                "können keine Tickets erstellt werden."
            );

        case "exists":
            return (
                "📌 Du hast bereits ein offenes Ticket: " +
                `<#${result.channelId}>`
            );

        case "nosetup":
            return (
                "⚠️ Die zuständige Discord-Kategorie " +
                "konnte nicht gefunden werden."
            );

        case "permission":
            return (
                "❌ Der Bot hat nicht genügend " +
                "Berechtigungen."
            );

        default:
            return "❌ Das Ticket konnte nicht erstellt werden.";
    }
}

// =====================================================
// OFFENES TICKET SUCHEN
// =====================================================

async function findOpenTicket(guild, userId) {
    const data = loadData();

    for (
        const [channelId, ticket]
        of Object.entries(data.tickets)
    ) {
        if (
            ticket.guildId !== guild.id ||
            ticket.userId !== userId
        ) {
            continue;
        }

        const channel = await guild.channels
            .fetch(channelId)
            .catch(() => null);

        if (channel) {
            return channelId;
        }

        delete data.tickets[channelId];
        saveData(data);
    }

    return null;
}

// =====================================================
// LOGS
// =====================================================

async function sendLog(
    guild,
    config,
    embed,
    files = []
) {
    if (!config.logChannelId) {
        return;
    }

    try {
        const channel = await guild.channels
            .fetch(config.logChannelId)
            .catch(() => null);

        if (!channel?.isTextBased()) {
            return;
        }

        await channel.send({
            embeds: [embed],
            files,
            allowedMentions: {
                parse: []
            }
        });
    } catch (error) {
        console.error("[TICKET] Log-Fehler:", error);
    }
}

// =====================================================
// TICKET ERSTELLEN
// =====================================================

async function createTicket(
    guild,
    member,
    typeId,
    options = {}
) {
    try {
        const type = getTicketType(typeId);

        if (!type) {
            return {
                ok: false,
                reason: "error"
            };
        }

        const config = getGuildConfig(guild.id);

        // Nachtsperre
        if (isNightLock(config)) {
            return {
                ok: false,
                reason: "night"
            };
        }

        // Maximal ein offenes Ticket pro Nutzer
        const existing = await findOpenTicket(
            guild,
            member.id
        );

        if (existing) {
            return {
                ok: false,
                reason: "exists",
                channelId: existing
            };
        }

        // Passende Discord-Kategorie
        const parent = await guild.channels
            .fetch(type.categoryId)
            .catch(() => null);

        if (
            !parent ||
            parent.type !== ChannelType.GuildCategory
        ) {
            console.error(
                `[TICKET] Kategorie fehlt: ${type.categoryId}`
            );

            return {
                ok: false,
                reason: "nosetup"
            };
        }

        // Zuständige Teamrollen
        const ticketRoles = getTicketRoleIds(
            guild,
            type.id
        );

        // Globale Ausnahmerollen erhalten Zugriff,
        // werden aber NICHT automatisch gepingt.
        const globalRoles = getGlobalRoleIds(guild);

        const allAccessRoles = uniqueIds([
            ...ticketRoles,
            ...globalRoles
        ]);

        // Private Kanalberechtigungen
        const overwrites = [
            {
                id: guild.id,
                deny: [
                    PermissionFlagsBits.ViewChannel
                ]
            },
            {
                id: member.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles
                ]
            },
            {
                id: guild.client.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.AttachFiles
                ]
            }
        ];

        for (const roleId of allAccessRoles) {
            overwrites.push({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles
                ]
            });
        }

        // Bot-Owner erhält auch ohne Rolle Zugriff.
        for (const userId of BOT_OWNER_USER_IDS) {
            if (
                !userId ||
                userId === member.id ||
                userId === guild.client.user.id
            ) {
                continue;
            }

            overwrites.push({
                id: userId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles
                ]
            });
        }

        const cleanName = member.user.username
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "")
            .slice(0, 25) || member.id;

        // Ticket-Kanal erstellen
        const channel = await guild.channels.create({
            name: `${type.id}-${cleanName}`,
            type: ChannelType.GuildText,
            parent: parent.id,
            topic:
                `Ticket von ${member.user.username} | ${type.label}`,
            permissionOverwrites: overwrites
        });

        // Ticket speichern
        const data = loadData();

        data.tickets[channel.id] = {
            guildId: guild.id,
            userId: member.id,
            type: type.id,
            categoryId: parent.id,
            createdAt: Date.now(),
            claimedBy: null,
            lastReminder: null,
            source: options.source || "panel"
        };

        if (!saveData(data)) {
            await channel.delete().catch(() => {});

            return {
                ok: false,
                reason: "error"
            };
        }

        const creatorName = getDisplayName(member);

        // Start-Embed OHNE Nutzer-Ping
        const embed = new EmbedBuilder()
            .setColor(COLOR)
            .setTitle(
                `${type.emoji} ${type.label}`
            )
            .setDescription(
                [
                    `Hallo **${creatorName}**!`,
                    "",
                    "Willkommen in deinem Support-Ticket.",
                    "",
                    "📝 Bitte beschreibe dein Anliegen",
                    "so genau wie möglich.",
                    "",
                    "🔔 Das zuständige Team wurde",
                    "automatisch benachrichtigt.",
                    "",
                    "⏳ Ein Teammitglied wird sich",
                    "bald bei dir melden.",
                    "",
                    "━━━━━━━━━━━━━━━━━━━━━━━━"
                ].join("\n")
            )
            .addFields(
                {
                    name: "👤 Ersteller",
                    value: creatorName,
                    inline: true
                },
                {
                    name: "📂 Kategorie",
                    value: type.label,
                    inline: true
                },
                {
                    name: "📌 Status",
                    value: "🟡 Offen",
                    inline: true
                }
            )
            .setFooter({
                text: `${SERVER_NAME} • Support`
            })
            .setTimestamp();

        if (options.question) {
            embed.addFields({
                name: "❓ Ursprüngliche Frage",
                value: String(
                    options.question
                ).slice(0, 1000)
            });
        }

        // NUR ZUSTÄNDIGE TEAMROLLEN PINGEN
        // KEIN PING AN DEN TICKET-ERSTELLER
        const roleMentions = ticketRoles
            .map(roleId => `<@&${roleId}>`)
            .join(" ");

        await channel.send({
            content:
                roleMentions ||
                "🎫 Neues Support-Ticket erstellt.",
            embeds: [embed],
            components: [
                ticketButtons(false)
            ],
            allowedMentions: {
                parse: [],
                roles: ticketRoles,
                users: []
            }
        });

        // Log
        await sendLog(
            guild,
            config,
            new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🎫 Ticket erstellt")
                .addFields(
                    {
                        name: "Ersteller",
                        value: creatorName,
                        inline: true
                    },
                    {
                        name: "Kategorie",
                        value: type.label,
                        inline: true
                    },
                    {
                        name: "Kanal",
                        value: `<#${channel.id}>`,
                        inline: true
                    }
                )
                .setTimestamp()
        );

        return {
            ok: true,
            channel
        };

    } catch (error) {
        console.error(
            "[TICKET] Erstellen fehlgeschlagen:",
            error
        );

        return {
            ok: false,
            reason: "error"
        };
    }
}

// =====================================================
// TRANSCRIPT
// =====================================================

async function buildTranscript(channel) {
    const messages = [];
    let before;

    // Bis zu 1000 Nachrichten
    for (let i = 0; i < 10; i++) {
        const batch = await channel.messages.fetch({
            limit: 100,
            before
        });

        if (!batch.size) {
            break;
        }

        messages.push(
            ...batch.values()
        );

        before = batch.last().id;

        if (batch.size < 100) {
            break;
        }
    }

    messages.sort(
        (a, b) =>
            a.createdTimestamp -
            b.createdTimestamp
    );

    return messages.map(message => {
        const time = new Date(
            message.createdTimestamp
        ).toLocaleString("de-DE", {
            timeZone: TIMEZONE
        });

        const attachments = [
            ...message.attachments.values()
        ].map(file => file.url).join(", ");

        return (
            `[${time}] ` +
            `${message.author.username}: ` +
            `${message.content || "[Embed/Datei]"} ` +
            `${attachments}`
        );
    }).join("\n");
}

// =====================================================
// INTERAKTIONEN
// =====================================================

async function handleTicketInteraction(interaction) {
    if (!interaction.guild) {
        return;
    }

    const id = interaction.customId;

    if (!id?.startsWith("ticket_")) {
        return;
    }

    try {
        const config = getGuildConfig(
            interaction.guild.id
        );

        // ---------------------------------------------
        // TICKET ERSTELLEN
        // ---------------------------------------------

        if (
            interaction.isButton() &&
            id === "ticket_open"
        ) {
            if (isNightLock(config)) {
                return interaction.reply({
                    content: describeFailure({
                        reason: "night"
                    }),
                    flags: 64
                });
            }

            const existing = await findOpenTicket(
                interaction.guild,
                interaction.user.id
            );

            if (existing) {
                return interaction.reply({
                    content: describeFailure({
                        reason: "exists",
                        channelId: existing
                    }),
                    flags: 64
                });
            }

            return interaction.reply(
                buildTicketSelect()
            );
        }

        // ---------------------------------------------
        // ABBRECHEN
        // ---------------------------------------------

        if (
            interaction.isButton() &&
            id === "ticket_cancel"
        ) {
            return interaction.update({
                content: "❌ Abgebrochen.",
                embeds: [],
                components: []
            });
        }

        // ---------------------------------------------
        // TICKET-KATEGORIE
        // ---------------------------------------------

        if (
            interaction.isStringSelectMenu() &&
            id === "ticket_select"
        ) {
            await interaction.deferUpdate();

            const member = await interaction.guild.members
                .fetch(interaction.user.id);

            const result = await createTicket(
                interaction.guild,
                member,
                interaction.values[0]
            );

            return interaction.editReply({
                content: result.ok
                    ? (
                        "✅ Dein Ticket wurde erstellt: " +
                        `<#${result.channel.id}>`
                    )
                    : describeFailure(result),
                embeds: [],
                components: []
            });
        }

        // ---------------------------------------------
        // TICKET ÜBERNEHMEN
        // ---------------------------------------------

        if (
            interaction.isButton() &&
            id === "ticket_claim"
        ) {
            const data = loadData();

            const ticket = data.tickets[
                interaction.channelId
            ];

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Kein aktives Ticket.",
                    flags: 64
                });
            }

            // Aktuelle Rollen des Nutzers laden
            const member = await interaction.guild.members
                .fetch(interaction.user.id);

            if (!isStaff(member, ticket.type)) {
                return interaction.reply({
                    content:
                        "🔒 **Keine Berechtigung!**\n\n" +
                        "Nur die für dieses Ticket " +
                        "zuständigen Teamrollen dürfen " +
                        "es übernehmen.",
                    flags: 64
                });
            }

            if (ticket.claimedBy) {
                return interaction.reply({
                    content:
                        "⚠️ Dieses Ticket wurde bereits " +
                        "von einem Teammitglied übernommen.",
                    flags: 64
                });
            }

            ticket.claimedBy = interaction.user.id;

            if (!saveData(data)) {
                return interaction.reply({
                    content: "❌ Speichern fehlgeschlagen.",
                    flags: 64
                });
            }

            await interaction.update({
                components: [
                    ticketButtons(true)
                ]
            });

            const staffName = getDisplayName(member);

            // SCHÖNE ÜBERNAHME-NACHRICHT
            const claimEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle("🙋 Ticket übernommen!")
                .setDescription(
                    [
                        "━━━━━━━━━━━━━━━━━━━━━━━━",
                        "",
                        `**${staffName}** hat dieses Ticket übernommen!`,
                        "",
                        "🛠️ Dieses Teammitglied kümmert sich",
                        "ab sofort um dein Anliegen.",
                        "",
                        "💬 Bitte bleibe im Ticket und",
                        "beantworte mögliche Rückfragen.",
                        "",
                        "🤝 Vielen Dank für deine Geduld!",
                        "",
                        "━━━━━━━━━━━━━━━━━━━━━━━━"
                    ].join("\n")
                )
                .addFields(
                    {
                        name: "👤 Zuständiges Teammitglied",
                        value: staffName,
                        inline: true
                    },
                    {
                        name: "📌 Ticket-Status",
                        value: "🟢 In Bearbeitung",
                        inline: true
                    }
                )
                .setFooter({
                    text: `${SERVER_NAME} • Support-Team`
                })
                .setTimestamp();

            return interaction.channel.send({
                embeds: [claimEmbed],
                allowedMentions: {
                    parse: []
                }
            });
        }

        // ---------------------------------------------
        // TICKET SCHLIESSEN
        // ---------------------------------------------

        if (
            interaction.isButton() &&
            id === "ticket_close"
        ) {
            const data = loadData();

            const ticket = data.tickets[
                interaction.channelId
            ];

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Kein aktives Ticket.",
                    flags: 64
                });
            }

            const member = await interaction.guild.members
                .fetch(interaction.user.id);

            // Auch der Ticket-Ersteller darf NICHT
            // schließen, außer er ist berechtigtes Team.
            if (!isStaff(member, ticket.type)) {
                return interaction.reply({
                    content:
                        "🔒 **Keine Berechtigung!**\n\n" +
                        "Nur zuständige Teammitglieder " +
                        "oder die Serverleitung dürfen " +
                        "dieses Ticket schließen.",
                    flags: 64
                });
            }

            await interaction.reply({
                content:
                    "🔒 Das Ticket wird geschlossen ..."
            });

            const closerName = getDisplayName(member);

            const closeEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle("🔒 Ticket geschlossen")
                .setDescription(
                    [
                        "━━━━━━━━━━━━━━━━━━━━━━━━",
                        "",
                        `**${closerName}** hat dieses Ticket geschlossen.`,
                        "",
                        "Vielen Dank, dass du unseren",
                        "Support genutzt hast!",
                        "",
                        "🗑️ Der Kanal wird in 5 Sekunden gelöscht.",
                        "",
                        "━━━━━━━━━━━━━━━━━━━━━━━━"
                    ].join("\n")
                )
                .setFooter({
                    text: SERVER_NAME
                })
                .setTimestamp();

            await interaction.channel.send({
                embeds: [closeEmbed],
                allowedMentions: {
                    parse: []
                }
            }).catch(() => {});

            // Transcript
            if (config.logChannelId) {
                try {
                    const transcript = await buildTranscript(
                        interaction.channel
                    );

                    const attachment = new AttachmentBuilder(
                        Buffer.from(
                            transcript || "Keine Nachrichten",
                            "utf8"
                        ),
                        {
                            name:
                                `transcript-${interaction.channelId}.txt`
                        }
                    );

                    await sendLog(
                        interaction.guild,
                        config,
                        new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle("🔒 Ticket geschlossen")
                            .addFields(
                                {
                                    name: "Ersteller-ID",
                                    value: ticket.userId,
                                    inline: true
                                },
                                {
                                    name: "Geschlossen von",
                                    value: closerName,
                                    inline: true
                                },
                                {
                                    name: "Ticket-Art",
                                    value: getTicketType(
                                        ticket.type
                                    )?.label || ticket.type,
                                    inline: true
                                }
                            )
                            .setTimestamp(),
                        [attachment]
                    );
                } catch (error) {
                    console.error(
                        "[TICKET] Transcript-Fehler:",
                        error
                    );
                }
            }

            delete data.tickets[
                interaction.channelId
            ];

            saveData(data);

            setTimeout(() => {
                interaction.channel.delete(
                    "Ticket geschlossen"
                ).catch(console.error);
            }, 5000);

            return;
        }

    } catch (error) {
        console.error(
            "[TICKET] Interaktionsfehler:",
            error
        );

        const payload = {
            content: "❌ Ein Fehler ist aufgetreten.",
            flags: 64
        };

        if (
            interaction.deferred ||
            interaction.replied
        ) {
            await interaction.followUp(
                payload
            ).catch(() => {});
        } else {
            await interaction.reply(
                payload
            ).catch(() => {});
        }
    }
}

// =====================================================
// /ticketsystem
// =====================================================

async function handleTicketSlashCommand(interaction) {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (
        interaction.commandName !== "ticketsystem"
    ) {
        return;
    }

    if (
        !interaction.guild ||
        !interaction.channel?.isTextBased()
    ) {
        return interaction.reply({
            content:
                "❌ Nur in Server-Textkanälen möglich.",
            flags: 64
        });
    }

    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        return interaction.reply({
            content:
                "🔒 Du benötigst Server verwalten.",
            flags: 64
        });
    }

    try {
        await interaction.deferReply({
            flags: 64
        });

        const config = getGuildConfig(
            interaction.guild.id
        );

        await interaction.channel.send(
            buildPanel(
                interaction.guild,
                config
            )
        );

        await interaction.editReply({
            content:
                "✅ Ticket-Panel erfolgreich erstellt!"
        });

    } catch (error) {
        console.error(
            "[TICKET] Slash-Fehler:",
            error
        );

        if (
            interaction.deferred ||
            interaction.replied
        ) {
            await interaction.editReply({
                content:
                    "❌ Panel konnte nicht erstellt werden."
            }).catch(() => {});
        } else {
            await interaction.reply({
                content:
                    "❌ Panel konnte nicht erstellt werden.",
                flags: 64
            }).catch(() => {});
        }
    }
}

// =====================================================
// !ticketsetup
// =====================================================

async function handleSetupCommand(message) {
    if (
        !message.guild ||
        message.author.bot ||
        !message.content.startsWith(
            "!ticketsetup"
        )
    ) {
        return;
    }

    if (
        !message.member?.permissions.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        return message.reply(
            "🔒 Du benötigst Server verwalten."
        );
    }

    const args = message.content
        .trim()
        .split(/\s+/)
        .slice(1);

    const sub = args[0]?.toLowerCase();

    const config = getGuildConfig(
        message.guild.id
    );

    // PANEL
    if (sub === "panel") {
        await message.channel.send(
            buildPanel(
                message.guild,
                config
            )
        );

        return message.reply(
            "✅ Ticket-Panel erstellt."
        );
    }

    // LOG-KANAL
    if (sub === "log") {
        const channel =
            message.mentions.channels.first() ||
            message.guild.channels.cache.get(
                args[1]
            );

        if (!channel?.isTextBased()) {
            return message.reply(
                "❌ Bitte einen Textkanal angeben."
            );
        }

        config.logChannelId = channel.id;

        saveGuildConfig(
            message.guild.id,
            config
        );

        return message.reply(
            `✅ Log-Kanal: <#${channel.id}>`
        );
    }

    // NACHTSPERRE
    if (sub === "nachtsperre") {
        if (
            !["an", "aus"].includes(
                args[1]
            )
        ) {
            return message.reply(
                "❌ !ticketsetup nachtsperre an/aus"
            );
        }

        config.nightLock = args[1] === "an";

        saveGuildConfig(
            message.guild.id,
            config
        );

        return message.reply(
            `✅ Nachtsperre ${args[1]}.`
        );
    }

    // NAME
    if (sub === "name") {
        config.name =
            args.slice(1).join(" ") ||
            SERVER_NAME;

        saveGuildConfig(
            message.guild.id,
            config
        );

        return message.reply(
            "✅ Panelname gespeichert."
        );
    }

    // STATUS
    if (sub === "status") {
        return message.reply({
            content: [
                "**🎫 Vexo RP Ticketsystem**",
                "",
                "📂 Kategorien: Fest eingestellt",
                "👥 Rollen-Pings: Aktiv",
                "🔒 Rechteprüfung: Aktiv",
                `📋 Log: ${config.logChannelId || "Nicht gesetzt"}`,
                `🌙 Nachtsperre: ${config.nightLock ? "An" : "Aus"}`,
                "",
                "Alle 13 Ticket-Arten sind eingerichtet."
            ].join("\n")
        });
    }

    // HILFE
    return message.reply({
        content: [
            "**🎫 Ticket-System Befehle**",
            "",
            "`!ticketsetup panel`",
            "`!ticketsetup log #kanal`",
            "`!ticketsetup nachtsperre an`",
            "`!ticketsetup nachtsperre aus`",
            "`!ticketsetup name TEXT`",
            "`!ticketsetup status`",
            "",
            "📂 Kategorien und Rollen sind",
            "bereits fest im Code eingetragen."
        ].join("\n")
    });
}

// =====================================================
// ERINNERUNGEN
// =====================================================

async function runReminders(client) {
    const hour = getBerlinHour();

    if (
        hour < 12 ||
        hour >= 22
    ) {
        return;
    }

    const data = loadData();
    let changed = false;

    for (
        const [channelId, ticket]
        of Object.entries(data.tickets)
    ) {
        if (ticket.claimedBy) {
            continue;
        }

        const last =
            ticket.lastReminder ||
            ticket.createdAt;

        if (
            Date.now() - last <
            REMINDER_INTERVAL
        ) {
            continue;
        }

        const channel = await client.channels
            .fetch(channelId)
            .catch(() => null);

        if (!channel) {
            delete data.tickets[channelId];
            changed = true;
            continue;
        }

        const ticketRoles = getTicketRoleIds(
            channel.guild,
            ticket.type
        );

        try {
            const roleMentions = ticketRoles
                .map(roleId => `<@&${roleId}>`)
                .join(" ");

            await channel.send({
                content: [
                    "⏰ **Ticket-Erinnerung**",
                    "",
                    "Dieses Ticket wartet noch",
                    "auf Bearbeitung.",
                    "",
                    roleMentions
                ].join("\n"),
                allowedMentions: {
                    parse: [],
                    roles: ticketRoles,
                    users: []
                }
            });

            ticket.lastReminder = Date.now();
            changed = true;

        } catch (error) {
            console.error(
                "[TICKET] Erinnerungsfehler:",
                error
            );
        }
    }

    if (changed) {
        saveData(data);
    }
}

// =====================================================
// INITIALISIERUNG
// =====================================================

let initialized = false;

function initializeTicketSystem(client) {
    if (initialized) {
        return;
    }

    if (!client) {
        throw new Error(
            "Kein Discord-Client übergeben."
        );
    }

    client.on(
        "interactionCreate",
        handleTicketInteraction
    );

    client.on(
        "interactionCreate",
        handleTicketSlashCommand
    );

    client.on(
        "messageCreate",
        handleSetupCommand
    );

    setInterval(() => {
        if (!client.isReady()) {
            return;
        }

        runReminders(client).catch(
            console.error
        );
    }, REMINDER_CHECK_INTERVAL);

    initialized = true;

    console.log(
        "🎫 Vexo RP Ticketsystem aktiviert."
    );
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    initializeTicketSystem,
    createTicket,
    describeFailure,
    TICKET_TYPES,
    DISCORD_CATEGORIES,
    ROLES,
    ROLE_GROUPS
};
