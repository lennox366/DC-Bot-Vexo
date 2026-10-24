require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionsBitField
} = require("discord.js");

// =====================================================
// KONFIGURATION
// =====================================================

const GUILD_ID =
    process.env.GUILD_ID;

const CONTROL_ROLE_ID =
    process.env.CONTROL_ROLE_ID;

const MAIN_BOT_DIR =
    process.env.MAIN_BOT_DIR;

const MAIN_BOT_FILE =
    process.env.MAIN_BOT_FILE || "index.js";

const PID_FILE =
    path.join(
        __dirname,
        "main-bot.pid"
    );

// =====================================================
// CLIENT
// =====================================================

const client =
    new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

// =====================================================
// PID SPEICHERN
// =====================================================

function saveMainBotPid(pid) {
    try {
        fs.writeFileSync(
            PID_FILE,
            String(pid),
            "utf8"
        );

    } catch (error) {
        console.error(
            "❌ PID konnte nicht gespeichert werden:",
            error
        );
    }
}

// =====================================================
// PID LADEN
// =====================================================

function loadMainBotPid() {
    try {

        if (
            !fs.existsSync(
                PID_FILE
            )
        ) {
            return null;
        }

        const pid =
            Number(
                fs.readFileSync(
                    PID_FILE,
                    "utf8"
                ).trim()
            );

        return pid || null;

    } catch {
        return null;
    }
}

// =====================================================
// PID LÖSCHEN
// =====================================================

function clearMainBotPid() {

    try {

        if (
            fs.existsSync(
                PID_FILE
            )
        ) {
            fs.unlinkSync(
                PID_FILE
            );
        }

    } catch {}
}

// =====================================================
// PRÜFEN, OB PROZESS LÄUFT
// =====================================================

function isProcessRunning(pid) {

    if (!pid) {
        return false;
    }

    try {

        process.kill(
            pid,
            0
        );

        return true;

    } catch {

        return false;
    }
}

// =====================================================
// HAUPTBOT STARTEN
// =====================================================

function startMainBot() {

    const existingPid =
        loadMainBotPid();

    if (
        existingPid &&
        isProcessRunning(
            existingPid
        )
    ) {

        return {
            success: false,
            reason: "already_running",
            pid: existingPid
        };
    }

    clearMainBotPid();

    if (
        !MAIN_BOT_DIR
    ) {

        return {
            success: false,
            reason: "missing_directory"
        };
    }

    const botFile =
        path.join(
            MAIN_BOT_DIR,
            MAIN_BOT_FILE
        );

    if (
        !fs.existsSync(
            botFile
        )
    ) {

        return {
            success: false,
            reason: "file_not_found",
            file: botFile
        };
    }

    try {

        const child =
            spawn(
                process.execPath,
                [
                    botFile
                ],
                {
                    cwd:
                        MAIN_BOT_DIR,

                    detached:
                        true,

                    stdio:
                        "ignore"
                }
            );

        child.unref();

        saveMainBotPid(
            child.pid
        );

        child.once(
            "exit",
            () => {

                const savedPid =
                    loadMainBotPid();

                if (
                    savedPid ===
                    child.pid
                ) {
                    clearMainBotPid();
                }
            }
        );

        return {
            success: true,
            pid: child.pid
        };

    } catch (error) {

        console.error(
            "❌ Hauptbot konnte nicht gestartet werden:",
            error
        );

        return {
            success: false,
            reason: "spawn_error",
            error
        };
    }
}

// =====================================================
// HAUPTBOT STOPPEN
// =====================================================

function stopMainBot() {

    const pid =
        loadMainBotPid();

    if (
        !pid ||
        !isProcessRunning(
            pid
        )
    ) {

        clearMainBotPid();

        return {
            success: false,
            reason: "not_running"
        };
    }

    try {

        process.kill(
            pid,
            "SIGTERM"
        );

        return {
            success: true,
            pid
        };

    } catch (error) {

        console.error(
            "❌ Hauptbot konnte nicht beendet werden:",
            error
        );

        return {
            success: false,
            reason: "kill_error"
        };
    }
}

// =====================================================
// STATUS
// =====================================================

function getMainBotStatus() {

    const pid =
        loadMainBotPid();

    if (
        pid &&
        isProcessRunning(
            pid
        )
    ) {

        return {
            online: true,
            pid
        };
    }

    clearMainBotPid();

    return {
        online: false,
        pid: null
    };
}

// =====================================================
// BERECHTIGUNG
// =====================================================

function canControlBot(member) {

    if (!member) {
        return false;
    }

    if (
        member.permissions.has(
            PermissionsBitField.Flags.Administrator
        )
    ) {
        return true;
    }

    return Boolean(
        CONTROL_ROLE_ID &&
        member.roles.cache.has(
            CONTROL_ROLE_ID
        )
    );
}

// =====================================================
// PANEL
// =====================================================

