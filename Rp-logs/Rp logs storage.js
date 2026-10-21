const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "rp-logs.json");

function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), "utf8");
    }
}

function loadAll() {
    try {
        ensureDataFile();
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        return JSON.parse(raw || "{}");
    } catch (error) {
        console.error("❌ [RP-Logs] Konnte rp-logs.json nicht laden:", error);
        return {};
    }
}

function saveAll(data) {
    try {
        ensureDataFile();
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("❌ [RP-Logs] Konnte rp-logs.json nicht speichern:", error);
        return false;
    }
}

let cache = loadAll();

function defaultConfig(guildId) {
    return {
        guildId: guildId,
        webhookUrl: null,
        channelId: null,
        webPanelChannelId: null,
        webPanelMessageId: null,
        enabled: false,
        logsSent: 0,
        failedLogs: 0,
        lastLog: null
    };
}

function getGuildConfig(guildId) {
    if (!cache[guildId]) {
        cache[guildId] = defaultConfig(guildId);
        saveAll(cache);
    }
    return cache[guildId];
}

function updateGuildConfig(guildId, patch) {
    const config = getGuildConfig(guildId);
    Object.assign(config, patch);
    cache[guildId] = config;
    saveAll(cache);
    return config;
}

function setWebhook(guildId, webhookUrl) {
    return updateGuildConfig(guildId, { webhookUrl, enabled: true });
}

function removeWebhook(guildId) {
    return updateGuildConfig(guildId, { webhookUrl: null, enabled: false });
}

function setLogChannel(guildId, channelId) {
    return updateGuildConfig(guildId, { channelId });
}

function setWebPanel(guildId, channelId, messageId) {
    return updateGuildConfig(guildId, {
        webPanelChannelId: channelId,
        webPanelMessageId: messageId
    });
}

function registerLogSuccess(guildId) {
    const config = getGuildConfig(guildId);
    config.logsSent = Number(config.logsSent || 0) + 1;
    config.lastLog = new Date().toISOString();
    cache[guildId] = config;
    saveAll(cache);
    return config;
}

function registerLogFailure(guildId) {
    const config = getGuildConfig(guildId);
    config.failedLogs = Number(config.failedLogs || 0) + 1;
    cache[guildId] = config;
    saveAll(cache);
    return config;
}

function reload() {
    cache = loadAll();
    return cache;
}

module.exports = {
    getGuildConfig,
    updateGuildConfig,
    setWebhook,
    removeWebhook,
    setLogChannel,
    setWebPanel,
    registerLogSuccess,
    registerLogFailure,
    reload
};