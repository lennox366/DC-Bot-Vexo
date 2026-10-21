// =====================================================
// 🎨 NEXORACLOUD – RP-LOG EMBED VORLAGEN
// =====================================================

const EVENT_TEMPLATES = {
    ban: {
        emoji: "🔨",
        title: "SPIELER GEBANNT",
        color: 0xED4245,
        fields: [
            { key: "moderatorName", label: "👮 Moderator" },
            { key: "moderatorId", label: "🆔 Moderator-ID" },
            { key: "playerName", label: "👤 Mitglied" },
            { key: "playerId", label: "🆔 Spieler-ID" },
            { key: "duration", label: "⏱️ Dauer" },
            { key: "reason", label: "📝 Grund" }
        ]
    },
    kick: {
        emoji: "🚫",
        title: "SPIELER GEKICKT",
        color: 0xFEE75C,
        fields: [
            { key: "moderatorName", label: "👮 Moderator" },
            { key: "moderatorId", label: "🆔 Moderator-ID" },
            { key: "playerName", label: "👤 Mitglied" },
            { key: "playerId", label: "🆔 Spieler-ID" },
            { key: "reason", label: "📝 Grund" }
        ]
    },
    warn: {
        emoji: "⚠️",
        title: "SPIELER VERWARNT",
        color: 0xFEE75C,
        fields: [
            { key: "moderatorName", label: "👮 Moderator" },
            { key: "moderatorId", label: "🆔 Moderator-ID" },
            { key: "playerName", label: "👤 Mitglied" },
            { key: "playerId", label: "🆔 Spieler-ID" },
            { key: "reason", label: "📝 Grund" }
        ]
    },
    team_action: {
        emoji: "👮",
        title: "TEAM-AKTION",
        color: 0x5865F2,
        fields: [
            { key: "teamMemberName", label: "👤 Teammitglied" },
            { key: "teamMemberId", label: "🆔 Teammitglied-ID" },
            { key: "action", label: "📋 Aktion" },
            { key: "playerName", label: "👤 Betroffener Spieler" },
            { key: "playerId", label: "🆔 Spieler-ID" },
            { key: "details", label: "📝 Details" }
        ]
    },
    police: {
        emoji: "🚓",
        title: "POLIZEI-EINSATZ",
        color: 0x5865F2
    },
    ems: {
        emoji: "🚑",
        title: "RETTUNGSEINSATZ",
        color: 0x57F287
    },
    fire: {
        emoji: "🚒",
        title: "FEUERWEHREINSATZ",
        color: 0xED4245
    },
    emergency_call: {
        emoji: "🚨",
        title: "NOTRUF",
        color: 0xED4245
    },
    accident: {
        emoji: "🚗",
        title: "VERKEHRSUNFALL",
        color: 0xFEE75C
    },
    arrest: {
        emoji: "🚔",
        title: "FESTNAHME",
        color: 0x5865F2
    },
    jail: {
        emoji: "🔒",
        title: "GEFÄNGNIS",
        color: 0x99AAB5
    },
    hospital: {
        emoji: "🏥",
        title: "KRANKENHAUS",
        color: 0x57F287
    },
    fine: {
        emoji: "💰",
        title: "GELDSTRAFE",
        color: 0xFEE75C
    },
    vehicle_seized: {
        emoji: "🚘",
        title: "FAHRZEUG BESCHLAGNAHMT",
        color: 0x99AAB5
    },
    firearm: {
        emoji: "🔫",
        title: "SCHUSSWAFFENEINSATZ",
        color: 0xED4245
    }
};

// Für generische Events (alles außer ban/kick/warn/team_action) werden alle
// vom Roblox-Server mitgesendeten Felder automatisch angezeigt.
const GENERIC_FIELD_LABELS = {
    playerName: "👤 Spieler",
    playerId: "🆔 Spieler-ID",
    officerName: "👮 Beamter",
    officerId: "🆔 Beamten-ID",
    location: "📍 Ort",
    reason: "📝 Grund",
    amount: "💰 Betrag",
    duration: "⏱️ Dauer",
    vehicle: "🚗 Fahrzeug",
    details: "📝 Details"
};

module.exports = {
    EVENT_TEMPLATES,
    GENERIC_FIELD_LABELS
};