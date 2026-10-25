
"use strict";

const fs = require("fs");
const path = require("path");

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  RoleSelectMenuBuilder,
  MessageFlags
} = require("discord.js");

const CONFIG_FILE = path.join(__dirname, "meeting-calendar-config.json");
const DATA_FILE = path.join(__dirname, "meeting-calendar-data.json");

const TZ = "Europe/Berlin";

// Diese Rolle wird IMMER gepingt!
const ALWAYS_PING_ROLE_ID = "1559659267269595147";

const meetingPingRoles = selected => [
  ...new Set([ALWAYS_PING_ROLE_ID, ...(selected || [])])
];

const DAY_MS = 86400000;
const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const pad = n => String(n).padStart(2, "0");

const dateISO = d =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const parseISO = s => new Date(`${s}T12:00:00Z`);

const todayBerlin = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

const plusDays = (s, n) =>
  dateISO(new Date(parseISO(s).getTime() + n * DAY_MS));

const startMonday = s => {
  const d = parseISO(s);
  return plusDays(s, -((d.getUTCDay() + 6) % 7));
};

const pretty = s => {
  const d = parseISO(s);
  return `${weekdays[d.getUTCDay()]}, ${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
};

const readJSON = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};

const saveJSON = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");

const config = () => readJSON(CONFIG_FILE, {});
const data = () => readJSON(DATA_FILE, { panels: {}, meetings: [] });

const isSnowflake = s => /^\d{17,20}$/.test(String(s));

function roleHierarchyIds() {
  const cfg = readJSON(
    path.join(__dirname, "team-roles-config.json"),
    {}
  );

  const categories = cfg.roleHierarchy;
  if (!Array.isArray(categories)) return [];

  return categories.flatMap(cat =>
    Array.isArray(cat.roles) ? cat.roles : []
  );
}

function authorized(member, guild, c) {
  if (
    member.id === guild.ownerId ||
    (c.botOwnerIds || []).includes(member.id)
  ) {
    return true;
  }

  if (
    (c.allowedRoleIds || []).some(id =>
      member.roles.cache.has(id)
    )
  ) {
    return true;
  }

  if (c.useRoleHierarchy === true) {
    const roles = roleHierarchyIds();
    const marker = roles.findIndex(r => r.id === c.minimumRoleId);

    if (marker >= 0) {
      return roles
        .slice(0, marker + 1)
        .some(r => member.roles.cache.has(r.id));
    }
  }

  return false;
}

function calendarEmbed(week, meetings) {
  const end = plusDays(week, 6);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("📅 VEXO RP • Meeting-Kalender")
    .setDescription(
      `**Woche ${pretty(week)} – ${pretty(end)}**\n` +
      "Wähle einen Tag aus, um ein Team-Meeting zu planen.\n" +
      `🕒 Alle Uhrzeiten gelten für Deutschland (${TZ}).`
    )
    .setFooter({
      text: "Nur berechtigte Teammitglieder können Meetings erstellen."
    });

  for (let i = 0; i < 7; i++) {
    const day = plusDays(week, i);

    const events = meetings.filter(
      m => m.date === day
    );

    embed.addFields({
      name: `${i + 1}. ${pretty(day)}`,
      value: events.length
        ? events
            .map(m => `🕒 **${m.time} Uhr** • ${m.title}`)
            .join("\n")
            .slice(0, 1024)
        : "— Noch kein Meeting —",
      inline: false
    });
  }

  return embed;
}

function calendarRows(week) {
  const rows = [];

  for (let offset = 0; offset < 7; offset += 4) {
    const row = new ActionRowBuilder();

    for (let i = offset; i < Math.min(offset + 4, 7); i++) {
      const date = plusDays(week, i);

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`vxm:day:${date}`)
          .setLabel(
            `${weekdays[parseISO(date).getUTCDay()]} ` +
            `${date.slice(8, 10)}.${date.slice(5, 7)}`
          )
          .setStyle(ButtonStyle.Primary)
      );
    }

    rows.push(row);
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`vxm:week:${plusDays(week, -7)}`)
        .setLabel("◀ Vorherige Woche")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`vxm:week:${startMonday(todayBerlin())}`)
        .setLabel("Aktuelle Woche")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`vxm:week:${plusDays(week, 7)}`)
        .setLabel("Nächste Woche ▶")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return rows;
}

function meetingDateValid(s) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    dateISO(parseISO(s)) === s &&
    s >= todayBerlin()
  );
}

function validTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function berlinTimestamp(date, time) {
  const wanted = `${date} ${time}`;
  const base = Date.parse(`${date}T${time}:00Z`);

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const format = ms => {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(ms)).map(p => [
        p.type,
        p.value
      ])
    );

    return (
      `${parts.year}-${parts.month}-${parts.day} ` +
      `${parts.hour}:${parts.minute}`
    );
  };

  for (const delta of [-2, -1, 0, 1, 2]) {
    const ms = base + delta * 3600000;

    if (format(ms) === wanted) {
      return Math.floor(ms / 1000);
    }
  }

  return null;
}

async function sendCalendar(channel, week) {
  const d = data();

  const msg = await channel.send({
    embeds: [calendarEmbed(week, d.meetings)],
    components: calendarRows(week)
  });

  d.panels[channel.guild.id] = {
    channelId: channel.id,
    messageId: msg.id,
    week
  };

  saveJSON(DATA_FILE, d);
  return msg;
}

async function refreshCalendar(client, guildId) {
  const d = data();
  const p = d.panels[guildId];

  if (!p) return;

  try {
    const ch = await client.channels.fetch(p.channelId);
    const msg = await ch.messages.fetch(p.messageId);

    await msg.edit({
      embeds: [calendarEmbed(p.week, d.meetings)],
      components: calendarRows(p.week)
    });
  } catch (err) {
    console.warn(
      "[Meeting-Kalender] Panel konnte nicht aktualisiert werden:",
      err.message
    );
  }
}

const pending = new Map();

async function handleInteraction(interaction) {
  const c = config();

  if (
    !interaction.guild ||
    !interaction.customId?.startsWith("vxm:")
  ) {
    return false;
  }

  const member = await interaction.guild.members.fetch(
    interaction.user.id
  );

  const allowed = authorized(
    member,
    interaction.guild,
    c
  );

  const [_, action, value] = interaction.customId.split(":");

  if (!allowed) {
    await interaction.reply({
      content:
        "⛔ Du brauchst mindestens den Rang **Stv. Manager** oder eine explizit freigegebene Rolle.",
      flags: MessageFlags.Ephemeral
    });

    return true;
  }

  if (action === "week" && interaction.isButton()) {
    const d = data();
    const p = d.panels[interaction.guild.id];

    if (p && p.messageId === interaction.message.id) {
      p.week = value;
      saveJSON(DATA_FILE, d);
    }

    await interaction.update({
      embeds: [calendarEmbed(value, d.meetings)],
      components: calendarRows(value)
    });

    return true;
  }

  if (action === "day" && interaction.isButton()) {
    if (!meetingDateValid(value)) {
      await interaction.reply({
        content: "Bitte wähle einen heutigen oder zukünftigen Tag.",
        flags: MessageFlags.Ephemeral
      });

      return true;
    }

    const modal = new ModalBuilder()
      .setCustomId(`vxm:modal:${value}`)
      .setTitle(`Meeting • ${value}`);

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Meeting-Titel")
          .setPlaceholder("Team-Meeting")
          .setRequired(true)
          .setMaxLength(80)
          .setStyle(TextInputStyle.Short)
      ),

      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("time")
          .setLabel("Uhrzeit (HH:MM, Deutschland)")
          .setPlaceholder("19:30")
          .setRequired(true)
          .setMaxLength(5)
          .setStyle(TextInputStyle.Short)
      ),

      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("note")
          .setLabel("Zusatzinfo (optional)")
          .setRequired(false)
          .setMaxLength(400)
          .setStyle(TextInputStyle.Paragraph)
      )
    );

    await interaction.showModal(modal);
    return true;
  }

  if (action === "modal" && interaction.isModalSubmit()) {
    const title = interaction.fields
      .getTextInputValue("title")
      .trim();

    const time = interaction.fields
      .getTextInputValue("time")
      .trim();

    const note = interaction.fields
      .getTextInputValue("note")
      .trim();

    const ts =
      validTime(time) && meetingDateValid(value)
        ? berlinTimestamp(value, time)
        : null;

    if (!ts || ts < Math.floor(Date.now() / 1000)) {
      await interaction.reply({
        content:
          "❌ Ungültige oder vergangene Uhrzeit. Bitte nutze HH:MM, z. B. 19:30.",
        flags: MessageFlags.Ephemeral
      });

      return true;
    }

    const token =
      `${interaction.user.id}-${Date.now().toString(36)}`;

    pending.set(token, {
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      date: value,
      time,
      title,
      note,
      ts,
      created: Date.now()
    });

    const select = new RoleSelectMenuBuilder()
      .setCustomId(`vxm:roles:${token}`)
      .setPlaceholder("Weitere Rollen auswählen")
      .setMinValues(0)
      .setMaxValues(25);

    await interaction.reply({
      content:
        `📣 **${title}** am **${pretty(value)}**, ` +
        `**${time} Uhr**.\n` +
        "Wähle jetzt die zusätzlichen Rollen aus, " +
        "die gepingt werden sollen.",
      components: [
        new ActionRowBuilder().addComponents(select)
      ],
      flags: MessageFlags.Ephemeral
    });

    return true;
  }

  if (
    action === "roles" &&
    interaction.isRoleSelectMenu()
  ) {
    const p = pending.get(value);

    if (
      !p ||
      p.userId !== interaction.user.id ||
      p.guildId !== interaction.guild.id ||
      Date.now() - p.created > 15 * 60 * 1000
    ) {
      await interaction.reply({
        content:
          "❌ Die Auswahl ist abgelaufen. Bitte erstelle das Meeting erneut.",
        flags: MessageFlags.Ephemeral
      });

      return true;
    }

    p.roles = interaction.values.filter(isSnowflake);

    const confirm = new ButtonBuilder()
      .setCustomId(`vxm:confirm:${value}`)
      .setLabel("Meeting veröffentlichen")
      .setStyle(ButtonStyle.Success);

    const cancel = new ButtonBuilder()
      .setCustomId(`vxm:cancel:${value}`)
      .setLabel("Abbrechen")
      .setStyle(ButtonStyle.Danger);

    await interaction.update({
      content:
        "**Vorschau**\n" +
        `📅 ${pretty(p.date)} um ${p.time} Uhr\n` +
        `📌 ${p.title}\n` +
        `🔔 ${meetingPingRoles(p.roles)
          .map(r => `<@&${r}>`)
          .join(" ")}\n` +
        `${p.note || ""}\n\n` +
        "Mit **Veröffentlichen** wird die Ankündigung sofort gesendet.",
      components: [
        new ActionRowBuilder().addComponents(
          confirm,
          cancel
        )
      ],
      allowedMentions: {
        parse: []
      }
    });

    return true;
  }

  if (
    (action === "confirm" || action === "cancel") &&
    interaction.isButton()
  ) {
    const p = pending.get(value);

    if (
      !p ||
      p.userId !== interaction.user.id ||
      p.guildId !== interaction.guild.id
    ) {
      await interaction.reply({
        content: "Diese Planung ist nicht mehr verfügbar.",
        flags: MessageFlags.Ephemeral
      });

      return true;
    }

    if (action === "cancel") {
      pending.delete(value);

      await interaction.update({
        content: "Meeting abgebrochen.",
        components: []
      });

      return true;
    }

    await interaction.deferUpdate();

    try {
      const channel =
        await interaction.guild.channels.fetch(
          c.announcementChannelId
        );

      if (!channel?.isTextBased()) {
        throw new Error(
          "Ankündigungskanal nicht gefunden / kein Textkanal"
        );
      }

      const calendarUrl =
        `https://discord.com/channels/` +
        `${interaction.guild.id}/${c.calendarChannelId}`;

      const embed = new EmbedBuilder()
        .setColor(0x00B894)
        .setTitle(`📢 VEXO RP • ${p.title}`)
        .setDescription(
          `📅 **Datum:** ${pretty(p.date)}\n` +
          `🕒 **Uhrzeit:** <t:${p.ts}:t> Uhr (Deutschland)\n` +
          `📍 **Meeting-Kalender:** [Hier öffnen](${calendarUrl})\n\n` +
          "**Bitte erscheint pünktlich zum Meeting!**" +
          (p.note
            ? `\n\n📝 **Informationen:** ${p.note}`
            : "")
        )
        .setFooter({
          text: `Erstellt von ${interaction.user.username}`
        })
        .setTimestamp();

      const pingRoles = meetingPingRoles(p.roles);

      await channel.send({
        content: pingRoles
          .map(r => `<@&${r}>`)
          .join(" "),
        embeds: [embed],
        allowedMentions: {
          parse: [],
          roles: pingRoles
        }
      });

      const d = data();

      d.meetings.push({
        guildId: p.guildId,
        date: p.date,
        time: p.time,
        title: p.title,
        note: p.note,
        roles: pingRoles,
        creator: p.userId,
        ts: p.ts
      });

      saveJSON(DATA_FILE, d);
      pending.delete(value);

      await refreshCalendar(
        interaction.client,
        interaction.guild.id
      );

      await interaction.editReply({
        content:
          `✅ Meeting veröffentlicht in <#${channel.id}>!`,
        components: []
      });
    } catch (err) {
      console.error("[Meeting-Kalender]", err);

      await interaction.editReply({
        content:
          `❌ Ankündigung fehlgeschlagen: ${err.message}`,
        components: []
      });
    }

    return true;
  }

  return false;
}

