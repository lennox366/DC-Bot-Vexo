
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
    AttachmentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
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


const REMINDER_INTERVAL = 5 * 60 * 60 * 1000;
const TICKET_MAX_AGE = 48 * 60 * 60 * 1000;
const REMINDER_CHECK_INTERVAL = 5 * 60 * 1000;
const FEEDBACK_FILE = path.join(__dirname, "Ticket-Feedback.json");

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
        id: "fragen",
        label: "Fragen",
        emoji: "❓",
        description: "Allgemeine Fragen",
        categoryId: DISCORD_CATEGORIES.allgemeinerSupport,
        roleIds: [
            "1559659267269595149", // Supporter
            "1559659267269595154", // Moderator
            "1559659267299217462", // Administrator
            "1559659267299217467", // Eventleitung
            "1559659267307339839"  // Fraktionsverwaltung
        ]
    },
    {
        id: "entbannung",
        label: "Entbannung",
        emoji: "🔓",
        description: "Antrag auf Entbannung",
        categoryId: DISCORD_CATEGORIES.entbannungsantrag,
        roleIds: [
            "1559659267269595154", // Moderator
            "1559659267299217462", // Administrator
            "1559659267299217467", // Eventleitung
            "1559659267307339839", // Fraktionsverwaltung
            "1559659267307339843"  // Low-Ausbilder
        ]
    },
    {
        id: "anliegen",
        label: "Anliegen",
        emoji: "📝",
        description: "Allgemeine Anliegen",
        categoryId: DISCORD_CATEGORIES.allgemeinerSupport,
        roleIds: [
            "1559659267324256372", // High Team
            "1559659267324256366", // Teamleitung
            "1559659267324256373", // Supervisor
            "1559659267349553265"  // Management
        ]
    },
    {
        id: "partner",
        label: "Partner Ticket",
        emoji: "🤝",
        description: "Partnerschaftsanfragen",
        categoryId: DISCORD_CATEGORIES.leitungsFragen,
        roleIds: [
            "1559659267349553265", // Management
            "1559659267324256372"  // High Team
        ]
    },
    {
        id: "fraktion",
        label: "Fraktion",
        emoji: "🏢",
        description: "Fraktionsanliegen",
        categoryId: DISCORD_CATEGORIES.fraktionenWaffenscheine,
        roleIds: [
            "1559659267307339839"  // Fraktionsverwaltung
        ]
    },
    {
        id: "immobilien",
        label: "Immobilien-Ticket",
        emoji: "🏠",
        description: "Immobilien, Häuser und Grundstücke",
        categoryId: DISCORD_CATEGORIES.fraktionenWaffenscheine,
        roleIds: ["1559659267307339839"]
    },
    {
        id: "waffenschein",
        label: "Waffenschein",
        emoji: "📋",
        description: "Waffenschein beantragen",
        categoryId: DISCORD_CATEGORIES.fraktionenWaffenscheine,
        roleIds: [
            "1559659267307339839"  // Fraktionsverwaltung
        ]
    },
    {
        id: "contentcreator",
        label: "Content Creator",
        emoji: "🎨",
        description: "Content-Creator-Anfragen",
        categoryId: DISCORD_CATEGORIES.allgemeinerSupport,
        roleIds: [
            "1559659267349553271", // Leitung
            "1559659267349553272", // Direktor
            "1559659267378778217", // High-Ausbilder
            "1559659267378778221"  // Projektleitung
        ]
    },
    {
        id: "serverwechsel",
        label: "Server Wechsel",
        emoji: "🔄",
        description: "Anfrage zum Serverwechsel",
        categoryId: DISCORD_CATEGORIES.leitungsFragen,
        roleIds: [
            "1559659267378778221", // Projektleitung
            "1559659267408134198", // Owner/Co.Owner
            "1561728076231086243"  // Founder/in
        ]
    },
    {
        id: "beschwerde",
        label: "Generelle Beschwerden",
        emoji: "⚠️",
        description: "Allgemeine Beschwerden",
        categoryId: DISCORD_CATEGORIES.allgemeinerSupport,
        roleIds: [
            "1559659267324256372", // High Team
            "1559659267324256366", // Teamleitung
            "1559659267324256373", // Supervisor
            "1559659267349553265", // Management
            "1559659267349553271", // Leitung
            "1559659267349553272", // Direktor
            "1559659267378778217"  // High-Ausbilder
        ]
    },
    {
        id: "teambeschwerde",
        label: "Team Beschwerde",
        emoji: "📢",
        description: "Beschwerde über Teammitglieder",
        categoryId: DISCORD_CATEGORIES.teambeschwerden,
        roleIds: [
            "1559659267324256372", // High Team
            "1559659267349553265", // Management
            "1559659267349553272"  // Direktor
        ]
    },
    {
        id: "coowner",
        label: "Co-Owner / Owner",
        emoji: "🏛️",
        description: "Kontakt zur Serverleitung",
        categoryId: DISCORD_CATEGORIES.leitungsFragen,
        roleIds: [
            "1559659267408134198"  // Owner/Co.Owner
        ]
    },
    {
        id: "intern",
        label: "Intern",
        emoji: "🔒",
        description: "Interne Angelegenheiten",
        categoryId: DISCORD_CATEGORIES.highteamFragen,
        roleIds: [
            "1559659267378778221", // Projektleitung
            "1559659267408134198", // Owner/Co.Owner
            "1561728076231086243"  // Founder/in
        ]
    },
    {
        id: "highteam",
        label: "High Team",
        emoji: "👑",
        description: "Kontakt zum High Team",
        categoryId: DISCORD_CATEGORIES.highteamFragen,
        roleIds: [
            "1559659267324256372"  // High Team
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
        feedbackChannelId: "1559659271329808415",
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
// 💫 VEXO RP | V1 - PREMIUM SUPPORT PANEL
// =====================================================

function buildPanel(guild, config) {
    const name = config.name || SERVER_NAME;

    const embed = new EmbedBuilder()
        .setColor(0x8052FF)
        .setAuthor({
            name: "✦ VEXO RP  |  OFFICIAL SUPPORT"
        })
        .setTitle("💫 VEXO SUPPORT HUB")
        .setDescription([
            "### ✦ DEINE COMMUNITY. UNSER SUPPORT.",
            "",
            "Willkommen im offiziellen Support-Center",
            "von **Vexo RP | V1**.",
            "",
            "Du hast eine Frage, benötigst Hilfe oder",
            "möchtest ein vertrauliches Anliegen klären?",
            "",
            "Wir verbinden dich mit dem Team,",
            "das für dein Anliegen zuständig ist.",
            "",
            "╭・────────────────────・╮",
            "　　**UNSERE SUPPORT-BEREICHE**",
            "╰・────────────────────・╯",
            "### 🎟️ DEIN NÄCHSTER SCHRITT",
            "",
            "Klicke auf **Support anfragen** und",
            "wähle deine gewünschte Ticket-Art.",
            "",
            "Dein Ticket wird privat erstellt.",
            "Die zuständigen Teamrollen erhalten",
            "automatisch eine Benachrichtigung.",
            "",
            config.nightLock !== false
                ? "🌙 **Ticketzeiten:** 08:00 – 00:00 Uhr"
                : "🟢 **Ticket-Erstellung:** Rund um die Uhr",
            "",
            "🔐 **Vertraulich & rollenbasiert**"
        ].join("\n"))
        .setFooter({
            text: `${name}  ✦  SUPPORT EXPERIENCE`
        })
        .setTimestamp();

    const button = new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("Support anfragen")
        .setEmoji("💌")
        .setStyle(ButtonStyle.Primary);

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(button)
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
                .setCustomId("ticket_release")
                .setLabel("Freigeben")
                .setEmoji("🔓")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!claimed),

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
// TICKET ABSCHLIESSEN, DM + FEEDBACK + TRANSCRIPT
// =====================================================

const closingTickets = new Set();

async function closeTicketWithFeedback(channel, ticket, reason, closedBy) {
    if (!channel || closingTickets.has(channel.id)) return false;
    closingTickets.add(channel.id);
    try {
        const config = getGuildConfig(channel.guild.id);
        const typeName = getTicketType(ticket.type)?.label || ticket.type;
        const user = await channel.client.users.fetch(ticket.userId).catch(() => null);

        // Die DM enthält fünf Stern-Buttons; die Bewertung erfolgt per Modal.
        const feedbackState = readJSON(FEEDBACK_FILE, { entries: {}, owners: {}, tickets: {} });
        feedbackState.entries ||= {};
        feedbackState.owners ||= {};
        feedbackState.tickets ||= {};
        feedbackState.owners[channel.id] = ticket.userId;
        feedbackState.tickets[channel.id] = {
            guildId: channel.guild.id,
            type: typeName,
            claimedBy: ticket.claimedBy || null,
            closedBy: String(closedBy),
            closedAt: Date.now()
        };
        if (!writeJSON(FEEDBACK_FILE, feedbackState)) {
            console.error("[TICKET] Feedback-Daten konnten nicht gespeichert werden.");
        }
        if (user) {
            const feedbackRow = new ActionRowBuilder().addComponents(
                ...[1, 2, 3, 4, 5].map(stars =>
                    new ButtonBuilder()
                        .setCustomId(`ticket_feedback_star_${stars}_${channel.id}`)
                        .setLabel("⭐".repeat(stars))
                        .setStyle(ButtonStyle.Primary)
                )
            );
            await user.send({
                embeds: [new EmbedBuilder()
                    .setColor(0x0893F3)
                    .setAuthor({ name: "💫 VEXO RP | V1 • SUPPORT" })
                    .setTitle("💙 DEINE MEINUNG ZÄHLT!")
                    .setDescription([
                        "━━━━━━━━━━━━━━━━━━━━",
                        "",
                        "🔒 **Dein Support-Ticket wurde geschlossen.**",
                        "",
                        "Vielen Dank, dass du den Support von **Vexo RP | V1** genutzt hast!",
                        "",
                        "⭐ **Wie zufrieden warst du mit unserem Support?**",
                        "",
                        "Wähle unten **1 bis 5 Sterne** aus. Anschließend kannst du uns in einem kurzen Formular sagen, warum du so bewertet hast.",
                        "",
                        "🔐 Dein Feedback wird an unsere Serververwaltung weitergeleitet.",
                        "",
                        "━━━━━━━━━━━━━━━━━━━━"
                    ].join("\n"))
                    .addFields(
                        { name: "🎫 Ticketart", value: typeName, inline: true },
                        { name: "👨‍💻 Bearbeitet von", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Nicht übernommen", inline: true }
                    )
                    .setFooter({ text: "💫 Vexo RP | V1 • Support Experience" })
                    .setTimestamp()],
                components: [feedbackRow],
                allowedMentions: { parse: [] }
            }).catch(error => console.warn(`[TICKET] DM an ${ticket.userId} nicht möglich:`, error.message));
        }

        const logEmbed = new EmbedBuilder().setColor(0xED4245)
            .setTitle("🔒 Ticket geschlossen")
            .addFields(
                { name: "Ersteller", value: `<@${ticket.userId}>`, inline: true },
                { name: "Ticketart", value: typeName, inline: true },
                { name: "Geschlossen von", value: closedBy, inline: true },
                { name: "Grund", value: reason }
            ).setTimestamp();
        if (config.logChannelId) {
            try {
                const transcript = await buildTranscript(channel);
                const file = new AttachmentBuilder(Buffer.from(transcript || "Keine Nachrichten", "utf8"), {
                    name: `transcript-${channel.id}.txt`
                });
                await sendLog(channel.guild, config, logEmbed, [file]);
            } catch (error) {
                console.error("[TICKET] Transcript fehlgeschlagen:", error);
                await sendLog(channel.guild, config, logEmbed);
            }
        }

        const data = loadData();
        delete data.tickets[channel.id];
        if (!saveData(data)) {
            console.error("[TICKET] Konnte Ticket-Daten nicht speichern:", channel.id);
            return false;
        }
        await channel.send({
            embeds: [new EmbedBuilder().setColor(0xED4245).setTitle("🔒 Ticket geschlossen")
                .setDescription(`${reason}\n\nDer Kanal wird in 5 Sekunden gelöscht.`).setTimestamp()],
            allowedMentions: { parse: [] }
        }).catch(() => {});
        setTimeout(() => channel.delete(reason).catch(error => {
            console.error("[TICKET] Kanal konnte nicht gelöscht werden:", error);
        }), 5000);
        return true;
    } finally {
        closingTickets.delete(channel.id);
    }
}

async function handleTicketFeedback(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;
    const id = interaction.customId || "";
    const buttonMatch = /^ticket_feedback_star_([1-5])_(\d+)$/.exec(id);
    const modalMatch = /^ticket_feedback_modal_([1-5])_(\d+)$/.exec(id);
    if (!buttonMatch && !modalMatch) return;

    const [, ratingString, channelId] = buttonMatch || modalMatch;
    const rating = Number(ratingString);
    const feedback = readJSON(FEEDBACK_FILE, { entries: {}, owners: {}, tickets: {} });
    feedback.entries ||= {};
    feedback.owners ||= {};
    feedback.tickets ||= {};
    const key = `${channelId}:${interaction.user.id}`;

    if (feedback.owners[channelId] !== interaction.user.id) {
        return interaction.reply({ content: "🔒 Du darfst dieses Ticket nicht bewerten.", flags: 64 });
    }
    if (feedback.entries[key]) {
        return interaction.reply({ content: "ℹ️ Du hast dieses Ticket bereits bewertet.", flags: 64 });
    }

    if (buttonMatch) {
        const modal = new ModalBuilder()
            .setCustomId(`ticket_feedback_modal_${rating}_${channelId}`)
            .setTitle("💙 Vexo RP | Bewertung");
        const reason = new TextInputBuilder()
            .setCustomId("ticket_feedback_reason")
            .setLabel("Grund für deine Bewertung")
            .setPlaceholder("Warum gibst du diese Bewertung?")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(1000);
        modal.addComponents(new ActionRowBuilder().addComponents(reason));
        return interaction.showModal(modal);
    }

    await interaction.deferReply({ flags: 64 });
    const reason = interaction.fields.getTextInputValue("ticket_feedback_reason").trim();
    if (reason.length < 2) {
        return interaction.editReply("❌ Bitte gib einen Bewertungsgrund an.");
    }
    // Erneut lesen, damit zwischen Öffnen und Absenden kein Duplikat entsteht.
    const current = readJSON(FEEDBACK_FILE, { entries: {}, owners: {}, tickets: {} });
    current.entries ||= {};
    if (current.entries[key]) {
        return interaction.editReply("ℹ️ Du hast dieses Ticket bereits bewertet.");
    }
    const ticketInfo = current.tickets?.[channelId] || {};
    current.entries[key] = {
        ticketChannelId: channelId,
        guildId: ticketInfo.guildId || null,
        userId: interaction.user.id,
        stars: rating,
        reason,
        claimedBy: ticketInfo.claimedBy || null,
        ratedAt: Date.now()
    };
    if (!writeJSON(FEEDBACK_FILE, current)) {
        return interaction.editReply("❌ Bewertung konnte nicht gespeichert werden.");
    }

    const guild = ticketInfo.guildId
        ? await interaction.client.guilds.fetch(ticketInfo.guildId).catch(() => null)
        : null;
    if (guild) {
        const config = getGuildConfig(guild.id);
        if (config.feedbackChannelId) {
            const logChannel = await guild.channels.fetch(config.feedbackChannelId).catch(() => null);
            if (logChannel?.isTextBased()) {
                const ratingDisplay = "⭐".repeat(rating) + "☆".repeat(5 - rating);
                const embed = new EmbedBuilder()
                    .setColor(0x0893F3)
                    .setTitle("💙 VEXO RP | NEUE SUPPORT-BEWERTUNG")
                    .setDescription("━━━━━━━━━━━━━━━━━━━━")
                    .addFields(
                        { name: "👤 Von", value: `<@${interaction.user.id}>` },
                        { name: "⭐ Bewertung", value: `${ratingDisplay} (**${rating}/5**)` },
                        { name: "🛠️ Staff", value: ticketInfo.claimedBy ? `<@${ticketInfo.claimedBy}>` : "Nicht übernommen" },
                        { name: "📝 Grund", value: reason },
                        { name: "🕒 Wann", value: `<t:${Math.floor(Date.now()/1000)}:f>` }
                    )
                    .setFooter({ text: "Vexo RP Ticketsystem • Bewertungen" })
                    .setTimestamp();
                await logChannel.send({ embeds: [embed], allowedMentions: { parse: [] } })
                    .catch(error => console.error("[TICKET] Bewertungslog fehlgeschlagen:", error));
            }
        }
    }
    await interaction.editReply(`💙 Vielen Dank für dein Feedback! Du hast **${rating}/5 Sterne** vergeben.`);
    // Buttons nach erfolgreicher Bewertung deaktivieren.
    if (interaction.message?.editable) {
        await interaction.message.edit({ components: [] }).catch(() => {});
    }
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

        // Eigenständiges Immobilien-Panel (ohne Auswahlmenü)
        if (interaction.isButton() && id === "ticket_immobilien_open") {
            await interaction.deferReply({ flags: 64 });
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const result = await createTicket(interaction.guild, member, "immobilien", { source: "immobilien-panel" });
            return interaction.editReply({
                content: result.ok ? `✅ Dein Immobilien-Ticket wurde erstellt: <#${result.channel.id}>` : describeFailure(result)
            });
        }

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
        // TICKET FREIGEBEN
        // ---------------------------------------------

        if (interaction.isButton() && id === "ticket_release") {
            const data = loadData();
            const ticket = data.tickets[interaction.channelId];

            if (!ticket) {
                return interaction.reply({
                    content: "❌ Kein aktives Ticket.",
                    flags: 64
                });
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);

            if (!isStaff(member, ticket.type)) {
                return interaction.reply({
                    content: "🔒 Nur zuständige Teammitglieder dürfen dieses Ticket freigeben.",
                    flags: 64
                });
            }

            if (!ticket.claimedBy) {
                return interaction.reply({
                    content: "⚠️ Dieses Ticket wurde noch nicht übernommen.",
                    flags: 64
                });
            }

            if (ticket.claimedBy !== interaction.user.id && !isGlobalStaff(member)) {
                return interaction.reply({
                    content: "🔒 Nur das Teammitglied, das das Ticket übernommen hat, oder die Serverleitung darf es freigeben.",
                    flags: 64
                });
            }

            const staffName = getDisplayName(member);
            ticket.claimedBy = null;
            ticket.lastReminder = Date.now();

            if (!saveData(data)) {
                return interaction.reply({
                    content: "❌ Die Freigabe konnte nicht gespeichert werden.",
                    flags: 64
                });
            }

            await interaction.update({
                components: [ticketButtons(false)]
            });

            const releaseEmbed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle("🔓 Ticket freigegeben!")
                .setDescription([
                    "━━━━━━━━━━━━━━━━━━━━━━━━",
                    "",
                    `**${staffName}** hat dieses Ticket freigegeben.`,
                    "",
                    "📋 Das Ticket ist wieder offen und kann",
                    "von einem anderen zuständigen Teammitglied",
                    "übernommen werden.",
                    "",
                    "🤝 Bitte habe etwas Geduld, bis sich",
                    "jemand Neues um dein Anliegen kümmert.",
                    "",
                    "━━━━━━━━━━━━━━━━━━━━━━━━"
                ].join("\n"))
                .addFields({
                    name: "📌 Ticket-Status",
                    value: "🟡 Offen – wartet auf Übernahme",
                    inline: false
                })
                .setFooter({ text: `${SERVER_NAME} • Support-Team` })
                .setTimestamp();

            return interaction.channel.send({
                embeds: [releaseEmbed],
                allowedMentions: { parse: [] }
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

            await interaction.deferReply({ flags: 64 });
            const closed = await closeTicketWithFeedback(
                interaction.channel, ticket, "Manuell durch das Support-Team geschlossen", getDisplayName(member)
            );
            await interaction.editReply({ content: closed
                ? "✅ Ticket geschlossen. Der Ersteller erhält eine Feedback-DM, sofern DMs erlaubt sind."
                : "❌ Das Ticket konnte nicht geschlossen werden."
            });
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
// 🎫 VEXO RP | /ticketsystem
// Mit Fehlerdiagnose und sicherer Fehlerbehandlung
// =====================================================

async function handleTicketSlashCommand(interaction) {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (interaction.commandName !== "ticketsystem") {
        return;
    }

    // =====================================================
    // 🔍 DIAGNOSE: Prüfen, ob der Befehl erkannt wird
    // =====================================================

    console.log(
        "🎫 [TICKET] /ticketsystem erkannt!",
        "Benutzer:", interaction.user.tag,
        "Server:", interaction.guild?.name
    );

    // =====================================================
    // 🌐 SERVER- UND KANALPRÜFUNG
    // =====================================================

    if (
        !interaction.guild ||
        !interaction.channel?.isTextBased()
    ) {
        return interaction.reply({
            content: "❌ Nur in Server-Textkanälen möglich.",
            flags: 64
        });
    }

    // =====================================================
    // 🔒 BERECHTIGUNGSPRÜFUNG
    // =====================================================

    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {
        return interaction.reply({
            content: "🔒 Du benötigst Server verwalten.",
            flags: 64
        });
    }

    // =====================================================
    // 🎫 TICKET-PANEL ERSTELLEN
    // =====================================================

    try {
        await interaction.deferReply({
            flags: 64
        });

        console.log(
            "🎫 [TICKET] Erstelle Ticket-Panel im Kanal:",
            interaction.channel.name
        );

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
            content: "✅ Ticket-Panel erfolgreich erstellt!"
        });

        console.log(
            "✅ [TICKET] Ticket-Panel erfolgreich gesendet!"
        );

    } catch (error) {
        console.error(
            "❌ [TICKET] Slash-Fehler:",
            error
        );

        if (
            interaction.deferred ||
            interaction.replied
        ) {
            await interaction.editReply({
                content: "❌ Panel konnte nicht erstellt werden."
            }).catch(() => {});
        } else {
            await interaction.reply({
                content: "❌ Panel konnte nicht erstellt werden.",
                flags: 64
            }).catch(() => {});
        }
    }
}


// =====================================================
// /ticketsetup – sämtliche Einstellungen als Slash-Befehle
// =====================================================

async function handleTicketSetupSlashCommand(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "ticketsetup") return;
    if (!interaction.guild || !interaction.channel?.isTextBased()) {
        return interaction.reply({ content: "❌ Nur auf einem Server möglich.", flags: 64 });
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: "🔒 Du benötigst Server verwalten.", flags: 64 });
    }

    const sub = interaction.options.getSubcommand();
    const config = getGuildConfig(interaction.guild.id);

    try {
        await interaction.deferReply({ flags: 64 });

        if (sub === "log" || sub === "bewertungen") {
            const channel = interaction.options.getChannel("kanal", true);
            if (!channel.isTextBased() || channel.isDMBased()) {
                return interaction.editReply("❌ Bitte einen Server-Textkanal auswählen.");
            }
            if (sub === "log") config.logChannelId = channel.id;
            else config.feedbackChannelId = channel.id;
            if (!saveGuildConfig(interaction.guild.id, config)) {
                return interaction.editReply("❌ Speichern fehlgeschlagen.");
            }
            return interaction.editReply(
                sub === "log" ? `✅ Log-Kanal: <#${channel.id}>` : `⭐ Bewertungskanal: <#${channel.id}>`
            );
        }
        if (sub === "nachtsperre") {
            const status = interaction.options.getString("status", true);
            config.nightLock = status === "an";
            if (!saveGuildConfig(interaction.guild.id, config)) {
                return interaction.editReply("❌ Speichern fehlgeschlagen.");
            }
            return interaction.editReply(`🌙 Nachtsperre ${status}.`);
        }
        if (sub === "name") {
            config.name = interaction.options.getString("text", true);
            if (!saveGuildConfig(interaction.guild.id, config)) {
                return interaction.editReply("❌ Speichern fehlgeschlagen.");
            }
            return interaction.editReply("✅ Panelname gespeichert.");
        }
        if (sub === "status") {
            return interaction.editReply([
                "**🎫 Vexo RP Ticketsystem**",
                `📂 Ticketarten: ${TICKET_TYPES.length}`,
                "👥 Rollen-Pings: Aktiv",
                "🔒 Rechteprüfung: Aktiv",
                `📋 Log: ${config.logChannelId ? `<#${config.logChannelId}>` : "Nicht gesetzt"}`,
                `⭐ Bewertungen: ${config.feedbackChannelId ? `<#${config.feedbackChannelId}>` : "Nicht gesetzt"}`,
                `🌙 Nachtsperre: ${config.nightLock ? "An" : "Aus"}`
            ].join("\n"));
        }
        return interaction.editReply("❌ Unbekannter Unterbefehl.");
    } catch (error) {
        console.error("[TICKET] /ticketsetup:", error);
        if (interaction.deferred || interaction.replied) {
            return interaction.editReply("❌ Der Befehl konnte nicht ausgeführt werden.").catch(() => {});
        }
        return interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: 64 }).catch(() => {});
    }
}

