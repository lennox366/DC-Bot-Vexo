"use strict";

// =====================================================
// 🎵 NEXORACLOUD MUSIC-SYSTEM — SLASH-COMMAND DEPLOYMENT
// =====================================================
//
// Registriert AUSSCHLIESSLICH die Musik-Slash-Commands
// (/play, /pause, /resume, /skip, /stop, /queue) bei Discord,
// damit sie tatsächlich im Server auftauchen und nutzbar sind.
// Ohne dieses Skript kennt Discord die Befehle nicht - Music-
// System.js kann /play zwar behandeln, sobald es ausgeführt
// wird, aber der Slash-Befehl erscheint erst nach einem Lauf
// dieses Skripts in Discord.
//
// Einmalig ausführen (und erneut nach jeder Änderung an den
// Befehlsdefinitionen in Music-System.js):
//
//   node Music-System/Deploy-Music-Commands.js
//
// Registriert standardmäßig GUILD-spezifisch (sofort in Discord
// sichtbar, keine bis zu einstündige Wartezeit wie bei globalen
// Befehlen). Zielserver:
//   - Umgebungsvariable GUILD_ID, falls gesetzt
//   - sonst der Standard-Server aus der index.js (DEFAULT_GUILD_ID)
//
// Benötigte Umgebungsvariablen (aus der bestehenden .env):
//   BOT_TOKEN  - Bot-Token (bereits vorhanden, siehe index.js)
//   CLIENT_ID  - Application-/Client-ID des Bots (optional, siehe Fallback unten)
//   GUILD_ID   - Ziel-Server für die Registrierung (optional, siehe Fallback unten)
//
// Hinweis: Da dieser Bot ausschließlich Musik-Slash-Commands
// verwendet (alle anderen Befehle sind "!"-Präfix-Befehle),
// überschreibt dieses Skript mit PUT nur die Musik-Befehle und
// beeinträchtigt keine bestehenden Funktionen.
// =====================================================

require("dotenv").config();

const { REST, Routes } = require("discord.js");
const { musicCommandDefinitions } = require("./Music-System");

// Fallback-Werte entsprechen den bereits in der index.js verwendeten
// Standard-IDs (CLIENT_ID_1 / DEFAULT_GUILD_ID), damit das Skript
// auch ohne zusätzliche .env-Einträge sofort funktioniert.
const CLIENT_ID = process.env.CLIENT_ID || "1540470358606610632";
const GUILD_ID = process.env.GUILD_ID || "1362117286512824321";
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN fehlt in den Environment Variables (.env). Registrierung abgebrochen.");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("❌ CLIENT_ID konnte nicht ermittelt werden (Environment Variable CLIENT_ID setzen). Registrierung abgebrochen.");
    process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

async function deployMusicCommands() {
    const commandNames = musicCommandDefinitions.map(command => `/${command.name}`).join(", ");

    try {
        console.log(`🎵 [Music-System] Registriere ${musicCommandDefinitions.length} Slash-Command(s): ${commandNames} ...`);

        if (GUILD_ID) {
            // Guild-spezifische Registrierung: sofort in Discord sichtbar,
            // betrifft ausschließlich diesen einen Server.
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: musicCommandDefinitions }
            );
            console.log(`✅ [Music-System] Slash-Commands erfolgreich für Server ${GUILD_ID} registriert.`);
        } else {
            // Fallback: globale Registrierung (kann bis zu 1 Stunde
            // dauern, bis die Befehle überall in Discord erscheinen).
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: musicCommandDefinitions }
            );
            console.log("✅ [Music-System] Slash-Commands global registriert (Sichtbarkeit kann bis zu 1 Stunde dauern).");
        }
    } catch (error) {
        console.error("❌ [Music-System] Fehler beim Registrieren der Slash-Commands:", error);
        process.exit(1);
    }
}

deployMusicCommands();