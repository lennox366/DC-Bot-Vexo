// logging.js
// Protokolliert Server-Ereignisse über einen Webhook in deinen Log-Kanal.
//
// Umgebungsvariable (PFLICHT):
//   LOG_WEBHOOK_URL   die Webhook-URL deines Log-Kanals
//
// Braucht intents.GuildMembers und intents.MessageContent, um Inhalte
// gelöschter/bearbeiteter Nachrichten zu sehen.

const { WebhookClient, EmbedBuilder } = require("discord.js");

const WEBHOOK_URL = process.env.LOG_WEBHOOK_URL;

const COLOR_ADD = 0x3ba55d;
const COLOR_REMOVE = 0xed4245;
const COLOR_EDIT = 0xfaa61a;
const COLOR_INFO = 0x5865f2;

function trim(text, length = 1000) {
  if (!text) return "*(leer)*";
  text = String(text);
  return text.length <= length ? text : text.slice(0, length - 3) + "...";
}

function setup(client) {
  if (!WEBHOOK_URL) {
    console.log("[Logging] LOG_WEBHOOK_URL ist nicht gesetzt - Logging ist AUS.");
    return;
  }
  const webhook = new WebhookClient({ url: WEBHOOK_URL });

  async function log(embed, user) {
    embed.setTimestamp(new Date());
    if (user) embed.setFooter({ text: `${user.tag || user.name} (${user.id})`, iconURL: user.displayAvatarURL?.() });
    try {
      await webhook.send({ embeds: [embed], username: "Server-Log" });
    } catch (e) {
      console.error("[Logging] Konnte nicht senden:", e.message);
    }
  }

  // --- Nachrichten ---
  client.on("messageDelete", async (message) => {
    if (message.author?.bot || !message.guild) return;
    const e = new EmbedBuilder()
      .setTitle("🗑️ Nachricht gelöscht")
      .setDescription(`**Kanal:** <#${message.channel.id}>\n**Von:** <@${message.author?.id}>`)
      .addFields({ name: "Inhalt", value: trim(message.content) })
      .setColor(COLOR_REMOVE);
    if (message.attachments?.size) {
      e.addFields({ name: "Anhänge", value: [...message.attachments.values()].map((a) => a.name).join("\n") });
    }
    await log(e, message.author);
  });

  client.on("messageUpdate", async (before, after) => {
    if (before.author?.bot || !before.guild || before.content === after.content) return;
    const e = new EmbedBuilder()
      .setTitle("✏️ Nachricht bearbeitet")
      .setDescription(`**Kanal:** <#${before.channel.id}>\n**Von:** <@${before.author?.id}> [Zur Nachricht](${after.url})`)
      .addFields({ name: "Vorher", value: trim(before.content) }, { name: "Nachher", value: trim(after.content) })
      .setColor(COLOR_EDIT);
    await log(e, before.author);
  });

  // --- Mitglieder ---
  client.on("guildMemberAdd", async (member) => {
    const days = Math.floor((Date.now() - member.user.createdAt.getTime()) / 86400000);
    const e = new EmbedBuilder()
      .setTitle("📥 Mitglied beigetreten")
      .setDescription(`<@${member.id}> ist dem Server beigetreten.\nAccount erstellt vor ${days} Tagen.`)
      .setThumbnail(member.user.displayAvatarURL())
      .setColor(COLOR_ADD);
    await log(e, member.user);
  });

  client.on("guildMemberRemove", async (member) => {
    const roles = member.roles?.cache
      ? [...member.roles.cache.values()].filter((r) => r.id !== member.guild.id).map((r) => `<@&${r.id}>`).join(", ") || "keine"
      : "unbekannt";
    const e = new EmbedBuilder()
      .setTitle("📤 Mitglied hat den Server verlassen")
      .setDescription(`**${member.user.tag}** hat den Server verlassen.\n**Rollen:** ${trim(roles, 500)}`)
      .setColor(COLOR_REMOVE);
    await log(e, member.user);
  });

  client.on("guildBanAdd", async (ban) => {
    const e = new EmbedBuilder().setTitle("🔨 Mitglied gebannt").setDescription(`**${ban.user.tag}** wurde gebannt.`).setColor(COLOR_REMOVE);
    await log(e, ban.user);
  });

  client.on("guildBanRemove", async (ban) => {
    const e = new EmbedBuilder().setTitle("⚒️ Bann aufgehoben").setDescription(`**${ban.user.tag}** wurde entbannt.`).setColor(COLOR_ADD);
    await log(e, ban.user);
  });

  client.on("guildMemberUpdate", async (before, after) => {
    if (before.nickname !== after.nickname) {
      const e = new EmbedBuilder()
        .setTitle("✏️ Nickname geändert")
        .setDescription(`<@${after.id}>\n**Vorher:** ${trim(before.nickname || before.user.username, 200)}\n**Nachher:** ${trim(after.nickname || after.user.username, 200)}`)
        .setColor(COLOR_EDIT);
      await log(e, after.user);
    }

    const beforeRoles = new Set(before.roles.cache.keys());
    const afterRoles = new Set(after.roles.cache.keys());
    const added = [...afterRoles].filter((id) => !beforeRoles.has(id));
    const removed = [...beforeRoles].filter((id) => !afterRoles.has(id));
    if (added.length) {
      const e = new EmbedBuilder().setTitle("➕ Rolle(n) hinzugefügt").setDescription(`<@${after.id}>: ${added.map((id) => `<@&${id}>`).join(", ")}`).setColor(COLOR_ADD);
      await log(e, after.user);
    }
    if (removed.length) {
      const e = new EmbedBuilder().setTitle("➖ Rolle(n) entfernt").setDescription(`<@${after.id}>: ${removed.map((id) => `<@&${id}>`).join(", ")}`).setColor(COLOR_REMOVE);
      await log(e, after.user);
    }

    if (before.communicationDisabledUntilTimestamp !== after.communicationDisabledUntilTimestamp && after.communicationDisabledUntilTimestamp) {
      const e = new EmbedBuilder()
        .setTitle("🔇 Timeout gesetzt")
        .setDescription(`<@${after.id}> ist stummgeschaltet bis <t:${Math.floor(after.communicationDisabledUntilTimestamp / 1000)}:f>`)
        .setColor(COLOR_REMOVE);
      await log(e, after.user);
    }
  });

  // --- Rollen ---
  client.on("roleCreate", async (role) => {
    await log(new EmbedBuilder().setTitle("🆕 Rolle erstellt").setDescription(`**${role.name}**`).setColor(COLOR_ADD));
  });
  client.on("roleDelete", async (role) => {
    await log(new EmbedBuilder().setTitle("🗑️ Rolle gelöscht").setDescription(`**${role.name}**`).setColor(COLOR_REMOVE));
  });
  client.on("roleUpdate", async (before, after) => {
    const changes = [];
    if (before.name !== after.name) changes.push(`Name: \`${before.name}\` → \`${after.name}\``);
    if (before.hexColor !== after.hexColor) changes.push(`Farbe: \`${before.hexColor}\` → \`${after.hexColor}\``);
    if (!before.permissions.equals(after.permissions)) changes.push("Berechtigungen geändert");
    if (!changes.length) return;
    await log(new EmbedBuilder().setTitle("✏️ Rolle geändert").setDescription(`**${after.name}**\n${changes.join("\n")}`).setColor(COLOR_EDIT));
  });

  // --- Kanäle ---
  client.on("channelCreate", async (channel) => {
    if (!channel.guild) return;
    await log(new EmbedBuilder().setTitle("🆕 Kanal erstellt").setDescription(`**${channel.name}**`).setColor(COLOR_ADD));
  });
  client.on("channelDelete", async (channel) => {
    if (!channel.guild) return;
    await log(new EmbedBuilder().setTitle("🗑️ Kanal gelöscht").setDescription(`**${channel.name}**`).setColor(COLOR_REMOVE));
  });
  client.on("channelUpdate", async (before, after) => {
    if (!after.guild) return;
    const changes = [];
    if (before.name !== after.name) changes.push(`Name: \`${before.name}\` → \`${after.name}\``);
    if (before.topic !== after.topic) changes.push("Thema geändert");
    if (!changes.length) return;
    await log(new EmbedBuilder().setTitle("✏️ Kanal geändert").setDescription(`**${after.name}**\n${changes.join("\n")}`).setColor(COLOR_EDIT));
  });

  // --- Server ---
  client.on("guildUpdate", async (before, after) => {
    const changes = [];
    if (before.name !== after.name) changes.push(`Name: \`${before.name}\` → \`${after.name}\``);
    if (before.icon !== after.icon) changes.push("Server-Icon geändert");
    if (before.premiumTier !== after.premiumTier) changes.push(`Boost-Level: ${before.premiumTier} → ${after.premiumTier}`);
    if (!changes.length) return;
    await log(new EmbedBuilder().setTitle("⚙️ Servereinstellungen geändert").setDescription(changes.join("\n")).setColor(COLOR_EDIT));
  });

  // --- Sprachkanäle ---
  client.on("voiceStateUpdate", async (before, after) => {
    const member = after.member || before.member;
    if (before.channelId === after.channelId) {
      if (before.mute !== after.mute || before.deaf !== after.deaf) {
        const e = new EmbedBuilder()
          .setTitle("🎙️ Sprachstatus geändert")
          .setDescription(`<@${member.id}> in ${after.channel ? `<#${after.channel.id}>` : "-"}\nStumm: ${after.mute} | Taub: ${after.deaf}`)
          .setColor(COLOR_INFO);
        await log(e, member.user);
      }
      return;
    }
    let e;
    if (before.channel && after.channel) {
      e = new EmbedBuilder().setTitle("🔀 Sprachkanal gewechselt").setDescription(`<@${member.id}>: <#${before.channel.id}> → <#${after.channel.id}>`).setColor(COLOR_INFO);
    } else if (after.channel) {
      e = new EmbedBuilder().setTitle("🔊 Sprachkanal beigetreten").setDescription(`<@${member.id}> ist <#${after.channel.id}> beigetreten.`).setColor(COLOR_ADD);
    } else {
      e = new EmbedBuilder().setTitle("🔈 Sprachkanal verlassen").setDescription(`<@${member.id}> hat <#${before.channel.id}> verlassen.`).setColor(COLOR_REMOVE);
    }
    await log(e, member.user);
  });
}

module.exports = { setup };