// =====================================================
// ERINNERUNGEN
// =====================================================

async function runReminders(client) {
    const data = loadData();
    const now = Date.now();
    let changed = false;

    for (const [channelId, ticket] of Object.entries(data.tickets)) {
        if (closingTickets.has(channelId)) continue;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased() || !channel.guild) {
            delete data.tickets[channelId];
            changed = true;
            continue;
        }

        // Jedes Ticket schließt 48 Stunden nach seiner Erstellung automatisch,
        // unabhängig davon, ob es übernommen wurde.
        if (now - ticket.createdAt >= TICKET_MAX_AGE) {
            const closed = await closeTicketWithFeedback(
                channel, ticket, "Automatisch nach 48 Stunden geschlossen", "Automatisches Ticketsystem"
            );
            if (closed) {
                delete data.tickets[channelId];
                changed = true;
            }
            continue;
        }

        const last = ticket.lastReminder || ticket.createdAt;
        if (now - last < REMINDER_INTERVAL) continue;

        try {
            if (ticket.claimedBy) {
                await channel.send({
                    content: `⏰ **Ticket-Erinnerung (alle 5 Stunden)**\n\n` +
                        `Dieses Ticket ist noch offen.\n` +
                        `🙋 Zuständig: <@${ticket.claimedBy}>\n` +
                        `👤 Ticket-Ersteller: <@${ticket.userId}>\n\n` +
                        `Bitte kümmert euch um die weitere Bearbeitung.`,
                    allowedMentions: { parse: [], users: [ticket.claimedBy, ticket.userId], roles: [] }
                });
            } else {
                const roles = getTicketRoleIds(channel.guild, ticket.type);
                const roleMentions = roles.map(id => `<@&${id}>`).join(" ");
                await channel.send({
                    content: `⏰ **Ticket-Erinnerung (alle 5 Stunden)**\n\n` +
                        `Dieses Ticket wurde noch nicht übernommen.\n` +
                        `👤 Ersteller: <@${ticket.userId}>\n` +
                        `📢 Zuständiges Team: ${roleMentions || "Bitte Ticket prüfen."}`,
                    allowedMentions: { parse: [], users: [ticket.userId], roles }
                });
            }
            ticket.lastReminder = now;
            changed = true;
        } catch (error) {
            console.error("[TICKET] Erinnerungsfehler:", error);
        }
    }
    if (changed) saveData(data);
}

