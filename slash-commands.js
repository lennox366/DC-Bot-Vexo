const {
    SlashCommandBuilder,
    PermissionsBitField
} = require("discord.js");
const { musicCommandDefinitions } = require("./Music-System/Music-System");

// =====================================================
// SLASH COMMAND DEFINITIONEN
// =====================================================

const slashCommands = [
    // =====================================================
    // INDEX.JS BEFEHLE
    // =====================================================

    new SlashCommandBuilder()
        .setName("rollen")
        .setDescription("Listet alle Rollen des Servers auf (nur Bot-Owner)")
        .addStringOption(option =>
            option
                .setName("server")
                .setDescription("Server-ID (optional, standardmäßig aktueller Server)")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("bot-status")
        .setDescription("Erstellt oder aktualisiert ein Bot-Status-Panel (nur Bot-Owner)"),

    new SlashCommandBuilder()
        .setName("rppanel")
        .setDescription("Erstellt das RP-Start-/Stopp-Panel"),

    new SlashCommandBuilder()
        .setName("selbstzerstörung")
        .setDescription("Entfernt alle deine Rollen nach einem Countdown"),

    new SlashCommandBuilder()
        .setName("selbstzerstörung-panel")
        .setDescription("Öffnet das Selbstzerstörungs-Panel (nur Bot-Owner)"),

    new SlashCommandBuilder()
        .setName("entferne-verifiziere")
        .setDescription("Entfernt eine Verifizierungsrolle serverweit (nur mit Berechtigung)")
        .addStringOption(option =>
            option
                .setName("rolle")
                .setDescription("ID der zu entfernenden Rolle")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("teambewerbung")
        .setDescription("Erstellt das Bewerbungspanel mit dem Fragenformular"),

    new SlashCommandBuilder()
        .setName("codes")
        .setDescription("Bearbeitet die Codes für Server 1 und Server 2"),

    new SlashCommandBuilder()
        .setName("profilbild-bot")
        .setDescription("Ändert das Bot-Profilbild für diesen Server"),

    new SlashCommandBuilder()
        .setName("logs")
        .setDescription("Zeigt die Logs des Servers (nur mit Berechtigung)"),

    new SlashCommandBuilder()
        .setName("häuser-panel")
        .setDescription("Erstellt oder aktualisiert das Häuser-Panel"),

    new SlashCommandBuilder()
        .setName("teampanel")
        .setDescription("Öffnet das Team-Management-Panel"),

    new SlashCommandBuilder()
        .setName("teamliste")
        .setDescription("Zeigt die Teamliste an"),

    // =====================================================
    // GANG-SYSTEM BEFEHLE
    // =====================================================

    new SlashCommandBuilder()
        .setName("gang-panel")
        .setDescription("Öffnet das Gang-Verwaltungs-Panel"),

    new SlashCommandBuilder()
        .setName("gang-liste")
        .setDescription("Zeigt die Gang-Liste an"),

    // =====================================================
    // BÜRGER-VORSCHLAG-SYSTEM BEFEHLE
    // =====================================================

    new SlashCommandBuilder()
        .setName("vorschläge")
        .setDescription("Bürger-Vorschläge Panel")
        .addStringOption(option =>
            option
                .setName("typ")
                .setDescription("Typ des Vorschlags")
                .setRequired(false)
                .addChoices(
                    { name: "Bürger", value: "bürger" }
                )
        ),

    new SlashCommandBuilder()
        .setName("bürgertext")
        .setDescription("Bürger-Text Panel"),

    // =====================================================
    // DEV-AUFGABEN-SYSTEM BEFEHLE
    // =====================================================

    new SlashCommandBuilder()
        .setName("dev-kanal")
        .setDescription("Konfiguriert den Dev-Aufgaben-Kanal (nur Developer)")
        .addChannelOption(option =>
            option
                .setName("kanal")
                .setDescription("Der Ziel-Kanal für Dev-Aufgaben")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("dev-aufgaben-panel")
        .setDescription("Erstellt ein dauerhaftes Dev-Aufgaben-Panel (nur Developer)"),

    new SlashCommandBuilder()
        .setName("dev-aufgaben")
        .setDescription("Reicht eine Dev-Aufgabe ein")
        .addStringOption(option =>
            option
                .setName("aufgabe")
                .setDescription("Beschreibung der Aufgabe")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("dev-antwort")
        .setDescription("Developer wählt offene Aufgabe aus (nur Developer)")
        .addStringOption(option =>
            option
                .setName("aufgaben-id")
                .setDescription("ID der Aufgabe")
                .setRequired(true)
        ),

    // =====================================================
    // RP-LOGS-SYSTEM BEFEHLE
    // =====================================================

    new SlashCommandBuilder()
        .setName("rp-logs-einstellungen")
        .setDescription("RP-Logs Einstellungen"),

    new SlashCommandBuilder()
        .setName("web-logs")
        .setDescription("RP-Web-Logs anzeigen"),

    new SlashCommandBuilder()
        .setName("rp-logs-test")
        .setDescription("Test-Command für RP-Logs"),

    // =====================================================
    // PRIVATNACHRICHT-SYSTEM BEFEHLE
    // =====================================================

    new SlashCommandBuilder()
        .setName("privatnachricht")
        .setDescription("Sendet eine Privatnachricht an einen User")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Der Empfänger")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("nachricht")
                .setDescription("Die Nachricht")
                .setRequired(true)
        ),

    // =====================================================
    // KI-CHAT BEFEHLE
    // =====================================================

    new SlashCommandBuilder()
        .setName("ki-chat-setup")
        .setDescription("Konfiguriert den KI-Chat-Kanal")
        .addChannelOption(option =>
            option
                .setName("kanal")
                .setDescription("Der KI-Chat-Kanal")
                .setRequired(true)
        )
].map(command => command.toJSON());

// Musikbefehle ebenfalls in die zentrale Registrierung aufnehmen.
// Andernfalls entfernt client.application.commands.set() sie wieder.
slashCommands.push(...musicCommandDefinitions);

module.exports = {
    slashCommands
};
