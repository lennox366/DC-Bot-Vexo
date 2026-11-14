// logging.js
// WexRP Logging + sicherer Test aller tatsächlich eingerichteten Log-Events.
const fs = require("fs");
const path = require("path");
const { WebhookClient, EmbedBuilder } = require("discord.js");

const WEBHOOK_URL = process.env.LOG_WEBHOOK_URL;
const COLOR_ADD = 0x3ba55d;
const COLOR_REMOVE = 0xed4245;
const COLOR_EDIT = 0xfaa61a;
const COLOR_INFO = 0x5865f2;
const COLOR_WEXRP = 0x1d3557;

function trim(text, length = 1000) {
  if (!text) return "*(leer)*";
  text = String(text);
  return text.length <= length ? text : text.slice(0, length - 3) + "...";
}

function createWebhook() {
  if (!WEBHOOK_URL) return null;
  try { return new WebhookClient({ url: WEBHOOK_URL }); }
  catch (error) {
    console.error("[Logging] Ungültige LOG_WEBHOOK_URL:", error.message);
    return null;
  }
}

async function sendLog(client, embed, user) {
  const webhook = client?.wexrpLogWebhook;
  const channelId = client?.wexrpLogChannelId || process.env.BOT_LOG_CHANNEL_ID || null;
  embed.setTimestamp(new Date());
  if (user) {
    embed.setFooter({
      text: `${user.tag || user.username || user.name || "Unbekannt"} (${user.id})`
    });
  }
  if (webhook) {
    return webhook.send({ embeds: [embed], username: "WexRP | Server-Logs" });
  }
  if (!channelId) {
    throw new Error("Weder LOG_WEBHOOK_URL noch BOT_LOG_CHANNEL_ID verfügbar.");
  }
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Log-Kanal ${channelId} nicht erreichbar.`);
  }
  return channel.send({ embeds: [embed] });
}

function setup(client) {
  const webhook = createWebhook();
  const channelId = process.env.BOT_LOG_CHANNEL_ID || null;

  if (!webhook && !channelId) {
    console.log("[Logging] Weder LOG_WEBHOOK_URL noch BOT_LOG_CHANNEL_ID gesetzt - Logging ist AUS.");
    return;
  }

  // Verhindert versehentliche doppelte Registrierung dieses Moduls.
  if (client.__wexrpLoggingSetup) {
    console.warn("[Logging] setup(client) wurde bereits ausgeführt; überspringe doppelte Listener.");
    return;
  }
  client.__wexrpLoggingSetup = true;
  client.wexrpLogWebhook = webhook;
  client.wexrpLogChannelId = channelId;
  if (!webhook) {
    console.log(`[Logging] Kein Webhook - Logs werden stattdessen in Kanal ${channelId} gesendet.`);
  }

  async function log(embed, user) {
    try { await sendLog(client, embed, user); }
    catch (e) { console.error("[Logging] Konnte nicht senden:", e.message); }
  }

  client.on("messageDelete", async (message) => {
    if (message.author?.bot || !message.guild) return;
    const e = new EmbedBuilder().setTitle("🗑️ Nachricht gelöscht")
      .setDescription(`**Kanal:** <#${message.channel.id}>\\n**Von:** <@${message.author?.id}>`)
      .addFields({ name: "Inhalt", value: trim(message.content) }).setColor(COLOR_REMOVE);
    if (message.attachments?.size) e.addFields({ name: "Anhänge", value: trim([...message.attachments.values()].map(a => a.name).join("\\n"), 1000) });
    await log(e, message.author);
  });

  client.on("messageUpdate", async (before, after) => {
    if (before.author?.bot || !before.guild || before.content === after.content) return;
    const e = new EmbedBuilder().setTitle("✏️ Nachricht bearbeitet")
      .setDescription(`**Kanal:** <#${before.channel.id}>\\n**Von:** <@${before.author?.id}> [Zur Nachricht](${after.url})`)
      .addFields({ name: "Vorher", value: trim(before.content) }, { name: "Nachher", value: trim(after.content) })
      .setColor(COLOR_EDIT);
    await log(e, before.author);
  });

  client.on("guildMemberAdd", async member => {
    const days = Math.floor((Date.now() - member.user.createdAt.getTime()) / 86400000);
    await log(new EmbedBuilder().setTitle("📥 Mitglied beigetreten")
      .setDescription(`<@${member.id}> ist dem Server beigetreten.\\nAccount erstellt vor ${days} Tagen.`)
      .setThumbnail(member.user.displayAvatarURL()).setColor(COLOR_ADD), member.user);
  });

  client.on("guildMemberRemove", async member => {
    const roles = member.roles?.cache
      ? [...member.roles.cache.values()].filter(r => r.id !== member.guild.id).map(r => `<@&${r.id}>`).join(", ") || "keine"
      : "unbekannt";
    await log(new EmbedBuilder().setTitle("📤 Mitglied hat den Server verlassen")
      .setDescription(`**${member.user.tag}** hat den Server verlassen.\\n**Rollen:** ${trim(roles, 500)}`)
      .setColor(COLOR_REMOVE), member.user);
  });

  client.on("guildBanAdd", async ban => log(new EmbedBuilder().setTitle("🔨 Mitglied gebannt")
    .setDescription(`**${ban.user.tag}** wurde gebannt.`).setColor(COLOR_REMOVE), ban.user));
  client.on("guildBanRemove", async ban => log(new EmbedBuilder().setTitle("⚒️ Bann aufgehoben")
    .setDescription(`**${ban.user.tag}** wurde entbannt.`).setColor(COLOR_ADD), ban.user));

  client.on("guildMemberUpdate", async (before, after) => {
    if (before.nickname !== after.nickname) {
      await log(new EmbedBuilder().setTitle("✏️ Nickname geändert")
        .setDescription(`<@${after.id}>\\n**Vorher:** ${trim(before.nickname || before.user.username, 200)}\\n**Nachher:** ${trim(after.nickname || after.user.username, 200)}`)
        .setColor(COLOR_EDIT), after.user);
    }
    const b = new Set(before.roles.cache.keys()), a = new Set(after.roles.cache.keys());
    const added = [...a].filter(id => !b.has(id)), removed = [...b].filter(id => !a.has(id));
    if (added.length) await log(new EmbedBuilder().setTitle("➕ Rolle(n) hinzugefügt")
      .setDescription(`<@${after.id}>: ${added.map(id => `<@&${id}>`).join(", ")}`).setColor(COLOR_ADD), after.user);
    if (removed.length) await log(new EmbedBuilder().setTitle("➖ Rolle(n) entfernt")
      .setDescription(`<@${after.id}>: ${removed.map(id => `<@&${id}>`).join(", ")}`).setColor(COLOR_REMOVE), after.user);
    if (before.communicationDisabledUntilTimestamp !== after.communicationDisabledUntilTimestamp && after.communicationDisabledUntilTimestamp) {
      await log(new EmbedBuilder().setTitle("🔇 Timeout gesetzt")
        .setDescription(`<@${after.id}> ist stummgeschaltet bis <t:${Math.floor(after.communicationDisabledUntilTimestamp / 1000)}:f>`)
        .setColor(COLOR_REMOVE), after.user);
    }
  });

  client.on("roleCreate", async role => log(new EmbedBuilder().setTitle("🆕 Rolle erstellt").setDescription(`**${role.name}**`).setColor(COLOR_ADD)));
  client.on("roleDelete", async role => log(new EmbedBuilder().setTitle("🗑️ Rolle gelöscht").setDescription(`**${role.name}**`).setColor(COLOR_REMOVE)));
  client.on("roleUpdate", async (before, after) => {
    const changes = [];
    if (before.name !== after.name) changes.push(`Name: \`${before.name}\` → \`${after.name}\``);
    if (before.hexColor !== after.hexColor) changes.push(`Farbe: \`${before.hexColor}\` → \`${after.hexColor}\``);
    if (!before.permissions.equals(after.permissions)) changes.push("Berechtigungen geändert");
    if (changes.length) await log(new EmbedBuilder().setTitle("✏️ Rolle geändert")
      .setDescription(`**${after.name}**\\n${changes.join("\\n")}`).setColor(COLOR_EDIT));
  });

  client.on("channelCreate", async ch => { if (ch.guild) await log(new EmbedBuilder().setTitle("🆕 Kanal erstellt").setDescription(`**${ch.name}**`).setColor(COLOR_ADD)); });
  client.on("channelDelete", async ch => { if (ch.guild) await log(new EmbedBuilder().setTitle("🗑️ Kanal gelöscht").setDescription(`**${ch.name}**`).setColor(COLOR_REMOVE)); });
  client.on("channelUpdate", async (before, after) => {
    if (!after.guild) return;
    const changes = [];
    if (before.name !== after.name) changes.push(`Name: \`${before.name}\` → \`${after.name}\``);
    if (before.topic !== after.topic) changes.push("Thema geändert");
    if (changes.length) await log(new EmbedBuilder().setTitle("✏️ Kanal geändert")
      .setDescription(`**${after.name}**\\n${changes.join("\\n")}`).setColor(COLOR_EDIT));
  });

  client.on("guildUpdate", async (before, after) => {
    const changes = [];
    if (before.name !== after.name) changes.push(`Name: \`${before.name}\` → \`${after.name}\``);
    if (before.icon !== after.icon) changes.push("Server-Icon geändert");
    if (before.premiumTier !== after.premiumTier) changes.push(`Boost-Level: ${before.premiumTier} → ${after.premiumTier}`);
    if (changes.length) await log(new EmbedBuilder().setTitle("⚙️ Servereinstellungen geändert")
      .setDescription(changes.join("\\n")).setColor(COLOR_EDIT));
  });

  client.on("voiceStateUpdate", async (before, after) => {
    const member = after.member || before.member;
    if (!member) return;
    if (before.channelId === after.channelId) {
      if (before.mute !== after.mute || before.deaf !== after.deaf) {
        await log(new EmbedBuilder().setTitle("🎙️ Sprachstatus geändert")
          .setDescription(`<@${member.id}> in ${after.channel ? `<#${after.channel.id}>` : "-"}\\nStumm: ${after.mute} | Taub: ${after.deaf}`)
          .setColor(COLOR_INFO), member.user);
      }
      return;
    }
    let e;
    if (before.channel && after.channel) e = new EmbedBuilder().setTitle("🔀 Sprachkanal gewechselt").setDescription(`<@${member.id}>: <#${before.channel.id}> → <#${after.channel.id}>`).setColor(COLOR_INFO);
    else if (after.channel) e = new EmbedBuilder().setTitle("🔊 Sprachkanal beigetreten").setDescription(`<@${member.id}> ist <#${after.channel.id}> beigetreten.`).setColor(COLOR_ADD);
    else e = new EmbedBuilder().setTitle("🔈 Sprachkanal verlassen").setDescription(`<@${member.id}> hat <#${before.channel.id}> verlassen.`).setColor(COLOR_REMOVE);
    await log(e, member.user);
  });
}

