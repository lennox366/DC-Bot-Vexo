"use strict";

// =====================================================
// 💎 NOVEX RP GROUP MANAGEMENT SYSTEM
// Discord.js v14
// =====================================================

const fs = require("fs");
const path = require("path");
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

// =====================================================
// KONFIGURATION
// =====================================================

const CONFIG = {
    GROUP_NAME: "Novex RP",
    GROUP_ID_PREFIX: "WEX",
    DEFAULT_RANK: 20, // IC-Rechte
    AUTO_IC_SYNC: true,
    ENABLE_LOGGING: true,
    CONFIRM_CRITICAL_ACTIONS: true,
    DESIGN_COLOR: 0x4A90E2, // Dunkelblau für Novex RP
    DESIGN_DARK: 0x0D0C10,
    DESIGN_LIGHT: 0x151419
};

const DATA_FILE = path.join(__dirname, "novex-group-data.json");
const LOG_FILE = path.join(__dirname, "novex-group-logs.json");

// =====================================================
// RANGSYSTEM (INTERNE NOVEX RP RANGNUMMERN)
// =====================================================

const RANK_NUMBERS = {
    100: { name: "Founder", description: "Server-Gründer", category: "Höchste Ebene" },
    90: { name: "Owner", description: "Server-Besitzer", category: "Höchste Ebene" },
    80: { name: "Leitung", description: "Server-Leitung", category: "Leitung" },
    70: { name: "Management", description: "Management-Ebene", category: "Leitung" },
    60: { name: "Teamleitung", description: "Team-Leitung", category: "Teamführung" },
    50: { name: "Administrator", description: "Administrator", category: "Moderation" },
    40: { name: "Moderator", description: "Moderator", category: "Moderation" },
    30: { name: "Supporter", description: "Supporter", category: "Support" },
    20: { name: "IC-Rechte", description: "IC-Rechte-Besitzer", category: "Ingame" },
    10: { name: "Mitglied", description: "Gruppenmitglied", category: "Basis" }
};

// =====================================================
// STATE
// =====================================================

let groupData = {
    groupId: null,
    members: {},
    ranks: { ...RANK_NUMBERS },
    settings: { ...CONFIG }
};

let logs = [];

// =====================================================
// DATA FUNCTIONS
// =====================================================

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
            groupData = { ...groupData, ...data };
            // Ränge mit Standard-Rängen zusammenführen
            groupData.ranks = { ...RANK_NUMBERS, ...(data.ranks || {}) };
        }
        if (!groupData.groupId) {
            groupData.groupId = generateGroupId();
        }
    } catch (error) {
        console.error("❌ Fehler beim Laden der Group-Daten:", error);
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(groupData, null, 2));
        return true;
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Group-Daten:", error);
        return false;
    }
}

function loadLogs() {
    try {
        if (fs.existsSync(LOG_FILE)) {
            logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
        }
    } catch (error) {
        console.error("❌ Fehler beim Laden der Logs:", error);
    }
}

function saveLogs() {
    try {
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Logs:", error);
    }
}