async function handleCommand(interaction) {
  if (
    !interaction.isChatInputCommand() ||
    interaction.commandName !== "meeting"
  ) {
    return false;
  }

  const c = config();

  if (!interaction.guild) {
    await interaction.reply({
      content: "❌ Nur auf einem Discord-Server verfügbar.",
      flags: MessageFlags.Ephemeral
    });

    return true;
  }

  const member =
    await interaction.guild.members.fetch(
      interaction.user.id
    );

  if (!authorized(member, interaction.guild, c)) {
    await interaction.reply({
      content:
        "⛔ Keine Berechtigung (ab Stv. Manager).",
      flags: MessageFlags.Ephemeral
    });

    return true;
  }

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral
  });

  try {
    const channel =
      await interaction.guild.channels.fetch(
        c.calendarChannelId
      );

    if (!channel?.isTextBased()) {
      throw new Error(
        "Kalender-Kanal ist nicht erreichbar"
      );
    }

    const d = data();
    const old = d.panels[interaction.guild.id];

    if (old?.messageId) {
      try {
        const oldCh =
          await interaction.guild.channels.fetch(
            old.channelId
          );

        const oldMsg =
          await oldCh.messages.fetch(old.messageId);

        await oldMsg.delete();
      } catch {}
    }

    await sendCalendar(
      channel,
      startMonday(todayBerlin())
    );

    await interaction.editReply(
      `✅ Meeting-Kalender erstellt: <#${channel.id}>`
    );
  } catch (err) {
    await interaction.editReply(
      `❌ ${err.message}`
    );
  }

  return true;
}

function installMeetingCalendar(client) {
  client.on("interactionCreate", async interaction => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
      } else if (
        interaction.isButton() ||
        interaction.isModalSubmit() ||
        interaction.isRoleSelectMenu()
      ) {
        await handleInteraction(interaction);
      }
    } catch (err) {
      console.error("[Meeting-Kalender]", err);

      if (
        interaction.isRepliable() &&
        !interaction.replied &&
        !interaction.deferred
      ) {
        try {
          await interaction.reply({
            content:
              "❌ Fehler im Meeting-Kalender.",
            flags: MessageFlags.Ephemeral
          });
        } catch {}
      }
    }
  });

  console.log(
    "[Meeting-Kalender] Modul geladen"
  );
}

module.exports = {
  installMeetingCalendar,
  handleCommand,
  handleInteraction,
  refreshCalendar
};
  
