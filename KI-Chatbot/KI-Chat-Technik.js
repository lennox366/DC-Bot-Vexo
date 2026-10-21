// =====================================================
// 🤖 KI-CHAT TECHNIK
// Datei: KIChatTechnik.js
// =====================================================

require("dotenv").config();

// =====================================================
// KONFIGURATION
// =====================================================

const API_KEY = process.env.OPENAI_API_KEY;

const MODEL =
    process.env.OPENAI_MODEL || "gpt-4o-mini";

// =====================================================
// KI ANTWORT ERSTELLEN
// =====================================================

async function generateAIResponse(userMessage, context = {}) {

    try {

        if (!API_KEY) {

            console.error(
                "❌ OPENAI_API_KEY fehlt in der .env-Datei."
            );

            return "❌ Die KI ist momentan nicht richtig eingerichtet.";
        }

        if (!userMessage) {
            return null;
        }

        // =================================================
        // OPENAI ANFRAGE
        // =================================================

        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${API_KEY}`
                },

                body: JSON.stringify({

                    model: MODEL,

                    messages: [

                        {
                            role: "system",
                            content:
                                "Du bist ein freundlicher KI-Assistent auf einem Discord-Server. Antworte hilfreich, verständlich und auf Deutsch."
                        },

                        {
                            role: "user",
                            content: userMessage
                        }

                    ],

                    temperature: 0.7,

                    max_tokens: 1000

                })
            }
        );

        // =================================================
        // FEHLER PRÜFEN
        // =================================================

        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "❌ KI-API-Fehler:",
                errorText
            );

            return "❌ Die KI konnte gerade keine Antwort erstellen.";
        }

        // =================================================
        // ANTWORT AUSLESEN
        // =================================================

        const data =
            await response.json();

        const answer =
            data?.choices?.[0]?.message?.content;

        if (!answer) {

            console.error(
                "❌ Keine KI-Antwort erhalten."
            );

            return "❌ Es wurde keine Antwort von der KI erhalten.";
        }

        return answer.trim();

    } catch (error) {

        console.error(
            "❌ Fehler in KIChatTechnik.js:",
            error
        );

        return "❌ Bei der Verarbeitung der KI-Anfrage ist ein Fehler aufgetreten.";
    }
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    generateAIResponse
};