// =====================================================
// 🏠 VEXO RP | /immobilienpanel
// =====================================================

async function handleImmobilienPanelSlashCommand(interaction) {
    if (!interaction.isChatInputCommand() ||
        interaction.commandName !== "immobilienpanel") return;

    console.log("🏠 [IMMOBILIEN] /immobilienpanel erkannt:", interaction.user.tag);

    try {
        if (!interaction.guild ||
            !interaction.channel ||
            interaction.channel.type !== ChannelType.GuildText) {
            return await interaction.reply({
                content: "❌ Nur in Server-Textkanälen möglich.",
                flags: 64
            });
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await interaction.reply({
                content: "🔒 Du benötigst die Berechtigung Server verwalten.",
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        const embed = new EmbedBuilder()
            .setColor(0x0893F3)
            .setTitle("🏠 VEXO RP | IMMOBILIEN-SERVICE")
            .setDescription([
                "**Dein direkter Kontakt zur Immobilienverwaltung**",
                "",
                "🏡 Du hast Fragen zu Immobilien, Häusern oder Grundstücken?",
                "",
                "📋 **So funktioniert es:**",
                "• Klicke unten auf **Immobilien-Ticket erstellen**.",
                "• Es öffnet sich ein privates Ticket.",
                "• Die zuständige Fraktionsverwaltung wird benachrichtigt.",
                "",
                "🔐 Dein Anliegen wird vertraulich behandelt."
            ].join("\n"))
            .setFooter({ text: "💫 Vexo RP | Immobilien-Service" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_immobilien_open")
                .setLabel("Immobilien-Ticket erstellen")
                .setEmoji("🏠")
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.channel.send({
            embeds: [embed],
            components: [row],
            allowedMentions: { parse: [] }
        });

        await interaction.editReply({
            content: "✅ Immobilien-Panel erfolgreich erstellt!"
        });
    } catch (error) {
        console.error("[IMMOBILIEN] Slash-Fehler:", error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: "❌ Immobilien-Panel konnte nicht erstellt werden."
            }).catch(() => {});
        } else {
            await interaction.reply({
                content: "❌ Immobilien-Panel konnte nicht erstellt werden.",
                flags: 64
            }).catch(() => {});
        }
    }
}

// =====================================================
// INITIALISIERUNG
// =====================================================

let initialized = false;

function initializeTicketSystem(client) {
    if (initialized) return;
    if (!client) throw new Error("Kein Discord-Client übergeben.");

    client.on("interactionCreate", handleTicketInteraction);
    client.on("interactionCreate", handleTicketSlashCommand);
    client.on("interactionCreate", handleImmobilienPanelSlashCommand);
    client.on("interactionCreate", handleTicketFeedback);
    client.on("interactionCreate", handleTicketSetupSlashCommand);

    setInterval(() => {
        if (!client.isReady()) return;
        runReminders(client).catch(error => {
            console.error("[TICKET] Erinnerungsfehler:", error);
        });
    }, REMINDER_CHECK_INTERVAL);

    client.once("clientReady", () => {
        runReminders(client).catch(error => console.error("[TICKET] Startprüfung:", error));
    });
    if (client.isReady()) {
        runReminders(client).catch(error => console.error("[TICKET] Startprüfung:", error));
    }
    initialized = true;
    console.log("✅ Vexo RP Ticketsystem initialisiert (/ticketsystem, /immobilienpanel, /ticketsetup).");
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