// Sammelt alle im Bot konfigurierten Log-Ziele:
// Kanäle aus log-kanal-ids.json, Discord-Logger, index.js-Konstanten,
// logger.js (BOT_LOG_CHANNEL_ID), Ticket-System.json und Webhooks (LOG_WEBHOOK_URL, RP-Logs).
function collectLogTargets() {
  const channels = new Map(); // channelId -> [labels]
  const webhooks = [];        // { name, url }

  const addChannel = (id, label) => {
    id = String(id || "").trim();
    if (!/^\d{17,20}$/.test(id)) return;
    if (!channels.has(id)) channels.set(id, []);
    const names = channels.get(id);
    if (!names.includes(label)) names.push(label);
  };

  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "log-kanal-ids.json"), "utf8"));
    for (const [key, val] of Object.entries(cfg)) {
      if (val && val.channel_id) addChannel(val.channel_id, val.name || key);
    }
  } catch (e) {
    console.error("[Logging] log-kanal-ids.json konnte nicht gelesen werden:", e.message);
  }

  try {
    const { CONFIG } = require("./Discord-Logger");
    if (CONFIG && CONFIG.logChannelId) addChannel(CONFIG.logChannelId, "Discord-Logger (Server-Events)");
  } catch (e) {
    console.error("[Logging] Discord-Logger-Konfiguration nicht lesbar:", e.message);
  }

  for (const [label, id] of Object.entries(global.__wexrpIndexLogChannels || {})) {
    addChannel(id, label);
  }

  addChannel(process.env.BOT_LOG_CHANNEL_ID, "Zentrales Log-System (logger.js)");

  try {
    const ticketCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "Ticket-System.json"), "utf8"));
    for (const [guildId, cfg] of Object.entries(ticketCfg.guilds || {})) {
      if (cfg && cfg.logChannelId) addChannel(cfg.logChannelId, `Ticket-System (${guildId})`);
    }
  } catch (e) {
    console.error("[Logging] Ticket-System.json konnte nicht gelesen werden:", e.message);
  }

  if (process.env.LOG_WEBHOOK_URL) {
    webhooks.push({ name: "WexRP Logging (LOG_WEBHOOK_URL)", url: process.env.LOG_WEBHOOK_URL });
  }

  try {
    const rpLogs = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "rp-logs.json"), "utf8"));
    for (const [guildId, cfg] of Object.entries(rpLogs)) {
      if (cfg && cfg.webhookUrl) {
        webhooks.push({ name: `RP-Logs Webhook (${guildId})`, url: cfg.webhookUrl });
      }
    }
  } catch (e) {
    console.error("[Logging] data/rp-logs.json konnte nicht gelesen werden:", e.message);
  }

  return {
    channels: [...channels.entries()].map(([id, names]) => ({ id, names })),
    webhooks
  };
}