function createControlPanel() {

    const status =
        getMainBotStatus();

    const statusText =
        status.online
            ? "🟢 **Online**"
            : "🔴 **Offline**";

    const embed =
        new EmbedBuilder()
            .setColor(
                status.online
                    ? 0x57F287
                    : 0xED4245
            )
            .setTitle(
                "🤖・Bot-Control-Panel"
            )
            .setDescription(
                "Hier kannst du den 𝐁𝐥𝐚𝐜𝐤𝐨𝐮𝐭 𝐊𝐚𝐫𝐭𝐞𝐥𝐥 steuern.\n\n" +
                `📡 **Status:** ${statusText}\n\n` +
                "✅ **Bot Aktivieren**\n" +
                "Startet den Bot, wenn er offline ist.\n\n" +
                "🔄 **Bot Neustarten**\n" +
                "Startet den Bot neu."
            )
            .setFooter({
                text:
                    "𝐁𝐥𝐚𝐜𝐤𝐨𝐮𝐭 𝐊𝐚𝐫𝐭𝐞𝐥𝐥 • Bot Control"
            })
            .setTimestamp();

    const row =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "control_bot_start"
                    )
                    .setLabel(
                        "Bot Aktivieren"
                    )
                    .setEmoji(
                        "✅"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "control_bot_restart"
                    )
                    .setLabel(
                        "Bot Neustarten"
                    )
                    .setEmoji(
                        "🔄"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "control_bot_refresh"
                    )
                    .setLabel(
                        "Status"
                    )
                    .setEmoji(
                        "📡"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    return {
        embeds: [
            embed
        ],
        components: [
            row
        ]
    };
}

// =====================================================
// READY
// =====================================================

client.once(
    "clientReady",
    () => {

        console.log(
            "===================================="
        );

        console.log(
            "🤖 Control-Bot ONLINE"
        );

        console.log(
            `🤖 Bot: ${client.user.tag}`
        );

        console.log(
            "===================================="
        );
    }
);

// =====================================================
// !BOT-PANEL
// =====================================================

client.on(
    "messageCreate",
    async message => {

        try {

            if (
                message.author.bot ||
                !message.guild
            ) {
                return;
            }

            if (
                message.content
                    .trim()
                    .toLowerCase() !==
                "!bot-panel"
            ) {
                return;
            }

            if (
                !canControlBot(
                    message.member
                )
            ) {
                return message.reply(
                    "❌ Du hast keine Berechtigung für das Bot-Control-Panel."
                );
            }

            await message.channel.send(
                createControlPanel()
            );

        } catch (error) {

            console.error(
                "❌ Fehler bei !bot-panel:",
                error
            );
        }
    }
);

// =====================================================
// BUTTONS
// =====================================================

client.on(
    "interactionCreate",
    async interaction => {

        try {

            if (
                !interaction.isButton()
            ) {
                return;
            }

            if (
                !interaction.inGuild()
            ) {
                return;
            }

            // Keine Server-Beschränkung mehr - Control-Bot geht auf allen Servern

            if (
                !canControlBot(
                    interaction.member
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Du hast keine Berechtigung, den Bot zu steuern.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // =================================================
            // BOT AKTIVIEREN
            // =================================================

            if (
                interaction.customId ===
                "control_bot_start"
            ) {

                const result =
                    startMainBot();

                if (
                    !result.success
                ) {

                    if (
                        result.reason ===
                        "already_running"
                    ) {

                        return interaction.reply({
                            content:
                                `ℹ️ Der Bot läuft bereits.\nPID: \`${result.pid}\``,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        result.reason ===
                        "file_not_found"
                    ) {

                        return interaction.reply({
                            content:
                                `❌ Die Datei wurde nicht gefunden:\n\`${result.file}\``,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    return interaction.reply({
                        content:
                            "❌ Der Bot konnte nicht gestartet werden.",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                await interaction.reply({
                    content:
                        `✅ Der Bot wird gestartet.\nPID: \`${result.pid}\``,
                    flags:
                        MessageFlags.Ephemeral
                });

                return;
            }

            // =================================================
            // BOT NEUSTARTEN
            // =================================================

            if (
                interaction.customId ===
                "control_bot_restart"
            ) {

                const status =
                    getMainBotStatus();

                if (
                    status.online
                ) {

                    stopMainBot();

                    await interaction.reply({
                        content:
                            "🔄 Der Bot wird neu gestartet...",
                        flags:
                            MessageFlags.Ephemeral
                    });

                    setTimeout(
                        () => {

                            const result =
                                startMainBot();

                            if (
                                result.success
                            ) {

                                console.log(
                                    `✅ Hauptbot neu gestartet. PID: ${result.pid}`
                                );

                            } else {

                                console.error(
                                    "❌ Hauptbot konnte nach dem Neustart nicht gestartet werden."
                                );
                            }

                        },
                        2500
                    );

                    return;
                }

                const result =
                    startMainBot();

                if (
                    result.success
                ) {

                    return interaction.reply({
                        content:
                            `✅ Der Bot war offline und wurde gestartet.\nPID: \`${result.pid}\``,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                return interaction.reply({
                    content:
                        "❌ Der Bot konnte nicht gestartet werden.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }

            // =================================================
            // STATUS AKTUALISIEREN
            // =================================================

            if (
                interaction.customId ===
                "control_bot_refresh"
            ) {

                return interaction.update(
                    createControlPanel()
                );
            }

        } catch (error) {

            console.error(
                "❌ Control-Panel Fehler:",
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {

                await interaction.reply({
                    content:
                        "❌ Beim Ausführen ist ein Fehler aufgetreten.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }
        }
    }
);

// =====================================================
// FEHLER
// =====================================================

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "❌ Unhandled Rejection:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {

        console.error(
            "❌ Uncaught Exception:",
            error
        );
    }
);

// =====================================================
// LOGIN
// =====================================================

if (
    !process.env.CONTROL_BOT_TOKEN
) {

    console.error(
        "❌ CONTROL_BOT_TOKEN fehlt in der .env!"
    );

    process.exit(1);
}

client.login(
    process.env.CONTROL_BOT_TOKEN
);