// dashboard.js
// Kleines Web-Dashboard für deinen discord.js-Bot (eingebauter http-Server,
// keine zusätzliche Bibliothek nötig).
//
// Umgebungsvariablen:
//   DASHBOARD_PASSWORD  Passwort fürs Dashboard (PFLICHT, sonst startet es nicht)
//   PORT                wird von Render automatisch gesetzt
//
// Braucht intents.GuildMembers (für genaue Zahlen) und optional
// intents.GuildPresences (für die Online-Anzahl).

const http = require("http");
const crypto = require("crypto");
const storage = require("./storage.js");

const PASSWORD = process.env.DASHBOARD_PASSWORD;
const sessions = new Set();

function send(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="));
  return match ? match.split("=")[1] : null;
}

function requireAuth(req) {
  const token = getCookie(req, "dash");
  return token && sessions.has(token);
}

function setup(client) {
  if (!PASSWORD) {
    console.log("[Dashboard] DASHBOARD_PASSWORD ist nicht gesetzt - Dashboard wird NICHT gestartet.");
    return;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;

    if (path === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(HTML);
    }

    if (path === "/api/login" && req.method === "POST") {
      const body = await readBody(req);
      await new Promise((r) => setTimeout(r, 300)); // bremst Passwort-Raten
      if (typeof body.password === "string" && crypto.timingSafeEqual(
        Buffer.from(body.password.padEnd(PASSWORD.length)), Buffer.from(PASSWORD.padEnd(body.password.length))
      ) && body.password === PASSWORD) {
        const token = crypto.randomBytes(32).toString("hex");
        sessions.add(token);
        res.setHeader("Set-Cookie", `dash=${token}; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}; Path=/`);
        return send(res, 200, { ok: true });
      }
      return send(res, 401, { ok: false });
    }

    if (path.startsWith("/api/") && !requireAuth(req)) {
      return send(res, 401, { error: "unauthorized" });
    }

    if (path === "/api/guilds" && req.method === "GET") {
      return send(
        res,
        200,
        client.guilds.cache.map((g) => ({ id: g.id, name: g.name }))
      );
    }

    if (path === "/api/stats" && req.method === "GET") {
      const guild = client.guilds.cache.get(url.searchParams.get("guild"));
      if (!guild) return send(res, 404, { error: "Server nicht gefunden" });
      const hasMembers = client.options.intents.has(1 << 1); // GuildMembers
      const members = guild.members.cache;
      const bots = hasMembers ? members.filter((m) => m.user.bot).size : null;
      const online = hasMembers
        ? members.filter((m) => m.presence && m.presence.status !== "offline" && !m.user.bot).size
        : null;
      return send(res, 200, {
        members: guild.memberCount,
        bots,
        online,
        text: guild.channels.cache.filter((c) => c.type === 0).size,
        voice: guild.channels.cache.filter((c) => c.type === 2).size,
        roles: guild.roles.cache.size - 1,
        boosts: guild.premiumSubscriptionCount || 0,
        tier: guild.premiumTier,
        created: guild.createdAt.toLocaleDateString("de-DE"),
        week: storage.getWeekStats(guild.id),
      });
    }

    if (path === "/api/commands" && req.method === "GET") {
      const guildId = url.searchParams.get("guild");
      if (!client.guilds.cache.get(guildId)) return send(res, 404, { error: "Server nicht gefunden" });
      const disabled = storage.loadDisabledCommands()[guildId] || [];
      const list = (global.__botCommandList || []).map((c) => ({
        name: c.name,
        description: c.description,
        enabled: !disabled.includes(c.name),
      }));
      return send(res, 200, list);
    }

    if (path === "/api/commands" && req.method === "POST") {
      const body = await readBody(req);
      if (!client.guilds.cache.get(body.guild)) return send(res, 404, { error: "Server nicht gefunden" });
      storage.setCommandEnabled(body.guild, body.name, !!body.enabled);
      return send(res, 200, { ok: true });
    }

    if (path === "/api/backups" && req.method === "GET") {
      const guildId = url.searchParams.get("guild");
      if (!client.guilds.cache.get(guildId)) return send(res, 404, { available: false, backups: [], hours: 0 });
      const backups = storage.listBackups(guildId).map((b) => ({
        id: b.id,
        name: b.name,
        created: b.created,
        roles: b.roles.length,
        channels: b.channels.length,
      }));
      const hours = (storage.loadAutoSettings()[guildId] || {}).hours || 0;
      return send(res, 200, { available: true, backups, hours });
    }

    if (path === "/api/backups/create" && req.method === "POST") {
      const body = await readBody(req);
      const guild = client.guilds.cache.get(body.guild);
      if (!guild) return send(res, 404, { error: "nicht verfügbar" });
      const { snapshotGuild } = require("./backup.js");
      const name = `Dashboard - ${new Date().toLocaleString("de-DE")}`;
      storage.saveBackup(guild.id, snapshotGuild(guild, name));
      return send(res, 200, { ok: true });
    }

    if (path === "/api/backups/delete" && req.method === "POST") {
      const body = await readBody(req);
      if (!client.guilds.cache.get(body.guild)) return send(res, 404, { error: "nicht verfügbar" });
      storage.deleteBackup(body.guild, String(body.id || "").replace(/[/\\]/g, ""));
      return send(res, 200, { ok: true });
    }

    if (path === "/api/backups/interval" && req.method === "POST") {
      const body = await readBody(req);
      if (!client.guilds.cache.get(body.guild)) return send(res, 404, { error: "nicht verfügbar" });
      const hours = Number(body.hours);
      if (![0, 1, 6, 12, 24, 168].includes(hours)) return send(res, 400, { error: "ungültig" });
      storage.setAutoSettings(body.guild, hours);
      return send(res, 200, { ok: true });
    }

    send(res, 404, { error: "not found" });
  });

  const port = process.env.PORT || 8080;
  server.listen(port, () => console.log(`[Dashboard] läuft auf Port ${port}`));
}

const HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bot Dashboard</title>
<style>
  :root { --bg:#0f1117; --card:#181b24; --line:#262a36; --text:#e6e8ef; --muted:#8b91a3;
          --accent:#5865f2; --green:#3ba55d; --red:#ed4245; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,Segoe UI,sans-serif; background:var(--bg); color:var(--text); }
  header { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
           padding:16px 24px; border-bottom:1px solid var(--line); }
  h1 { font-size:20px; margin:0; }
  h2 { font-size:16px; margin:0 0 14px; }
  main { max-width:1000px; margin:0 auto; padding:24px; display:grid; gap:20px; }
  select, input, button { font:inherit; color:var(--text); background:var(--card);
           border:1px solid var(--line); border-radius:8px; padding:8px 12px; }
  button { cursor:pointer; background:var(--accent); border-color:var(--accent); }
  button.danger { background:transparent; border-color:var(--red); color:var(--red); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:18px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
  .stat { background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:14px; }
  .stat b { display:block; font-size:26px; }
  .stat span { color:var(--muted); font-size:13px; }
  .chart { display:flex; gap:10px; align-items:flex-end; height:140px; }
  .col { flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; height:100%; justify-content:flex-end; }
  .bars { display:flex; gap:3px; align-items:flex-end; height:100%; }
  .bar { width:14px; border-radius:4px 4px 0 0; min-height:2px; }
  .col small { color:var(--muted); font-size:11px; }
  .legend { color:var(--muted); font-size:13px; margin-top:10px; }
  .row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid var(--line); }
  .row:last-child { border-bottom:none; }
  .row small { color:var(--muted); display:block; }
  .switch { position:relative; width:44px; height:24px; flex:none; }
  .switch input { opacity:0; width:0; height:0; }
  .slider { position:absolute; inset:0; background:#3a3f4f; border-radius:24px; cursor:pointer; transition:.2s; }
  .slider:before { content:""; position:absolute; height:18px; width:18px; left:3px; top:3px; background:#fff; border-radius:50%; transition:.2s; }
  input:checked + .slider { background:var(--green); }
  input:checked + .slider:before { transform:translateX(20px); }
  .toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
  #login { position:fixed; inset:0; background:var(--bg); display:flex; align-items:center; justify-content:center; }
  #login form { display:grid; gap:12px; width:300px; }
  .err { color:var(--red); font-size:14px; min-height:18px; }
</style>
</head>
<body>

<div id="login">
  <form id="loginForm" class="card">
    <h2>🔒 Dashboard Login</h2>
    <input id="pw" type="password" placeholder="Passwort" autofocus>
    <button type="submit">Einloggen</button>
    <div class="err" id="loginErr"></div>
  </form>
</div>

<div id="app" style="display:none">
<header>
  <h1>🤖 Bot Dashboard</h1>
  <select id="guild"></select>
</header>

<main>
  <section class="card">
    <h2>📊 Statistik</h2>
    <div class="grid" id="stats"></div>
  </section>

  <section class="card">
    <h2>👥 Beitritte / Austritte (7 Tage)</h2>
    <div class="chart" id="chart"></div>
    <div class="legend">🟩 Beitritte &nbsp; 🟥 Austritte</div>
  </section>

  <section class="card">
    <h2>⚙️ Befehle</h2>
    <div id="commands"></div>
  </section>

  <section class="card" id="backupCard">
    <h2>📦 Backups</h2>
    <div class="toolbar">
      <button id="backupNow">Jetzt Backup erstellen</button>
      <label>Automatisch:
        <select id="interval">
          <option value="0">Aus</option>
          <option value="1">Jede Stunde</option>
          <option value="6">Alle 6 Stunden</option>
          <option value="12">Alle 12 Stunden</option>
          <option value="24">Täglich</option>
          <option value="168">Wöchentlich</option>
        </select>
      </label>
    </div>
    <div id="backups"></div>
    <div class="legend">Zum Laden eines Backups benutze in Discord <b>/backup laden</b>.</div>
  </section>
</main>
</div>

<script>
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let guild = null;

async function api(path, body) {
  const opts = body === undefined ? {} : { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body) };
  const r = await fetch(path, opts);
  if (r.status === 401 && path !== "/api/login") { $("#login").style.display = "flex"; $("#app").style.display = "none"; throw new Error("login"); }
  return r.json();
}

$("#loginForm").onsubmit = async e => {
  e.preventDefault();
  const r = await fetch("/api/login", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({password: $("#pw").value})});
  if (r.ok) { $("#login").style.display = "none"; $("#app").style.display = "block"; $("#pw").value = ""; init(); }
  else $("#loginErr").textContent = "Falsches Passwort";
};

async function init() {
  const guilds = await api("/api/guilds");
  const sel = $("#guild");
  sel.innerHTML = guilds.map(g => \`<option value="\${esc(g.id)}">\${esc(g.name)}</option>\`).join("");
  guild = sel.value;
  sel.onchange = () => { guild = sel.value; loadAll(); };
  loadAll();
}

function loadAll() { loadStats(); loadCommands(); loadBackups(); }

async function loadStats() {
  if (!guild) return;
  const s = await api("/api/stats?guild=" + guild);
  const humans = s.bots === null ? null : s.members - s.bots;
  const items = [["Mitglieder", s.members], ["Menschen", humans], ["Bots", s.bots], ["Online", s.online],
    ["Textkanäle", s.text], ["Sprachkanäle", s.voice], ["Rollen", s.roles], ["Boosts", s.boosts + " (Level " + s.tier + ")"], ["Erstellt am", s.created]];
  $("#stats").innerHTML = items.map(([k, v]) => \`<div class="stat"><b>\${v === null ? "–" : esc(v)}</b><span>\${esc(k)}</span></div>\`).join("");

  const max = Math.max(1, ...s.week.flatMap(d => [d.join, d.leave]));
  $("#chart").innerHTML = s.week.map(d => \`
    <div class="col">
      <div class="bars">
        <div class="bar" title="\${d.join} Beitritte" style="height:\${d.join / max * 100}px;background:var(--green)"></div>
        <div class="bar" title="\${d.leave} Austritte" style="height:\${d.leave / max * 100}px;background:var(--red)"></div>
      </div>
      <small>\${esc(d.day)}</small>
    </div>\`).join("");
}

async function loadCommands() {
  if (!guild) return;
  const cmds = await api("/api/commands?guild=" + guild);
  $("#commands").innerHTML = cmds.map(c => \`
    <div class="row">
      <div><b>/\${esc(c.name)}</b><small>\${esc(c.description)}</small></div>
      <label class="switch">
        <input type="checkbox" \${c.enabled ? "checked" : ""} data-name="\${esc(c.name)}">
        <span class="slider"></span>
      </label>
    </div>\`).join("") || "<small>Keine Befehle gefunden.</small>";
  document.querySelectorAll("#commands input").forEach(i => {
    i.onchange = () => api("/api/commands", {guild, name: i.dataset.name, enabled: i.checked});
  });
}

async function loadBackups() {
  if (!guild) return;
  const b = await api("/api/backups?guild=" + guild);
  $("#backupCard").style.display = b.available ? "block" : "none";
  $("#interval").value = b.hours;
  $("#backups").innerHTML = b.backups.map(x => \`
    <div class="row">
      <div><b>\${esc(x.name)}</b><small>\${new Date(x.created).toLocaleString("de-DE")} · \${x.roles} Rollen · \${x.channels} Kanäle</small></div>
      <button class="danger" data-id="\${esc(x.id)}">Löschen</button>
    </div>\`).join("") || "<small>Noch keine Backups.</small>";
  document.querySelectorAll("#backups button").forEach(btn => {
    btn.onclick = async () => { if (!confirm("Backup wirklich löschen?")) return; await api("/api/backups/delete", {guild, id: btn.dataset.id}); loadBackups(); };
  });
}

$("#backupNow").onclick = async () => { const btn = $("#backupNow"); btn.disabled = true; await api("/api/backups/create", {guild}); btn.disabled = false; loadBackups(); };
$("#interval").onchange = () => api("/api/backups/interval", {guild, hours: +$("#interval").value});

api("/api/guilds").then(() => { $("#login").style.display = "none"; $("#app").style.display = "block"; init(); }).catch(() => {});
setInterval(() => { if (guild) loadStats().catch(() => {}); }, 30000);
</script>
</body>
</html>`;

module.exports = { setup };
