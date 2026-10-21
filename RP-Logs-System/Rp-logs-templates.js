// =====================================================
// 📋 NEXORACLOUD – RP-LOGS EVENT-TEMPLATES
// =====================================================
// Definiert für jeden unterstützten Event-Typ Titel, Emoji und Farbe.
// Die tatsächlichen Datenfelder werden in RP-Logs-System.js automatisch
// anhand von GENERIC_FIELD_LABELS aus den gesendeten Daten ("data")
// ausgewählt und beschriftet. "🕐 Zeitpunkt" und "🏙️ Server" werden
// für JEDES Event automatisch ergänzt und müssen hier nicht angegeben
// werden.
// =====================================================

const GENERIC_FIELD_LABELS = {
    playerName: "👤 Spieler",
    playerId: "🆔 Spieler-ID",

    moderatorName: "🛡️ Moderator",
    moderatorId: "🆔 Moderator-ID",

    adminName: "⚙️ Admin",
    adminId: "🆔 Admin-ID",

    teamMemberName: "👮 Teammitglied",
    teamMemberId: "🆔 Mitglied-ID",

    reason: "📝 Grund",
    action: "⚙️ Aktion",
    notes: "🗒️ Notiz",
    duration: "⏳ Dauer",

    oldTime: "⏰ Alte Zeit",
    newTime: "🕐 Neue Zeit",

    vehicle: "🚗 Fahrzeug",
    plate: "🔢 Kennzeichen",

    amount: "💰 Betrag",
    balanceAfter: "💳 Kontostand danach",

    location: "📍 Position",
    callType: "📞 Art des Notrufs",
    caller: "☎️ Anrufer",
    unit: "🚓 Eingesetzte Einheit"
};

const EVENT_TEMPLATES = {
    // ---------- Server / Welt ----------
    time_changed: { emoji: "🕐", title: "Zeit geändert", color: 0x5865F2 },
    position: { emoji: "📍", title: "Spielerposition", color: 0x99AAB5 },

    // ---------- Spieler-Status ----------
    player_joined: { emoji: "👤", title: "Spieler beigetreten", color: 0x57F287 },
    player_left: { emoji: "🚪", title: "Spieler verlassen", color: 0xED4245 },

    // ---------- Moderation ----------
    ban: { emoji: "🔨", title: "Spieler gebannt", color: 0xED4245 },
    kick: { emoji: "👢", title: "Spieler gekickt", color: 0xFEE75C },
    warn: { emoji: "⚠️", title: "Warnung erteilt", color: 0xFEE75C },

    // ---------- Einsatzkräfte ----------
    police: { emoji: "🚓", title: "Polizeiliche Aktion", color: 0x5865F2 },
    arrest: { emoji: "🚔", title: "Festnahme", color: 0x5865F2 },
    jail: { emoji: "🔒", title: "Gefängnis-Aktion", color: 0x99AAB5 },
    fire: { emoji: "🚒", title: "Feuerwehr-Aktion", color: 0xED4245 },
    ems: { emoji: "🚑", title: "Rettungsdienst-Aktion", color: 0x57F287 },
    hospital: { emoji: "🏥", title: "Krankenhaus-Aktion", color: 0x57F287 },
    emergency_call: { emoji: "📞", title: "Notruf eingegangen", color: 0xED4245 },
    accident: { emoji: "🚗", title: "Verkehrsunfall", color: 0xED4245 },

    // ---------- Fahrzeuge ----------
    vehicle_action: { emoji: "🚗", title: "Fahrzeug-Aktion", color: 0x5865F2 },
    vehicle_seized: { emoji: "🚘", title: "Fahrzeug beschlagnahmt", color: 0x99AAB5 },
    firearm: { emoji: "🔫", title: "Waffen-Aktion", color: 0xED4245 },

    // ---------- Wirtschaft ----------
    fine: { emoji: "💰", title: "Geldstrafe", color: 0xFEE75C },
    economy_action: { emoji: "💰", title: "Geld-/Wirtschaftsaktion", color: 0x57F287 },

    // ---------- Team / Administration ----------
    team_action: { emoji: "👮", title: "Team-Aktion", color: 0x5865F2 },
    admin_action: { emoji: "⚙️", title: "Admin-Aktion", color: 0x99AAB5 }
};

module.exports = {
    EVENT_TEMPLATES,
    GENERIC_FIELD_LABELS
};