function generateGroupId() {
    return `${CONFIG.GROUP_ID_PREFIX}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function addLog(action, target, oldData, newData, executor, reason) {
    const logEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        action,
        target,
        oldData,
        newData,
        executor,
        reason
    };
    logs.push(logEntry);
    // Max 1000 Logs behalten
    if (logs.length > 1000) {
        logs = logs.slice(-1000);
    }
    saveLogs();
}

// =====================================================
// MITGLIED-FUNKTIONEN
// =====================================================

function addMember(discordId, robloxId, rankNumber = CONFIG.DEFAULT_RANK) {
    if (groupData.members[discordId]) {
        return { success: false, error: "Mitglied existiert bereits" };
    }
    
    groupData.members[discordId] = {
        discordId,
        robloxId,
        rankNumber,
        rankName: groupData.ranks[rankNumber]?.name || "Unbekannt",
        joinDate: new Date().toISOString(),
        lastRankChange: new Date().toISOString(),
        hasICRights: rankNumber === 20,
        status: "active",
        notes: ""
    };
    
    saveData();
    addLog("MEMBER_ADDED", discordId, null, groupData.members[discordId], "SYSTEM", "Neues Mitglied");
    
    return { success: true, member: groupData.members[discordId] };
}

function updateMemberRank(discordId, newRankNumber, executor, reason) {
    if (!groupData.members[discordId]) {
        return { success: false, error: "Mitglied nicht gefunden" };
    }
    
    const oldRank = groupData.members[discordId].rankNumber;
    const oldRankName = groupData.members[discordId].rankName;
    
    groupData.members[discordId].rankNumber = newRankNumber;
    groupData.members[discordId].rankName = groupData.ranks[newRankNumber]?.name || "Unbekannt";
    groupData.members[discordId].lastRankChange = new Date().toISOString();
    groupData.members[discordId].hasICRights = newRankNumber === 20;
    
    saveData();
    addLog("RANK_CHANGED", discordId, { rank: oldRank, rankName: oldRankName }, 
        { rank: newRankNumber, rankName: groupData.members[discordId].rankName }, executor, reason);
    
    return { success: true, member: groupData.members[discordId] };
}

function getMember(discordId) {
    return groupData.members[discordId] || null;
}

function getMemberByRobloxId(robloxId) {
    return Object.values(groupData.members).find(m => m.robloxId === robloxId) || null;
}

function getAllMembers() {
    return Object.values(groupData.members);
}

// =====================================================
// RANG-FUNKTIONEN
// =====================================================

function createRank(rankNumber, name, description, category) {
    if (groupData.ranks[rankNumber]) {
        return { success: false, error: "Rangnummer existiert bereits" };
    }
    
    groupData.ranks[rankNumber] = { name, description, category };
    saveData();
    addLog("RANK_CREATED", rankNumber, null, { name, description, category }, "SYSTEM", "Neuer Rang");
    
    return { success: true, rank: groupData.ranks[rankNumber] };
}

function updateRank(rankNumber, name, description, category) {
    if (!groupData.ranks[rankNumber]) {
        return { success: false, error: "Rang nicht gefunden" };
    }
    
    const oldRank = { ...groupData.ranks[rankNumber] };
    groupData.ranks[rankNumber] = { name, description, category };
    saveData();
    addLog("RANK_UPDATED", rankNumber, oldRank, groupData.ranks[rankNumber], "SYSTEM", "Rang aktualisiert");
    
    return { success: true, rank: groupData.ranks[rankNumber] };
}

function deleteRank(rankNumber) {
    if (!groupData.ranks[rankNumber]) {
        return { success: false, error: "Rang nicht gefunden" };
    }
    
    const deletedRank = groupData.ranks[rankNumber];
    delete groupData.ranks[rankNumber];
    saveData();
    addLog("RANK_DELETED", rankNumber, deletedRank, null, "SYSTEM", "Rang gelöscht");
    
    return { success: true };
}

function getAllRanks() {
    return groupData.ranks;
}

// =====================================================
// IC-RECHTE SYNCHRONISATION
// =====================================================

function syncICRights(discordId, hasRights, executor) {
    if (!CONFIG.AUTO_IC_SYNC) {
        return { success: false, error: "IC-Sync deaktiviert" };
    }
    
    if (!groupData.members[discordId]) {
        // Neues Mitglied erstellen
        addMember(discordId, null, 20);
        return { success: true, created: true };
    }
    
    const oldHasRights = groupData.members[discordId].hasICRights;
    
    if (hasRights && !oldHasRights) {
        // IC-Rechte erhalten -> Rang 20
        return updateMemberRank(discordId, 20, executor, "IC-Rechte erhalten");
    } else if (!hasRights && oldHasRights) {
        // IC-Rechte entzogen -> Rang 10
        return updateMemberRank(discordId, 10, executor, "IC-Rechte entzogen");
    }
    
    return { success: true, unchanged: true };
}

// =====================================================
// BERECHTIGUNGSSYSTEM
// =====================================================

function hasPermission(member, requiredRankNumber) {
    if (!member) return false;
    
    const memberData = groupData.members[member.id];
    if (!memberData) return false;
    
    // Founder (100) kann alles
    if (memberData.rankNumber >= 100) return true;
    
    // Owner (90) kann alles außer Founder-Ränge
    if (memberData.rankNumber >= 90 && requiredRankNumber < 100) return true;
    
    // Leitung (80) kann bis Management
    if (memberData.rankNumber >= 80 && requiredRankNumber <= 70) return true;
    
    // Management (70) kann bis Teamleitung
    if (memberData.rankNumber >= 70 && requiredRankNumber <= 60) return true;
    
    // Teamleitung (60) kann bis Admin
    if (memberData.rankNumber >= 60 && requiredRankNumber <= 50) return true;
    
    // Keine Berechtigung
    return false;
}

// =====================================================
// EMBED HELPER
// =====================================================

function createEmbed(title, description, color = CONFIG.DESIGN_COLOR) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: "Novex RP Group Management", iconURL: null })
        .setTimestamp();
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    initializeGroupManagement,
    addMember,
    updateMemberRank,
    getMember,
    getMemberByRobloxId,
    getAllMembers,
    createRank,
    updateRank,
    deleteRank,
    getAllRanks,
    syncICRights,
    getGroupData: () => groupData,
    getLogs: () => logs,
    RANK_NUMBERS,
    CONFIG
};

// =====================================================
// INITIALIZATION
// =====================================================

function initializeGroupManagement(client) {
    loadData();
    loadLogs();
    
    console.log("💎 Novex RP Group Management System initialisiert");
    console.log(`   - Gruppen-ID: ${groupData.groupId}`);
    console.log(`   - Gruppenname: ${CONFIG.GROUP_NAME}`);
    console.log(`   - ${Object.keys(groupData.ranks).length} Ränge konfiguriert`);
    console.log(`   - ${Object.keys(groupData.members).length} Mitglieder geladen`);
    console.log(`   - IC-Sync: ${CONFIG.AUTO_IC_SYNC ? "Aktiv" : "Inaktiv"}`);
    
    // Event-Handler können hier hinzugefügt werden
    // client.on("guildMemberAdd", ...);
    // client.on("interactionCreate", ...);
}
