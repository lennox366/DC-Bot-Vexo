// backup.js
// Backup-System für deinen discord.js-Bot (discord.js v14)
//
// Befehle:
//   /backup erstellen [name]   -> Server-Struktur sichern
//   /backup laden              -> alle Backups sehen, eins wählen, auf den Server laden
//   /backup liste              -> alle Backups anzeigen
//   /backup loeschen           -> ein Backup löschen
//   /backup zeit               -> automatisches Backup einstellen
//
// Wie man es einbindet steht in index-integration.txt.

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const crypto = require("crypto");
const storage = require("./storage.js");

const INTERVALS = {
  Aus: 0,
  "Jede Stunde": 1,
  "Alle 6 Stunden": 6,
  "Alle 12 Stunden": 12,
  Täglich: 24,
  Wöchentlich: 168,
};

// ---------------------------------------------------------------- Befehle (zum Registrieren)
const commands = [
  new SlashCommandBuilder()
    .setName("backup")
    .setDescription("Server-Backups verwalten")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName("erstellen")
        .setDescription("Erstellt ein Backup vom Server")
        .addStringOption((o) => o.setName("name").setDescription("Name für das Backup"))
    )
    .addSubcommand((s) => s.setName("laden").setDescription("Zeigt alle Backups und lädt eins auf den Server"))
    .addSubcommand((s) => s.setName("liste").setDescription("Zeigt alle Backups an"))
    .addSubcommand((s) => s.setName("loeschen").setDescription("Löscht ein Backup"))
    .addSubcommand((s) =>
      s
        .setName("zeit")
        .setDescription("Stellt das automatische Backup ein")
        .addStringOption((o) =>
          o
            .setName("intervall")
            .setDescription("Wie oft automatisch gesichert wird")
            .setRequired(true)
            .addChoices(...Object.keys(INTERVALS).map((k) => ({ name: k, value: k })))
        )
    )
    .toJSON(),
];

// ---------------------------------------------------------------- Snapshot erstellen
function snapshotGuild(guild, name) {
  const roles = guild.roles.cache
    .filter((r) => r.id !== guild.id && !r.managed)
    .map((r) => ({
      name: r.name,
      color: r.color,
      permissions: r.permissions.bitfield.toString(),
      position: r.position,
      hoist: r.hoist,
      mentionable: r.mentionable,
    }));

  const overwritesOf = (ch) =>
    [...ch.permissionOverwrites.cache.values()]
      .filter((o) => o.type === 0) // nur Rollen, keine einzelnen Mitglieder
      .map((o) => {
        const role = guild.roles.cache.get(o.id);
        return {
          role: role ? (role.id === guild.id ? "@everyone" : role.name) : null,
          allow: o.allow.bitfield.toString(),
          deny: o.deny.bitfield.toString(),
        };
      })
      .filter((o) => o.role);

  const categories = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory)
    .map((c) => ({ name: c.name, position: c.position, overwrites: overwritesOf(c) }));

  const channels = guild.channels.cache
    .filter((c) => c.type !== ChannelType.GuildCategory && !c.isThread() && c.permissionOverwrites) // Threads haben keine Rechte-Overwrites
    .map((c) => ({
      name: c.name,
      type: c.type,
      position: c.position,
      category: c.parent ? c.parent.name : null,
      overwrites: overwritesOf(c),
      topic: c.topic || null,
      nsfw: c.nsfw || false,
      rateLimitPerUser: c.rateLimitPerUser || 0,
      bitrate: c.bitrate || undefined,
      userLimit: c.userLimit || undefined,
    }));

  return {
    id: crypto.randomBytes(4).toString("hex"),
    name,
    created: new Date().toISOString(),
    guildName: guild.name,
    everyonePermissions: guild.roles.everyone.permissions.bitfield.toString(),
    settings: { name: guild.name, verificationLevel: guild.verificationLevel },
    roles,
    categories,
    channels,
  };
}

