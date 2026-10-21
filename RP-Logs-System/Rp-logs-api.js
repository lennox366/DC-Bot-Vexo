// =====================================================
// 📡 NEXORACLOUD – RP-LOGS API
// =====================================================
// ROBLOX  →  POST /api/rp/log  →  gespeicherter Webhook  →  Discord
//
// Diese Datei exportiert einen Express-Router, der in einen
// BESTEHENDEN Express-Server (z.B. Dashboard/server.js) eingebunden
// werden kann. Es wird hier bewusst KEIN eigener app.listen()
// aufgerufen, um keinen zweiten Server auf demselben Port zu starten.
// =====================================================

const express = require("express");
const { dispatchRpLog } = require("./RP-Logs-System");

const REQUIRED_FIELDS_BY_TYPE = {
    ban: ["playerName", "playerId", "moderatorName", "moderatorId", "reason"],
    kick: ["playerName", "playerId", "moderatorName", "moderatorId", "reason"],
    warn: ["playerName", "playerId", "moderatorName", "moderatorId", "reason"],
    team_action: ["teamMemberName", "teamMemberId", "action"],

    // ---------- neue, vom Kunden angeforderte Event-Typen ----------
    time_changed: ["playerName", "playerId", "oldTime", "newTime"],
    player_joined: ["playerName", "playerId"],
    player_left: ["playerName", "playerId"],
    vehicle_action: ["playerName", "playerId", "vehicle", "action"],
    vehicle_seized: ["playerName", "playerId", "vehicle"],
    economy_action: ["playerName", "playerId", "amount", "action"],
    fine: ["playerName", "playerId", "amount", "moderatorName", "moderatorId"],
    admin_action: ["adminName", "adminId", "action"],
    position: [] // Koordinaten sind optional ("sofern vom Roblox-System übermittelt")
};

const ALLOWED_TYPES = new Set([
    "ban", "kick", "warn", "team_action",
    "police", "ems", "fire", "emergency_call", "accident",
    "arrest", "jail", "hospital", "fine", "vehicle_seized", "firearm",

    // ---------- neue, vom Kunden angeforderte Event-Typen ----------
    "time_changed", "player_joined", "player_left",
    "vehicle_action", "economy_action", "admin_action", "position"
]);

// ---------- einfacher In-Memory Rate-Limiter ----------
// (kein zusätzliches npm-Paket nötig; pro Quelle max. N Requests / Zeitfenster)
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 Sekunden
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitBuckets = new Map();

function isRateLimited(key) {
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key) || [];
    const recent = bucket.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

    recent.push(now);
    rateLimitBuckets.set(key, recent);

    return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

// ---------- Authentifizierung ----------
// WICHTIG: Der Secret-Key wird ausschließlich über die Environment-Variable
// ROBLOX_RP_LOG_SECRET gelesen und NIEMALS geloggt oder ausgegeben.
function requireApiKey(req, res, next) {
    const providedSecret = req.get("x-rp-log-secret");
    const expectedSecret = process.env.ROBLOX_RP_LOG_SECRET;

    if (!expectedSecret) {
        console.error("❌ [RP-Logs API] ROBLOX_RP_LOG_SECRET ist nicht gesetzt – Requests werden abgelehnt.");
        return res.status(500).json({ success: false, error: "server_misconfigured" });
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
        return res.status(401).json({ success: false, error: "unauthorized" });
    }

    next();
}

function rateLimit(req, res, next) {
    // Rate-Limit pro Secret-Key (nicht der Wert selbst wird geloggt, nur als Bucket-Schlüssel verwendet)
    const key = req.get("x-rp-log-secret") || req.ip;
    if (isRateLimited(key)) {
        return res.status(429).json({ success: false, error: "rate_limited" });
    }
    next();
}

// ---------- Validierung ----------
function validateBody(req, res, next) {
    const { type, guildId, server } = req.body || {};

    if (!type || !ALLOWED_TYPES.has(type)) {
        return res.status(400).json({ success: false, error: "invalid_type" });
    }

    if (!guildId || typeof guildId !== "string") {
        return res.status(400).json({ success: false, error: "missing_guildId" });
    }

    if (!server || typeof server !== "string") {
        return res.status(400).json({ success: false, error: "missing_server" });
    }

    const requiredFields = REQUIRED_FIELDS_BY_TYPE[type] || [];
    for (const field of requiredFields) {
        if (req.body[field] === undefined || req.body[field] === null || req.body[field] === "") {
            return res.status(400).json({ success: false, error: `missing_field_${field}` });
        }
    }

    next();
}

function createRpLogsRouter() {
    const router = express.Router();

    // Unauthentifizierter Health-Check: erlaubt Roblox/Monitoring zu prüfen,
    // ob die API überhaupt erreichbar ist, OHNE Log-Daten zu verarbeiten.
    router.get("/api/rp/health", (req, res) => {
        res.status(200).json({ success: true, status: "online" });
    });

    router.post(
        "/api/rp/log",
        express.json(),
        requireApiKey,
        rateLimit,
        validateBody,
        async (req, res) => {
            const { type, guildId, ...data } = req.body;

            const result = await dispatchRpLog(guildId, type, data);

            if (!result.success) {
                const statusMap = {
                    no_webhook: 409,
                    unknown_type: 400,
                    webhook_error: 502
                };
                return res.status(statusMap[result.reason] || 500).json({ success: false, error: result.reason });
            }

            return res.status(200).json({ success: true });
        }
    );

    return router;
}

/**
 * Optionaler eigenständiger Server – NUR verwenden, wenn noch KEIN
 * Express-Server/Dashboard im Projekt existiert. Läuft standardmäßig
 * auf einem eigenen Port, damit garantiert kein Port-Konflikt entsteht.
 */
function startStandaloneRpLogsServer(port = process.env.RP_LOGS_API_PORT || 3100) {
    const app = express();
    app.use(createRpLogsRouter());

    app.listen(port, () => {
        console.log(`✅ [RP-Logs API] Eigenständiger Server läuft auf Port ${port} (nur nutzen, falls kein Dashboard existiert).`);
    });

    return app;
}

module.exports = {
    createRpLogsRouter,
    startStandaloneRpLogsServer
};