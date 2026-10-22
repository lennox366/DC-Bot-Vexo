// storage.js
// Gemeinsamer Speicher, den backup.js und dashboard.js beide benutzen.
// Speichert alles als JSON-Dateien im Ordner BACKUP_DIR (Umgebungsvariable).
//
// WICHTIG für Render: Ohne eine Render-Disk gehen diese Dateien bei jedem
// Neustart verloren. Hänge eine Disk ein, z. B. unter /var/data, und setze
// BACKUP_DIR=/var/data/backups.

const fs = require("fs");
const path = require("path");

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "backups");
const SETTINGS_FILE = path.join(BACKUP_DIR, "dashboard_settings.json");
const AUTO_FILE = path.join(BACKUP_DIR, "auto_backup.json");
const STATS_FILE = path.join(BACKUP_DIR, "stats.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function guildDir(guildId) {
  const dir = path.join(BACKUP_DIR, String(guildId));
  ensureDir(dir);
  return dir;
}

// ---------------------------------------------------------------- Backups
function listBackups(guildId) {
  const dir = guildDir(guildId);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const backups = files.map((f) => readJson(path.join(dir, f), null)).filter(Boolean);
  backups.sort((a, b) => (a.created < b.created ? 1 : -1));
  return backups;
}

function saveBackup(guildId, data) {
  writeJson(path.join(guildDir(guildId), `${data.id}.json`), data);
  const backups = listBackups(guildId);
  const MAX = 25;
  for (const old of backups.slice(MAX)) deleteBackup(guildId, old.id);
}

function getBackup(guildId, id) {
  return readJson(path.join(guildDir(guildId), `${id}.json`), null);
}

function deleteBackup(guildId, id) {
  const p = path.join(guildDir(guildId), `${id}.json`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ------------------------------------------------------- Befehle an/aus
function loadDisabledCommands() {
  return readJson(SETTINGS_FILE, {});
}

function setCommandEnabled(guildId, name, enabled) {
  const settings = loadDisabledCommands();
  const list = settings[guildId] || [];
  const idx = list.indexOf(name);
  if (enabled && idx !== -1) list.splice(idx, 1);
  if (!enabled && idx === -1) list.push(name);
  settings[guildId] = list;
  writeJson(SETTINGS_FILE, settings);
}

function isCommandEnabled(guildId, name) {
  const settings = loadDisabledCommands();
  return !(settings[guildId] || []).includes(name);
}

// --------------------------------------------------------- Auto-Backup
function loadAutoSettings() {
  return readJson(AUTO_FILE, {});
}

function setAutoSettings(guildId, hours) {
  const settings = loadAutoSettings();
  settings[guildId] = { hours, last: new Date().toISOString() };
  writeJson(AUTO_FILE, settings);
}

function markAutoRan(guildId) {
  const settings = loadAutoSettings();
  if (settings[guildId]) {
    settings[guildId].last = new Date().toISOString();
    writeJson(AUTO_FILE, settings);
  }
}

// --------------------------------------------------- Beitritte/Austritte
function bumpStat(guildId, key) {
  const stats = readJson(STATS_FILE, {});
  const day = new Date().toISOString().slice(0, 10);
  stats[guildId] = stats[guildId] || {};
  stats[guildId][day] = stats[guildId][day] || { join: 0, leave: 0 };
  stats[guildId][day][key]++;
  const days = Object.keys(stats[guildId]).sort();
  for (const old of days.slice(0, -60)) delete stats[guildId][old];
  writeJson(STATS_FILE, stats);
}

function getWeekStats(guildId) {
  const stats = readJson(STATS_FILE, {})[guildId] || {};
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const day = stats[key] || { join: 0, leave: 0 };
    result.push({ day: key.slice(5), join: day.join, leave: day.leave });
  }
  return result;
}

module.exports = {
  BACKUP_DIR,
  listBackups,
  saveBackup,
  getBackup,
  deleteBackup,
  setCommandEnabled,
  isCommandEnabled,
  loadDisabledCommands,
  loadAutoSettings,
  setAutoSettings,
  markAutoRan,
  bumpStat,
  getWeekStats,
};