// ---------------------------------------------------------------- Wiederherstellen
function overwritesFor(guild, list) {
  const result = [];
  for (const o of list) {
    const role = o.role === "@everyone" ? guild.roles.everyone : guild.roles.cache.find((r) => r.name === o.role);
    if (role) {
      result.push({
        id: role.id,
        allow: BigInt(o.allow),
        deny: BigInt(o.deny),
      });
    }
  }
  return result;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function restoreSnapshot(guild, data, replaceAll, onProgress) {
  const ok = [];
  const errors = [];
  const botTop = guild.members.me.roles.highest;
  const PAUSE = 700;

  // Servereinstellungen
  try {
    await guild.setName(data.settings.name);
    ok.push("Servereinstellungen");
  } catch (e) {
    errors.push(`Servereinstellungen: ${e.message}`);
  }

  // Rollen
  const keptRoleIds = new Set();
  const sortedRoles = [...data.roles].sort((a, b) => a.position - b.position);
  let i = 0;
  for (const r of sortedRoles) {
    i++;
    try {
      let role = guild.roles.cache.find((x) => x.name === r.name);
      if (role && role.position >= botTop.position) {
        errors.push(`Rolle '${r.name}' ist höher als die Bot-Rolle (übersprungen)`);
        keptRoleIds.add(role.id);
        continue;
      }
      const opts = {
        name: r.name,
        color: r.color,
        permissions: BigInt(r.permissions),
        hoist: r.hoist,
        mentionable: r.mentionable,
      };
      if (role) {
        await role.edit(opts);
      } else {
        role = await guild.roles.create(opts);
      }
      keptRoleIds.add(role.id);
      await sleep(PAUSE);
    } catch (e) {
      errors.push(`Rolle '${r.name}': ${e.message}`);
    }
    if (i % 5 === 0) await onProgress(`Rollen ${i}/${sortedRoles.length} ...`);
  }
  ok.push(`${sortedRoles.length} Rollen`);

  try {
    await guild.roles.everyone.setPermissions(BigInt(data.everyonePermissions));
  } catch (e) {
    errors.push(`@everyone-Rechte: ${e.message}`);
  }

  // Kategorien
  const keptChannelIds = new Set();
  const catMap = new Map();
  for (const c of [...data.categories].sort((a, b) => a.position - b.position)) {
    try {
      let cat = guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && x.name === c.name);
      const permissionOverwrites = overwritesFor(guild, c.overwrites);
      if (cat) {
        await cat.edit({ position: c.position, permissionOverwrites });
      } else {
        cat = await guild.channels.create({
          name: c.name,
          type: ChannelType.GuildCategory,
          position: c.position,
          permissionOverwrites,
        });
      }
      catMap.set(c.name, cat);
      keptChannelIds.add(cat.id);
      await sleep(PAUSE);
    } catch (e) {
      errors.push(`Kategorie '${c.name}': ${e.message}`);
    }
  }
  ok.push(`${data.categories.length} Kategorien`);
  await onProgress("Kategorien fertig, Kanäle werden geladen ...");

  // Kanäle
  let j = 0;
  for (const c of [...data.channels].sort((a, b) => a.position - b.position)) {
    j++;
    try {
      const permissionOverwrites = overwritesFor(guild, c.overwrites);
      const parent = c.category ? catMap.get(c.category) : null;
      let ch = guild.channels.cache.find(
        (x) => x.name === c.name && x.type === c.type && !keptChannelIds.has(x.id)
      );
      const base = {
        name: c.name,
        type: c.type,
        position: c.position,
        parent: parent ? parent.id : null,
        permissionOverwrites,
        topic: c.topic || undefined,
        nsfw: c.nsfw,
        rateLimitPerUser: c.rateLimitPerUser,
        bitrate: c.bitrate,
        userLimit: c.userLimit,
      };
      if (ch) {
        await ch.edit(base);
      } else {
        ch = await guild.channels.create(base);
      }
      keptChannelIds.add(ch.id);
      await sleep(PAUSE);
    } catch (e) {
      errors.push(`Kanal '${c.name}': ${e.message}`);
    }
    if (j % 5 === 0) await onProgress(`Kanäle ${j}/${data.channels.length} ...`);
  }
  ok.push(`${data.channels.length} Kanäle`);

  // Alles ersetzen: Überzähliges löschen
  if (replaceAll) {
    for (const ch of [...guild.channels.cache.values()]) {
      if (!keptChannelIds.has(ch.id)) {
        try {
          await ch.delete("Backup geladen (alles ersetzen)");
          await sleep(PAUSE);
        } catch (e) {
          errors.push(`Löschen '${ch.name}': ${e.message}`);
        }
      }
    }
    for (const role of [...guild.roles.cache.values()]) {
      if (!keptRoleIds.has(role.id) && role.id !== guild.id && !role.managed && role.position < botTop.position) {
        try {
          await role.delete("Backup geladen (alles ersetzen)");
          await sleep(PAUSE);
        } catch (e) {
          errors.push(`Löschen Rolle '${role.name}': ${e.message}`);
        }
      }
    }
  }

  return { ok, errors };
}

