// =====================================================
// 🤖 KI-CHAT
// Datei: KI-Chat.js
// =====================================================

const { AttachmentBuilder } = require("discord.js");

const {
    isKIChatChannel,
    getKIChatChannelId
} = require("./KI-Chat-Setup");

// =====================================================
// STATUS
// =====================================================

let initialized = false;

// =====================================================
// CLIENT SPEICHERN
// =====================================================

let discordClient = null;

// =====================================================
// CLIENT SETZEN
// =====================================================

function setClient(client) {
    discordClient = client;
}

// =====================================================
// LANGE ANTWORTEN AUFTEILEN (Code-Blöcke bleiben intakt)
// =====================================================

const CHUNK_LIMIT = 1900;      // Discord erlaubt 2000
const MAX_CHUNKS = 5;          // darüber hinaus als Datei senden

function splitMessage(text, max = CHUNK_LIMIT) {

    const chunks = [];

    let current = "";
    let openFence = null; // z. B. "```js"

    const lines = text.split("\n");
    const pieceSize = max - 20;

    for (const rawLine of lines) {

        // Extrem lange Einzelzeilen zerlegen
        const pieces =
            rawLine.length > pieceSize
                ? rawLine.match(new RegExp(`[\\s\\S]{1,${pieceSize}}`, "g"))
                : [rawLine];

        for (const line of pieces) {

            const reserve = openFence ? 4 : 0; // "\n```" zum Schließen

            if (current.length + line.length + 1 + reserve > max) {

                if (openFence) {
                    current += "\n```";
                }

                chunks.push(current);

                current = openFence ? openFence + "\n" : "";
            }

            if (current && !current.endsWith("\n")) {
                current += "\n";
            }

            current += line;

            // Code-Block-Status verfolgen
            if (line.trim().startsWith("```")) {
                openFence = openFence ? null : line.trim();
            }
        }
    }

    if (current.trim()) {
        chunks.push(current);
    }

    return chunks;
}

// =====================================================
// NACHRICHTEN-HANDLER
// =====================================================

async function handleKIChatMessage(message) {

    let typingInterval = null;

    try {

        if (!discordClient) {
            return;
        }

        if (!message) {
            return;
        }

        // Bots ignorieren
        if (message.author?.bot) {
            return;
        }

        // Nur Server
        if (!message.guild) {
            return;
        }

        // Keine Textnachricht
        if (!message.content) {
            return;
        }

        // Nur im eingestellten KI-Kanal antworten
        if (
            !isKIChatChannel(
                message.guild.id,
                message.channel.id
            )
        ) {
            return;
        }

        const userMessage = message.content.trim();

        if (!userMessage) {
            return;
        }

        // KI-Technik laden
        const {
            generateAIResponse
        } = require("./KI-Chat-Technik");

        // Tippen anzeigen (bei langen Code-Antworten regelmäßig erneuern)
        try {
            await message.channel.sendTyping();
        } catch (_) {}

        typingInterval = setInterval(() => {
            message.channel.sendTyping().catch(() => {});
        }, 8000);

        // KI-Antwort erzeugen
        const response = await generateAIResponse(
            userMessage,
            {
                guildId: message.guild.id,
                channelId: message.channel.id,
                userId: message.author.id,
                username: message.author.username,
                guild: message.guild,
                member: message.member
            }
        );

        clearInterval(typingInterval);
        typingInterval = null;

        if (!response) {
            return;
        }

        // Kurze Antwort
        if (response.length <= 2000) {

            await message.reply({
                content: response,
                allowedMentions: {
                    repliedUser: false
                }
            });

            return;
        }

        // Lange Antwort aufteilen
        const chunks = splitMessage(response);

        // Sehr lange Antworten (z. B. ganze Dateien) als Datei senden
        if (chunks.length > MAX_CHUNKS) {

            const file = new AttachmentBuilder(
                Buffer.from(response, "utf8"),
                { name: "antwort.md" }
            );

            await message.reply({
                content:
                    "📄 Die Antwort ist sehr lang, deshalb habe ich sie als Datei angehängt.",
                files: [file],
                allowedMentions: {
                    repliedUser: false
                }
            });

            return;
        }

        // Erste Nachricht als Antwort
        await message.reply({
            content: chunks[0],
            allowedMentions: {
                repliedUser: false
            }
        });

        // Restliche Nachrichten
        for (
            let i = 1;
            i < chunks.length;
            i++
        ) {
            await message.channel.send({
                content: chunks[i],
                allowedMentions: {
                    parse: []
                }
            });
        }

    } catch (error) {

        console.error(
            "❌ Fehler im KI-Chat:",
            error
        );

        try {

            await message.reply({
                content:
                    "❌ Die KI konnte gerade keine Antwort erstellen.",
                allowedMentions: {
                    repliedUser: false
                }
            });

        } catch (_) {}

    } finally {

        if (typingInterval) {
            clearInterval(typingInterval);
        }
    }
}

// =====================================================
// HANDLER REGISTRIEREN
// =====================================================

function initializeKIChat(client) {

    if (initialized) {
        return;
    }

    if (!client) {
        throw new Error(
            "KI-Chat: Kein Discord-Client übergeben."
        );
    }

    discordClient = client;

    client.on(
        "messageCreate",
        handleKIChatMessage
    );

    initialized = true;

    console.log(
        "🤖 KI-Chat-Modul wurde aktiviert."
    );
}

// =====================================================
// STATUS
// =====================================================

function isInitialized() {
    return initialized;
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    initializeKIChat,
    handleKIChatMessage,
    setClient,
    isInitialized,
    getKIChatChannelId

};