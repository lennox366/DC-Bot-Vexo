"use strict";
// NoVex RP Aktiv-Check | Discord.js v14 | Node.js >= 18
const fs = require('fs');
const path = require('path');
const { EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const FILE = path.join(__dirname, 'aktiv-check-data.json');
const CONFIG_FILE = path.join(__dirname, 'aktiv-check-config.json');
const CHANNEL_ID = '1564329375724208138'; // Fallback (alt)
const STAFF_ROLE_ID = '1564307287068123186'; // Fallback (alt)
const TEAM_ONE_ROLE_ID = '1564307287068123186'; // Fallback (alt)
const DURATION = 2 * 60 * 60 * 1000;
const PENALTY = 14 * 24 * 60 * 60 * 1000;
const ZONE = 'Europe/Berlin';
const COMMANDS = [
  { name: 'aktiv-check', description: 'Wöchentlichen Team-Aktivitätscheck verwalten', options: [
    { type: 1, name: 'aktivieren', description: 'Automatischen Check jeden Mittwoch um 18:00 aktivieren' },
    { type: 1, name: 'deaktivieren', description: 'Automatischen Check deaktivieren' },
    { type: 1, name: 'test', description: 'Jetzt einen vollständigen 2-Stunden-Test starten' },
    { type: 1, name: 'einstellungen', description: 'Kanal und Rollen für den Aktiv-Check festlegen', options: [
      { type: 7, name: 'kanal', description: 'Kanal für den Aktiv-Check', required: false },
      { type: 8, name: 'staff-rolle', description: 'Staff-Rolle (Check-Berechtigte)', required: false },
      { type: 8, name: 'straf-rolle', description: 'Strafrolle bei Nicht-Reaktion', required: false }
    ] }
  ] },
  { name: 'aktiv-check-test', description: 'Jetzt einen Aktiv-Check als Test starten' }
];
function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') console.error('[Aktiv-Check] Lesefehler:', e); return { enabledGuilds: {}, active: {}, penalties: {}, lastWeek: {} }; }
}
const state = read();
for (const key of ['enabledGuilds','active','penalties','lastWeek']) state[key] ||= {};
function save() { const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state, null, 2)); fs.renameSync(tmp, FILE); }
function loadConfigs() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {}; }
  catch (e) { return {}; }
}
function saveConfigs(c) { const tmp = CONFIG_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(c, null, 2)); fs.renameSync(tmp, CONFIG_FILE); }
function getConfig(guildId) {
  const all = loadConfigs();
  const c = all[guildId] || {};
  return {
    channelId: c.channelId || CHANNEL_ID,
    staffRoleId: c.staffRoleId || STAFF_ROLE_ID,
    penaltyRoleId: c.penaltyRoleId || TEAM_ONE_ROLE_ID
  };
}
function berlinParts(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone: ZONE, weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return { ...parts, dayKey: `${parts.year}-${parts.month}-${parts.day}` };
}
function isAdmin(interaction) { return interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild) || interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator); }
async function getChannel(guild) {
  const channelId = getConfig(guild.id).channelId;
  const channel = await guild.channels.fetch(channelId).catch(()=>null);
  return channel?.isTextBased() && channel.guildId === guild.id ? channel : null;
}
async function startCheck(guild, test = false) {
  if (state.active[guild.id]) throw new Error('Es läuft bereits ein Aktiv-Check.');
  const cfg = getConfig(guild.id);
  const channel = await getChannel(guild);
  if (!channel) throw new Error(`Der konfigurierte Kanal (${cfg.channelId}) ist auf diesem Server nicht erreichbar. Bitte mit /aktiv-check einstellungen den Kanal setzen.`);
  const staffRole = await guild.roles.fetch(cfg.staffRoleId).catch(()=>null);
  const penaltyRole = await guild.roles.fetch(cfg.penaltyRoleId).catch(()=>null);
  if (!staffRole) throw new Error(`Staff-Rolle fehlt: ${cfg.staffRoleId}. Bitte mit /aktiv-check einstellungen setzen.`);
  if (!penaltyRole) throw new Error(`Strafrolle fehlt: ${cfg.penaltyRoleId}. Bitte mit /aktiv-check einstellungen setzen.`);
  // Teilnehmer zu Beginn festhalten, damit neue Teammitglieder nicht rückwirkend bestraft werden.
  const members = await guild.members.fetch();
  const eligible = [...members.values()].filter(m=>!m.user.bot && m.roles.cache.has(cfg.staffRoleId)).map(m=>m.id);
  const now = Date.now();
  const embed = new EmbedBuilder().setColor(0x2787ff)
    .setTitle(test ? '🧪 Novex RP | AKTIV-CHECK TEST' : '💙 Novex RP | WÖCHENTLICHER AKTIV-CHECK')
    .setDescription('**Team, zeigt eure Aktivität!**\n\nReagiere innerhalb von **2 Stunden** auf diese Nachricht mit **✅**.\n\nWer bis zum Ablauf nicht reagiert, erhält **Team One für 14 Tage**.\n\n⏳ **Ende:** <t:' + Math.floor((now+DURATION)/1000) + ':R>\n👥 **Teilnahmeberechtigte Teammitglieder:** ' + eligible.length + '\n\n*Nur die Reaktion direkt unter dieser Nachricht zählt.*')
    .setFooter({text:'Vexo RP • Automatischer Team-Aktivitätscheck'}).setTimestamp();
  const message = await channel.send({content:`<@&${cfg.staffRoleId}>`, allowedMentions:{roles:[cfg.staffRoleId]}, embeds:[embed]});
  state.active[guild.id] = { channelId:channel.id, messageId:message.id, endsAt:now+DURATION, eligible, test };
  save();
  await message.react('✅').catch(e=>console.warn('[Aktiv-Check] Reaktion konnte nicht gesetzt werden:',e));
  return message;
}
async function finishCheck(client, guildId) {
  const check = state.active[guildId]; if (!check || Date.now() < check.endsAt) return;
  const guild = await client.guilds.fetch(guildId).catch(()=>null); if (!guild) return;
  const channel = await guild.channels.fetch(check.channelId).catch(()=>null);
  const message = await channel?.messages.fetch(check.messageId).catch(()=>null);
  // Bei fehlender Nachricht nicht bestrafen: Reaktionen können nicht sicher ermittelt werden.
  if (!message) { console.warn('[Aktiv-Check] Nachricht fehlt; keine Strafen:', guildId); delete state.active[guildId]; save(); return; }
  const reaction = message.reactions.cache.find(r=>r.emoji.name==='✅');
  const reacted = new Set();
  if (reaction) {
    let after;
    while (true) {
      const page = await reaction.users.fetch({limit:100, ...(after?{after}:{})});
      for (const user of page.values()) if (!user.bot) reacted.add(user.id);
      if (page.size < 100) break;
      after = page.last().id;
    }
  }
  const missing = check.eligible.filter(id=>!reacted.has(id));
  const expiry = Date.now()+PENALTY;
  const cfg = getConfig(guild.id);
  const failures = [];
  for (const id of missing) {
    const member = await guild.members.fetch(id).catch(()=>null);
    if (!member || !member.roles.cache.has(cfg.staffRoleId)) continue;
    if (member.roles.cache.has(cfg.penaltyRoleId)) continue; // Fremde bestehende Strafrolle nicht später entfernen.
    try {
      await member.roles.add(cfg.penaltyRoleId, 'Aktiv-Check: keine Reaktion innerhalb von 2 Stunden');
      state.penalties[`${guildId}:${id}`] = { guildId, userId:id, expiresAt:expiry };
      save();
    } catch (e) { failures.push(id); console.error('[Aktiv-Check] Rolle konnte nicht vergeben werden:', id, e); }
  }
  await message.delete().catch(e=>console.warn('[Aktiv-Check] Nachricht konnte nicht gelöscht werden:',e));
  delete state.active[guildId]; save();
  console.log(`[Aktiv-Check] Fertig ${guildId}: ${reacted.size} Reaktionen, ${missing.length} ohne Reaktion, ${failures.length} Rollenfehler.`);
}
async function expirePenalties(client) {
  for (const [key, entry] of Object.entries(state.penalties)) {
    if (Date.now() < entry.expiresAt) continue;
    const guild = await client.guilds.fetch(entry.guildId).catch(()=>null);
    if (!guild) continue;
    const member = await guild.members.fetch(entry.userId).catch(()=>null);
    const cfg = getConfig(entry.guildId);
    if (!member || !member.roles.cache.has(cfg.penaltyRoleId)) { delete state.penalties[key]; save(); continue; }
    try { await member.roles.remove(cfg.penaltyRoleId, 'Aktiv-Check: 14 Tage abgelaufen'); delete state.penalties[key]; save(); }
    catch(e) { console.error('[Aktiv-Check] Rolle konnte nicht entfernt werden:', key,e); }
  }
}
let busy = false;
async function tick(client) {
  if (busy) return; busy = true;
  try {
    for (const id of Object.keys(state.active)) await finishCheck(client,id);
    await expirePenalties(client);
    const p = berlinParts();
    if (p.weekday !== 'Wed' || Number(p.hour) < 18) return;
    for (const [id, enabled] of Object.entries(state.enabledGuilds)) {
      if (!enabled || state.lastWeek[id] === p.dayKey || state.active[id]) continue;
      // Vor Versand reservieren, damit Neustarts nicht mehrfach posten.
      state.lastWeek[id] = p.dayKey; save();
      const guild = await client.guilds.fetch(id).catch(()=>null);
      if (!guild) continue;
      try { await startCheck(guild); } catch(e) { console.error('[Aktiv-Check] Automatischer Start fehlgeschlagen:',id,e); }
    }
  } catch(e) { console.error('[Aktiv-Check] Zeitplanfehler:',e); }
  finally { busy = false; }
}
function registerAktivCheckSystem(client) {
  client.once('clientReady', ()=>{ tick(client); const timer = setInterval(()=>tick(client),60_000); timer.unref?.(); console.log('[Aktiv-Check] Zeitplan gestartet (Mittwoch 18:00 Europe/Berlin).'); });
}
async function handleAktivCheckCommand(interaction) {
  if (!interaction.isChatInputCommand() || !['aktiv-check','aktiv-check-test'].includes(interaction.commandName)) return false;
  if (!interaction.inGuild()) { await interaction.reply({content:'❌ Nur auf einem Server möglich.',flags:MessageFlags.Ephemeral}); return true; }
  if (!isAdmin(interaction)) { await interaction.reply({content:'❌ Du brauchst „Server verwalten“ oder Administrator.',flags:MessageFlags.Ephemeral}); return true; }
  const sub = interaction.commandName==='aktiv-check-test'?'test':interaction.options.getSubcommand();
  if (sub==='einstellungen') {
    const all = loadConfigs();
    const cur = all[interaction.guildId] || {};
    const kanal = interaction.options.getChannel('kanal');
    const staffRolle = interaction.options.getRole('staff-rolle');
    const strafRolle = interaction.options.getRole('straf-rolle');
    if (kanal) cur.channelId = kanal.id;
    if (staffRolle) cur.staffRoleId = staffRolle.id;
    if (strafRolle) cur.penaltyRoleId = strafRolle.id;
    if (!kanal && !staffRolle && !strafRolle) {
      const c = getConfig(interaction.guildId);
      return interaction.reply({content:`**Aktiv-Check Einstellungen**\n• Kanal: <#${c.channelId}>\n• Staff-Rolle: <@&${c.staffRoleId}>\n• Strafrolle: <@&${c.penaltyRoleId}>\n\nZum Ändern die Optionen angeben.`,flags:MessageFlags.Ephemeral});
    }
    all[interaction.guildId] = cur; saveConfigs(all);
    return interaction.reply({content:'✅ Aktiv-Check-Einstellungen gespeichert.',flags:MessageFlags.Ephemeral});
  }
  if (sub==='aktivieren') { state.enabledGuilds[interaction.guildId]=true; save(); await interaction.reply({content:'✅ Aktiviert! Jeden Mittwoch um **18:00 Uhr (deutsche Zeit)** startet der 2-Stunden-Aktiv-Check. Mit `/aktiv-check test` kannst du sofort testen.',flags:MessageFlags.Ephemeral}); return true; }
  if (sub==='deaktivieren') { state.enabledGuilds[interaction.guildId]=false; save(); await interaction.reply({content:'✅ Automatische Checks deaktiviert. Ein bereits laufender Check endet weiterhin regulär.',flags:MessageFlags.Ephemeral}); return true; }
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  try { const message = await startCheck(interaction.guild,true); await interaction.editReply({content:`✅ Test-Aktiv-Check gesendet: ${message.url}\nDer Test läuft **2 Stunden** und vergibt danach bei fehlender Reaktion ebenfalls Team One für 14 Tage.`}); }
  catch(e) { await interaction.editReply({content:`❌ ${e.message}`}); }
  return true;
}
module.exports = { aktivCheckCommands:COMMANDS, registerAktivCheckSystem, handleAktivCheckCommand };
