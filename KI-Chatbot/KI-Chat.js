// =====================================================
// 🤖 KI-CHAT
// Datei: KI-Chat.js
// =====================================================

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
// NACHRICHTEN-HANDLER
// =====================================================

async function handleKIChatMessage(message) {

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

        // Tippen anzeigen
        try {
            await message.channel.sendTyping();
        } catch (_) {}

        // KI-Antwort erzeugen
        const response = await generateAIResponse(
            userMessage,
            {
                guildId: message.guild.id,
                channelId: message.channel.id,
                userId: message.author.id,
                username: message.author.username
            }
        );

        if (!response) {
            return;
        }

        // Discord-Limit
        const MAX_LENGTH = 2000;

        if (response.length <= MAX_LENGTH) {

            await message.reply({
                content: response,
                allowedMentions: {
                    repliedUser: false
                }
            });

            return;
        }

        // Lange Antworten aufteilen
        const chunks = [];

        for (
            let i = 0;
            i < response.length;
            i += MAX_LENGTH
        ) {
            chunks.push(
                response.substring(
                    i,
                    i + MAX_LENGTH
                )
            );
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