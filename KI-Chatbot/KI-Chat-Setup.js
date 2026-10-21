// =====================================================
// 🤖 KI-CHAT – SETUP
// Datei: KI-Chat-Setup.js
// =====================================================

const fs = require("fs");
const path = require("path");

// =====================================================
// DATEIEN
// =====================================================

const CONFIG_FILE = path.join(
    __dirname,
    "KI-Chat.json"
);

// =====================================================
// STANDARD-KONFIGURATION
// =====================================================

const DEFAULT_CONFIG = {
    enabled: false,
    guilds: {}
};

// =====================================================
// KONFIGURATION LADEN
// =====================================================

function loadConfig() {

    try {

        if (!fs.existsSync(CONFIG_FILE)) {

            fs.writeFileSync(
                CONFIG_FILE,
                JSON.stringify(
                    DEFAULT_CONFIG,
                    null,
                    2
                ),
                "utf8"
            );

            return {
                ...DEFAULT_CONFIG,
                guilds: {}
            };
        }

        const data =
            fs.readFileSync(
                CONFIG_FILE,
                "utf8"
            );

        const config =
            JSON.parse(data);

        return {
            ...DEFAULT_CONFIG,
            ...config,
            guilds:
                config.guilds || {}
        };

    } catch (error) {

        console.error(
            "❌ Fehler beim Laden der KI-Chat-Konfiguration:",
            error
        );

        return {
            ...DEFAULT_CONFIG,
            guilds: {}
        };
    }
}

// =====================================================
// KONFIGURATION SPEICHERN
// =====================================================

function saveConfig(config) {

    try {

        fs.writeFileSync(
            CONFIG_FILE,
            JSON.stringify(
                config,
                null,
                2
            ),
            "utf8"
        );

        return true;

    } catch (error) {

        console.error(
            "❌ Fehler beim Speichern der KI-Chat-Konfiguration:",
            error
        );

        return false;
    }
}

// =====================================================
// SERVER-KONFIGURATION HOLEN
// =====================================================

function getGuildConfig(guildId) {

    const config =
        loadConfig();

    if (!config.guilds[guildId]) {

        config.guilds[guildId] = {
            enabled: false,
            channelId: null
        };

        saveConfig(config);
    }

    return config.guilds[guildId];
}

// =====================================================
// KI-CHAT AKTIVIEREN
// =====================================================

function enableKIChat(
    guildId,
    channelId
) {

    const config =
        loadConfig();

    config.guilds[guildId] = {
        enabled: true,
        channelId: channelId
    };

    config.enabled = true;

    return saveConfig(config);
}

// =====================================================
// KI-CHAT DEAKTIVIEREN
// =====================================================

function disableKIChat(guildId) {

    const config =
        loadConfig();

    if (!config.guilds[guildId]) {
        return false;
    }

    config.guilds[guildId].enabled =
        false;

    return saveConfig(config);
}

// =====================================================
// KI-CHAT KANAL ÄNDERN
// =====================================================

function setKIChatChannel(
    guildId,
    channelId
) {

    const config =
        loadConfig();

    if (!config.guilds[guildId]) {

        config.guilds[guildId] = {
            enabled: true,
            channelId: channelId
        };

    } else {

        config.guilds[guildId].channelId =
            channelId;

        config.guilds[guildId].enabled =
            true;
    }

    config.enabled = true;

    return saveConfig(config);
}

// =====================================================
// PRÜFEN, OB KI-CHAT AKTIV IST
// =====================================================

function isKIChatEnabled(
    guildId
) {

    const guildConfig =
        getGuildConfig(guildId);

    return (
        guildConfig.enabled === true &&
        Boolean(
            guildConfig.channelId
        )
    );
}

// =====================================================
// PRÜFEN, OB KANAL DER KI-CHAT IST
// =====================================================

function isKIChatChannel(
    guildId,
    channelId
) {

    const guildConfig =
        getGuildConfig(guildId);

    if (!guildConfig.enabled) {
        return false;
    }

    return (
        guildConfig.channelId ===
        channelId
    );
}

// =====================================================
// KI-CHAT KANAL HOLEN
// =====================================================

function getKIChatChannelId(
    guildId
) {

    const guildConfig =
        getGuildConfig(guildId);

    return (
        guildConfig.channelId ||
        null
    );
}

// =====================================================
// GESAMTE KONFIGURATION
// =====================================================

function getKIChatConfig() {

    return loadConfig();
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    loadConfig,

    saveConfig,

    getGuildConfig,

    enableKIChat,

    disableKIChat,

    setKIChatChannel,

    isKIChatEnabled,

    isKIChatChannel,

    getKIChatChannelId,

    getKIChatConfig

};