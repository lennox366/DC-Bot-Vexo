// =====================================================
// 🤖 KI-CHAT TECHNIK
// Datei: KI-Chat-Technik.js
// Kostenlose KI (Groq / Gemini / OpenRouter) + Coding
// =====================================================

require("dotenv").config();

// =====================================================
// ANBIETER (alle OpenAI-kompatibel)
// =====================================================
//
// In der .env EINEN Key eintragen (kostenlos):
//
//   GROQ_API_KEY=...         -> https://console.groq.com/keys
//   GEMINI_API_KEY=...       -> https://aistudio.google.com/apikey
//   OPENROUTER_API_KEY=...   -> https://openrouter.ai/keys
//   OPENAI_API_KEY=...       -> (kostenpflichtig, nur als letzte Option)
//
// Optional:
//   AI_PROVIDER=groq | gemini | openrouter | openai
//   AI_MODEL=modellname   (überschreibt das Standard-Modell)
//
// Ohne AI_PROVIDER wird automatisch der erste vorhandene Key genutzt.
// =====================================================

const PROVIDERS = {

    groq: {
        name: "Groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        key: process.env.GROQ_API_KEY,
        model: "llama-3.3-70b-versatile"
    },

    gemini: {
        name: "Google Gemini",
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key: process.env.GEMINI_API_KEY,
        model: "gemini-2.5-flash"
    },

    openrouter: {
        name: "OpenRouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        key: process.env.OPENROUTER_API_KEY,
        model: "qwen/qwen3-coder:free"
    },

    openai: {
        name: "OpenAI",
        url: "https://api.openai.com/v1/chat/completions",
        key: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini"
    }
};

function pickProvider() {

    const wanted = (process.env.AI_PROVIDER || "").toLowerCase();

    if (wanted && PROVIDERS[wanted]) {
        return PROVIDERS[wanted];
    }

    for (const id of ["groq", "gemini", "openrouter", "openai"]) {
        if (PROVIDERS[id].key) {
            return PROVIDERS[id];
        }
    }

    return null;
}

const MAX_TOKENS = 4000;
const TEMPERATURE = 0.5;
const REQUEST_TIMEOUT_MS = 90 * 1000;

// =====================================================
// GESPRÄCHSVERLAUF (für Rückfragen beim Coden)
// =====================================================

const HISTORY_LIMIT = 10; // Nachrichten pro Nutzer (5 Frage/Antwort-Paare)
const HISTORY_MAX_CHARS = 6000; // pro Nachricht, spart Tokens
const history = new Map();

function historyKey(context) {
    return `${context.guildId || "dm"}:${context.userId || "unknown"}`;
}

function getHistory(context) {
    return history.get(historyKey(context)) || [];
}

function addToHistory(context, userMessage, answer) {

    const key = historyKey(context);
    const list = history.get(key) || [];

    list.push({
        role: "user",
        content: userMessage.slice(0, HISTORY_MAX_CHARS)
    });

    list.push({
        role: "assistant",
        content: answer.slice(0, HISTORY_MAX_CHARS)
    });

    while (list.length > HISTORY_LIMIT) {
        list.shift();
    }

    history.set(key, list);
}

// =====================================================
// SERVER-WISSEN (Rollen, Mitglieder, Kanäle)
// =====================================================

const SERVER_INFO_TTL_MS = 60 * 1000;
const MEMBER_FETCH_TTL_MS = 5 * 60 * 1000;
const MAX_MEMBERS_PER_ROLE = 60;

const serverInfoCache = new Map();
const memberFetchTimes = new Map();

async function refreshMembers(guild) {

    const last = memberFetchTimes.get(guild.id) || 0;

    if (Date.now() - last < MEMBER_FETCH_TTL_MS) {
        return;
    }

    try {
        await guild.members.fetch();
        memberFetchTimes.set(guild.id, Date.now());
    } catch (error) {
        console.error(
            "⚠️ KI-Chat: Mitglieder konnten nicht geladen werden (Cache wird genutzt):",
            error.message
        );
    }
}