function buildLogTestEmbed(label, executor) {
  return new EmbedBuilder()
    .setColor(COLOR_WEXRP)
    .setTitle("🧪 Log-System Test")
    .setDescription("Dies ist eine automatische Testnachricht. Es wurde keine echte Serveraktion ausgeführt.")
    .addFields(
      { name: "Log-Bereich", value: label, inline: true },
      { name: "Status", value: "🟢 Log-Nachricht erfolgreich gesendet", inline: true },
      { name: "Ausgelöst durch", value: executor ? `${executor.tag || executor.username} (${executor.id})` : "System" }
    )
    .setFooter({ text: "Log-Test" })
    .setTimestamp();
}

// Sendet eine Testnachricht an JEDES konfigurierte Log-Ziel des Bots
// (alle Kanäle aus log-kanal-ids.json, Discord-Logger, index.js,
// logger.js, Ticket-System sowie alle konfigurierten Webhooks).
// Es werden ausschließlich Test-Embeds gesendet – keine echten Serveraktionen.
async function runLogTest(client, executor) {
  const { channels, webhooks } = collectLogTargets();
  const results = [];

  for (const target of channels) {
    const label = `${target.names.join(" + ")} (#${target.id})`;
    try {
      const channel = await client.channels.fetch(target.id).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        throw new Error("Kanal nicht gefunden oder kein Textkanal");
      }
      await channel.send({ embeds: [buildLogTestEmbed(label, executor)] });
      results.push({ category: label, ok: true });
    } catch (error) {
      results.push({ category: label, ok: false, error: error.message });
    }
  }

  for (const hook of webhooks) {
    try {
      const webhook = new WebhookClient({ url: hook.url });
      try {
        await webhook.send({ embeds: [buildLogTestEmbed(hook.name, executor)] });
      } finally {
        webhook.destroy();
      }
      results.push({ category: hook.name, ok: true });
    } catch (error) {
      results.push({ category: hook.name, ok: false, error: error.message });
    }
  }

  if (!results.length) {
    throw new Error("Keine Log-Ziele konfiguriert gefunden (log-kanal-ids.json, .env, Ticket-System.json).");
  }
  return results;
}

module.exports = { setup, runLogTest };
