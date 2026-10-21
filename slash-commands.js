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
        .setName("teambewerbungtext")
        .setDescription("Erstellt das Panel und setzt den Kanal für neue Bewerbungen")
        .addChannelOption(option =>
            option
                .setName("kanal")
                .setDescription("Textkanal für Panel und neue Bewerbungen (standardmäßig dieser Kanal)")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("codes")
        .setDescription("Bearbeitet die Codes für Server 1 und Server 2"),

    new SlashCommandBuilder()
        .setName("profilbild-bot")
        .setDescription("Ändert das Bot-Profilbild für diesen Server"),

    new SlashCommandBuilder()
        .setName("logs")
        .setDescription("Konfiguriert und testet den Bot-Log-Kanal")
        .addStringOption(option =>
            option
                .setName("aktion")
                .setDescription("Die auszuführende Log-Aktion")
                .setRequired(false)
                .addChoices(
                    { name: "Kanal setzen", value: "set" },
                    { name: "Aktuellen Kanal anzeigen", value: "channel" },
                    { name: "Test-Log senden", value: "test" },
                    { name: "Auf Standard zurücksetzen", value: "reset" }
                )
        )
        .addChannelOption(option =>
            option
                .setName("kanal")
                .setDescription("Textkanal für die Aktion „Kanal setzen“")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("häuser-panel")
        .setDescription("Erstellt oder aktualisiert das Häuser-Panel"),

    new SlashCommandBuilder()
        .setName("häuserliste")
        .setDescription("Zeigt die Häuserliste an"),

    new SlashCommandBuilder()
        .setName("rp-panel")
        .setDescription("Erstellt das RP-Start-/Stopp-Panel"),

    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Öffnet das Giveaway-Einrichtungspanel"),

    new SlashCommandBuilder()
        .setName("team-panel")
        .setDescription("Erstellt das Team-Panel"),

    new SlashCommandBuilder()
        .setName("name-tag-set")
        .setDescription("Aktualisiert Nicknames passend zu Team-Rollen"),

    new SlashCommandBuilder()
        .setName("nickname-aktualisieren")
        .setDescription("Aktualisiert alle Nicknames anhand der aktuellen Rollen"),

    new SlashCommandBuilder()
        .setName("text-sende")
        .setDescription("Öffnet das Panel zum Senden einer Nachricht"),

    new SlashCommandBuilder()
        .setName("verify")
        .setDescription("Erstellt das Verifizierungs-Panel"),

    new SlashCommandBuilder()
        .setName("rp-nachricht")
        .setDescription("Öffnet das RP-Kanal-Konfigurationspanel"),

    new SlashCommandBuilder()
        .setName("befehle")
        .setDescription("Zeigt alle verfügbaren Slash-Befehle an"),

    new SlashCommandBuilder()
        .setName("neustart")
        .setDescription("Startet den Bot neu (nur berechtigte Teammitglieder)"),

    new SlashCommandBuilder()
        .setName("herunterfahren")
        .setDescription("Fährt den Bot herunter (nur Bot-Owner)"),

    new SlashCommandBuilder()
        .setName("teampanel")
        .setDescription("Öffnet das Team-Management-Panel"),

    new SlashCommandBuilder()
        .setName("teamliste")
        .setDescription("Zeigt die Teamliste an"),

    new SlashCommandBuilder()
        .setName("teamliste-update-start")
        .setDescription("Startet automatische Teamlisten-Updates"),

    new SlashCommandBuilder()
        .setName("teamliste-update-stop")
        .setDescription("Stoppt automatische Teamlisten-Updates"),

    new SlashCommandBuilder()
        .setName("teamstatistik")
        .setDescription("Zeigt Teamstatistik und Mitgliedsdetails an"),

    new SlashCommandBuilder()
        .setName("team-bewerbungen")
        .setDescription("Zeigt gespeicherte Teambewerbungen an"),

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
                .setRequired(true)
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
        .setDescription("Developer wählt eine offene Aufgabe aus (nur Developer)"),

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
        .setDescription("Öffnet das Privatnachrichten-Panel"),

    // =====================================================
    // UNTERHALTUNGS-SYSTEM BEFEHLE
    // =====================================================
    ...[
        ["setups", "Öffnet die Entertainment-Setup-Übersicht"],
        ["willkommen-panel", "Erstellt oder aktualisiert das Willkommens-Panel"],
        ["film-panel", "Erstellt das Film-Panel"],
        ["umfrage-panel", "Erstellt das Umfrage-Panel"],
        ["spielkalender-panel", "Erstellt den Spielkalender"],
        ["highscore-panel", "Erstellt das Highscore-Panel"],
        ["spiele-vorschlaege-panel", "Erstellt das Spiele-Vorschläge-Panel"],
        ["ankuendigung-panel", "Erstellt das Ankündigungs-Panel"],
        ["event-kalender-panel", "Erstellt das Event-Kalender-Panel"],
        ["auto-nachrichten-panel", "Erstellt das Auto-Nachrichten-Panel"],
        ["filmabend-panel", "Erstellt das Filmabend-Panel"],
        ["bewertung-panel", "Erstellt das Bewertungs-Panel"]
    ].map(([name, description]) =>
        new SlashCommandBuilder()
            .setName(name)
            .setDescription(description)
    ),

    // =====================================================
    // KI-CHAT BEFEHLE
    // =====================================================
    new SlashCommandBuilder()
        .setName("ki-chat")
        .setDescription("Legt den KI-Chat-Kanal fest")
        .addChannelOption(option =>
            option
                .setName("kanal")
                .setDescription("Der KI-Chat-Kanal (standardmäßig dieser Kanal)")
                .setRequired(false)
        ),

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