async function buildServerInfo(guild) {

    const cached = serverInfoCache.get(guild.id);

    if (cached && Date.now() - cached.time < SERVER_INFO_TTL_MS) {
        return cached.text;
    }

    await refreshMembers(guild);

    const lines = [];

    const humans = guild.members.cache.filter(m => !m.user.bot).size;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const owner = guild.members.cache.get(guild.ownerId);

    lines.push(`Servername: ${guild.name}`);
    lines.push(`Server-ID: ${guild.id}`);
    lines.push(`Besitzer: ${owner ? owner.displayName : guild.ownerId}`);
    lines.push(`Mitglieder: ${guild.memberCount} (davon im Cache: ${humans} Menschen, ${bots} Bots)`);

    // Rollen mit Mitgliedern (höchste Rolle zuerst)
    lines.push("");
    lines.push("ROLLEN UND IHRE MITGLIEDER (von oben nach unten in der Rangfolge):");

    const roles = guild.roles.cache
        .filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position);

    for (const role of roles.values()) {

        const members = role.members.map(m => m.displayName);
        const shown = members.slice(0, MAX_MEMBERS_PER_ROLE);
        const rest = members.length - shown.length;

        lines.push(
            `- ${role.name} (${members.length} Mitglieder)` +
            (shown.length ? `: ${shown.join(", ")}` : "") +
            (rest > 0 ? ` … und ${rest} weitere` : "")
        );
    }

    // Kanäle nach Kategorie
    lines.push("");
    lines.push("KANÄLE:");

    const categories = guild.channels.cache
        .filter(c => c.type === 4)
        .sort((a, b) => a.position - b.position);

    const channelsOf = parentId =>
        guild.channels.cache
            .filter(c => c.type !== 4 && !c.isThread() && c.parentId === parentId)
            .sort((a, b) => a.position - b.position)
            .map(c => c.name);

    const loose = channelsOf(null);

    if (loose.length) {
        lines.push(`- (ohne Kategorie): ${loose.join(", ")}`);
    }

    for (const category of categories.values()) {
        lines.push(`- ${category.name}: ${channelsOf(category.id).join(", ") || "(leer)"}`);
    }

    const text = lines.join("\n");

    serverInfoCache.set(guild.id, { time: Date.now(), text });

    return text;
}

function buildAskerInfo(context) {

    const member = context.member;

    if (!member) {
        return `Der Nutzer, der gerade schreibt: ${context.username || "unbekannt"}.`;
    }

    const roleNames = member.roles.cache
        .filter(r => r.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => r.name);

    return (
        `Der Nutzer, der gerade schreibt: ${member.displayName} ` +
        `(Benutzername: ${member.user.username}). ` +
        `Seine Rollen: ${roleNames.length ? roleNames.join(", ") : "keine"}.`
    );
}

// =====================================================
// SYSTEM-PROMPT (inkl. Coding-Fähigkeiten)
// =====================================================

const CODING_PROMPT =
    "Du bist außerdem ein erfahrener Programmierer und kannst in jeder gängigen Sprache coden " +
    "(z. B. JavaScript/Node.js, discord.js, Python, Java, Lua, C#, C++, HTML/CSS, SQL, Bash, " +
    "Minecraft-Plugins und Skripte). " +
    "Wenn jemand Code möchte, schreibst du vollständigen, lauffähigen Code, keine Platzhalter " +
    "wie \"// hier Code einfügen\". " +
    "Wenn jemand Code ändern lässt, gibst du die komplette geänderte Datei bzw. Funktion aus. " +
    "Setze Code IMMER in Markdown-Codeblöcke mit Sprachangabe, z. B. ```js. " +
    "Erkläre danach kurz und verständlich, was der Code macht und wie man ihn benutzt. " +
    "Hilf auch beim Fehlersuchen: Wenn jemand eine Fehlermeldung oder Code schickt, " +
    "nenne die Ursache und liefere die Korrektur. " +
    "Nutze auf Discord keine Tabellen und keine Überschriften mit #; " +
    "halte Erklärungen außerhalb des Codes kurz.";