// ---------------------------------------------------------------- Dropdown / Buttons
function backupOptions(backups) {
  return backups.slice(0, 25).map((b) => ({
    label: b.name.slice(0, 100),
    value: b.id,
    description: `${new Date(b.created).toLocaleString("de-DE")} | ${b.roles.length} Rollen, ${b.channels.length} Kanäle`,
  }));
}

// ---------------------------------------------------------------- Setup (wird aus index.js aufgerufen)
function setup(client) {
  // Auto-Backup: jede Minute prüfen
  setInterval(async () => {
    const settings = storage.loadAutoSettings();
    for (const [guildId, cfg] of Object.entries(settings)) {
      if (!cfg.hours) continue;
      const last = new Date(cfg.last);
      const dueMs = cfg.hours * 3600 * 1000;
      if (Date.now() - last.getTime() < dueMs) continue;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;
      try {
        const name = `Auto - ${new Date().toLocaleString("de-DE")}`;
        storage.saveBackup(guildId, snapshotGuild(guild, name));
        storage.markAutoRan(guildId);
      } catch (e) {
        console.error(`[Backup] Auto-Backup für ${guildId} fehlgeschlagen:`, e);
      }
    }
  }, 60 * 1000);

  client.on("interactionCreate", async (interaction) => {
    try {
      // --- Slash-Befehl /backup ... ---
      if (interaction.isChatInputCommand() && interaction.commandName === "backup") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: "❌ Nur Administratoren dürfen /backup benutzen.", ephemeral: true });
        }
        const sub = interaction.options.getSubcommand();
        if (!storage.isCommandEnabled(interaction.guildId, `backup ${sub}`)) {
          return interaction.reply({ content: "🚫 Dieser Befehl ist im Dashboard deaktiviert.", ephemeral: true });
        }

        if (sub === "erstellen") {
          await interaction.deferReply({ ephemeral: true });
          const name =
            interaction.options.getString("name") || `Backup ${new Date().toLocaleString("de-DE")}`;
          const data = snapshotGuild(interaction.guild, name);
          storage.saveBackup(interaction.guildId, data);
          const embed = new EmbedBuilder()
            .setTitle("✅ Backup erstellt")
            .setColor(0x3ba55d)
            .addFields(
              { name: "Name", value: data.name },
              { name: "ID", value: data.id },
              {
                name: "Inhalt",
                value: `${data.roles.length} Rollen\n${data.categories.length} Kategorien\n${data.channels.length} Kanäle`,
              }
            );
          return interaction.editReply({ embeds: [embed] });
        }

        if (sub === "liste") {
          const backups = storage.listBackups(interaction.guildId);
          if (!backups.length) return interaction.reply({ content: "Es gibt noch keine Backups.", ephemeral: true });
          const desc = backups
            .map(
              (b) =>
                `**${b.name}** (\`${b.id}\`)\n${new Date(b.created).toLocaleString("de-DE")} | ${b.roles.length} Rollen, ${b.channels.length} Kanäle`
            )
            .join("\n\n");
          const embed = new EmbedBuilder().setTitle("📦 Backups").setDescription(desc.slice(0, 4000)).setColor(0x5865f2);
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === "laden" || sub === "loeschen") {
          const backups = storage.listBackups(interaction.guildId);
          if (!backups.length) return interaction.reply({ content: "Es gibt noch keine Backups.", ephemeral: true });
          const menu = new StringSelectMenuBuilder()
            .setCustomId(`backup_select_${sub}`)
            .setPlaceholder("Backup auswählen ...")
            .addOptions(backupOptions(backups));
          const row = new ActionRowBuilder().addComponents(menu);
          return interaction.reply({
            content: sub === "laden" ? `${backups.length} Backups gefunden. Wähle eins aus.` : "Welches Backup soll gelöscht werden?",
            components: [row],
            ephemeral: true,
          });
        }

        if (sub === "zeit") {
          const key = interaction.options.getString("intervall");
          const hours = INTERVALS[key];
          storage.setAutoSettings(interaction.guildId, hours);
          if (hours === 0) {
            return interaction.reply({ content: "Automatische Backups sind jetzt **aus**.", ephemeral: true });
          }
          const next = new Date(Date.now() + hours * 3600 * 1000);
          return interaction.reply({
            content: `Automatisches Backup: **${key}**.\nNächstes Backup: <t:${Math.floor(next.getTime() / 1000)}:f>`,
            ephemeral: true,
          });
        }
      }

      // --- Dropdown-Auswahl ---
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith("backup_select_")) {
        const action = interaction.customId.replace("backup_select_", "");
        const backup = storage.getBackup(interaction.guildId, interaction.values[0]);
        if (!backup) return interaction.update({ content: "Backup nicht gefunden.", embeds: [], components: [] });

        const embed = new EmbedBuilder()
          .setTitle(`Backup „${backup.name}“`)
          .setDescription(
            `Erstellt: ${new Date(backup.created).toLocaleString("de-DE")}\n${backup.roles.length} Rollen, ${backup.categories.length} Kategorien, ${backup.channels.length} Kanäle`
          )
          .setColor(0xfaa61a);
        if (action === "laden") {
          embed.addFields({
            name: "⚠️ Achtung",
            value:
              "Rollen und Kanäle werden angepasst oder neu erstellt.\nMit „Alles ersetzen“ wird zusätzlich alles gelöscht, was nicht im Backup ist.",
          });
        }

        const row = new ActionRowBuilder();
        if (action === "laden") {
          row.addComponents(
            new ButtonBuilder().setCustomId(`backup_confirm_load_${backup.id}_0`).setLabel("Ja, laden").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`backup_confirm_load_${backup.id}_1`).setLabel("Alles ersetzen").setStyle(ButtonStyle.Danger)
          );
        } else {
          row.addComponents(
            new ButtonBuilder().setCustomId(`backup_confirm_delete_${backup.id}`).setLabel("Ja, löschen").setStyle(ButtonStyle.Danger)
          );
        }
        row.addComponents(new ButtonBuilder().setCustomId("backup_cancel").setLabel("Abbrechen").setStyle(ButtonStyle.Secondary));

        return interaction.update({ embeds: [embed], components: [row] });
      }

      // --- Buttons ---
      if (interaction.isButton()) {
        if (interaction.customId === "backup_cancel") {
          return interaction.update({ content: "Abgebrochen.", embeds: [], components: [] });
        }

        if (interaction.customId.startsWith("backup_confirm_delete_")) {
          const id = interaction.customId.replace("backup_confirm_delete_", "");
          storage.deleteBackup(interaction.guildId, id);
          return interaction.update({ content: "🗑️ Backup wurde gelöscht.", embeds: [], components: [] });
        }

        if (interaction.customId.startsWith("backup_confirm_load_")) {
          const rest = interaction.customId.replace("backup_confirm_load_", "");
          const [id, replaceFlag] = [rest.slice(0, -2), rest.slice(-1)];
          const replaceAll = replaceFlag === "1";
          const backup = storage.getBackup(interaction.guildId, id);
          await interaction.update({ content: "⏳ Backup wird geladen ...", embeds: [], components: [] });

          const onProgress = async (text) => {
            try {
              await interaction.editReply({ content: `⏳ ${text}` });
            } catch {}
          };

          const { ok, errors } = await restoreSnapshot(interaction.guild, backup, replaceAll, onProgress);
          const embed = new EmbedBuilder()
            .setTitle(errors.length ? "⚠️ Backup geladen (mit Hinweisen)" : "✅ Backup geladen")
            .setDescription("Wiederhergestellt: " + ok.join(", "))
            .setColor(errors.length ? 0xfaa61a : 0x3ba55d);
          if (errors.length) {
            embed.addFields({ name: `Probleme (${errors.length})`, value: errors.slice(0, 10).join("\n").slice(0, 1000) });
          }
          try {
            await interaction.editReply({ content: null, embeds: [embed] });
          } catch {}
        }
      }
    } catch (e) {
      console.error("[Backup] Fehler:", e);
    }
  });
}

module.exports = { commands, setup, snapshotGuild };