async function buildSystemPrompt(context) {

    let prompt =
        "Du bist ein freundlicher KI-Assistent auf einem Discord-Server. " +
        "Antworte hilfreich, verständlich und auf Deutsch. " +
        CODING_PROMPT;

    if (!context.guild) {
        return prompt;
    }

    try {

        const serverInfo = await buildServerInfo(context.guild);

        prompt +=
            "\n\nDu kennst diesen Discord-Server genau. Nutze die folgenden Daten, " +
            "wenn jemand nach Rollen, Mitgliedern, Teammitgliedern, Kanälen oder dem Server fragt. " +
            "Erfinde nichts, was hier nicht steht; wenn etwas fehlt, sag, dass du es nicht weißt. " +
            "Die Daten sind aktuell und stammen live vom Server.\n\n" +
            "=== SERVER-DATEN ===\n" + serverInfo + "\n=== ENDE SERVER-DATEN ===\n\n" +
            buildAskerInfo(context);

    } catch (error) {
        console.error("⚠️ KI-Chat: Server-Wissen konnte nicht erstellt werden:", error);
    }

    return prompt;
}

// =====================================================
// KI ANTWORT ERSTELLEN
// =====================================================

async function generateAIResponse(userMessage, context = {}) {

    try {

        const provider = pickProvider();

        if (!provider || !provider.key) {

            console.error(
                "❌ Kein API-Key in der .env gefunden. " +
                "Trage GROQ_API_KEY, GEMINI_API_KEY oder OPENROUTER_API_KEY ein (kostenlos)."
            );

            return "❌ Die KI ist momentan nicht richtig eingerichtet.";
        }

        if (!userMessage) {
            return null;
        }

        const model = process.env.AI_MODEL || provider.model;

        const systemPrompt = await buildSystemPrompt(context);

        // =================================================
        // ANFRAGE
        // =================================================

        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            REQUEST_TIMEOUT_MS
        );

        let response;

        try {

            response = await fetch(provider.url, {
                method: "POST",
                signal: controller.signal,

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${provider.key}`
                },

                body: JSON.stringify({

                    model,

                    messages: [
                        { role: "system", content: systemPrompt },
                        ...getHistory(context),
                        { role: "user", content: userMessage }
                    ],

                    temperature: TEMPERATURE,

                    max_tokens: MAX_TOKENS
                })
            });

        } finally {
            clearTimeout(timeout);
        }

        // =================================================
        // FEHLER PRÜFEN
        // =================================================

        if (!response.ok) {

            const errorText = await response.text();

            console.error(
                `❌ KI-API-Fehler (${provider.name}, ${model}, Status ${response.status}):`,
                errorText
            );

            if (response.status === 429) {
                return "⏳ Das kostenlose Limit ist gerade erreicht. Bitte versuche es in einer Minute noch einmal.";
            }

            return "❌ Die KI konnte gerade keine Antwort erstellen.";
        }

        // =================================================
        // ANTWORT AUSLESEN
        // =================================================

        const data = await response.json();

        let answer = data?.choices?.[0]?.message?.content;

        if (!answer) {

            console.error("❌ Keine KI-Antwort erhalten.");

            return "❌ Es wurde keine Antwort von der KI erhalten.";
        }

        // Denk-Blöcke mancher Modelle entfernen
        answer = answer
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .trim();

        if (!answer) {
            return "❌ Es wurde keine Antwort von der KI erhalten.";
        }

        addToHistory(context, userMessage, answer);

        return answer;

    } catch (error) {

        if (error?.name === "AbortError") {

            console.error("❌ KI-Anfrage: Zeitüberschreitung.");

            return "⏳ Die KI hat zu lange gebraucht. Bitte versuche es noch einmal.";
        }

        console.error(
            "❌ Fehler in KI-Chat-Technik.js:",
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