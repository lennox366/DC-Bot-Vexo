const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const TEAM_ROLES_CONFIG = path.join(__dirname, "..", "team-roles-config.json");

let teamRolesConfig = null;

function loadTeamRolesConfig() {
    try {
        if (fs.existsSync(TEAM_ROLES_CONFIG)) {
            teamRolesConfig = JSON.parse(fs.readFileSync(TEAM_ROLES_CONFIG, "utf8"));
            console.log("✅ Team-Rollen-Konfiguration geladen.");
        } else {
            console.error("❌ Team-Rollen-Konfiguration nicht gefunden:", TEAM_ROLES_CONFIG);
        }
    } catch (error) {
        console.error("❌ Fehler beim Laden der Team-Rollen-Konfiguration:", error);
    }
}

function getAllRoles() {
    if (!teamRolesConfig) return [];
    const allRoles = [];
    for (const category of teamRolesConfig.roleHierarchy) {
        for (const role of category.roles) {
            allRoles.push(role);
        }
    }
    return allRoles.sort((a, b) => a.position - b.position);
}

function findRoleById(roleId) {
    if (!teamRolesConfig) return null;
    for (const category of teamRolesConfig.roleHierarchy) {
        for (const role of category.roles) {
            if (role.id === roleId) return role;
        }
    }
    return null;
}

function findRoleByName(name) {
    if (!teamRolesConfig) return null;
    const allRoles = getAllRoles();
    return allRoles.find(role => role.name.toLowerCase().includes(name.toLowerCase()));
}

function isStaff(member) {
    if (!teamRolesConfig) return false;
    return member.roles.cache.has(teamRolesConfig.staffRoleId);
}

// =====================================================
// ROLLE ÄNDERN
// =====================================================

async function applyRoleChange(interaction, member, newRole, action) {
    try {
        const currentRole = getAllRoles().find(role => member.roles.cache.has(role.id));

        // Alle Teamrollen entfernen
        const allRoleIds = getAllRoles().map(r => r.id);
        await member.roles.remove(allRoleIds, `Team ${action}: Alte Rolle entfernt`).catch(() => {});

        // Neue Rolle hinzufügen
        await member.roles.add(newRole.id, `Team ${action}: Neue Rolle hinzugefügt`);

        const actionText = action === "uprank" ? "befördert" : "degradiert";

        await interaction.update({
            content: `✅ ${member.user.tag} wurde erfolgreich ${actionText} zu **${newRole.name}**!`,
            embeds: [],
            components: []
        });

        console.log(`✅ ${member.user.tag} wurde ${actionText} zu ${newRole.name}`);
    } catch (error) {
        console.error("❌ Fehler beim Ändern der Rolle:", error);
        await interaction.update({
            content: "❌ Ein Fehler ist beim Ändern der Rolle aufgetreten.",
            embeds: [],
            components: []
        });
    }
}

// =====================================================
// TEAMLISTE ERSTELLEN
// =====================================================

async function createTeamListEmbed(guild) {
    try {
        await guild.members.fetch();
        const staffRoleId = teamRolesConfig?.staffRoleId;

        const teamMemberIds = new Set();
        const onlineMemberIds = new Set();
        const offlineMemberIds = new Set();

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("VEXO RP • TEAMLISTE")
            .setDescription("Alle Teammitglieder und ihre Rollen")
            .setFooter({ text: "Vexo RP" })
            .setTimestamp();

        for (const category of teamRolesConfig.roleHierarchy) {
            const categoryMembers = [];

            for (const role of category.roles.filter(item => !item.name.includes("━"))) {
                const members = guild.members.cache.filter(m => m.roles.cache.has(role.id));
                const memberList = members.map(m => {
                    teamMemberIds.add(m.id);
                    const status = m.presence?.status;
                    if (status === "online" || status === "idle" || status === "dnd") {
                        onlineMemberIds.add(m.id);
                    } else {
                        offlineMemberIds.add(m.id);
                    }
                    return `<@${m.id}>`;
                }).join("\n") || "— Keine Mitglieder —";

                categoryMembers.push(`**${role.name}** [${members.size}]\n${memberList}`);
            }

            embed.addFields({
                name: category.category,
                value: categoryMembers.join("\n\n") || "— Keine Rollen konfiguriert —",
                inline: false
            });
        }

        // Statistik
        const staffMembersCount = guild.members.cache.filter(m => m.roles.cache.has(staffRoleId)).size;
        const totalMembers = teamMemberIds.size;
        const onlineCount = onlineMemberIds.size;
        const offlineCount = Math.max(0, totalMembers - onlineCount);

        embed.addFields(
            { name: "📊 Statistik", value: `**Gesamt:** ${totalMembers}\n**Staff:** ${staffMembersCount}\n**Online:** ${onlineCount}\n**Offline:** ${offlineCount}`, inline: false },
            { name: "🕐 Letztes Update", value: new Date().toLocaleString("de-DE"), inline: false }
        );

        return embed;
    } catch (error) {
        console.error("❌ Fehler beim Erstellen der Teamliste:", error);
        return new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle("❌ Fehler")
            .setDescription("Die Teamliste konnte nicht geladen werden.");
    }
}

// =====================================================
// TEAM-PANEL ERSTELLEN
// =====================================================

function createTeamPanelEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("VEXO RP • TEAMVERWALTUNG")
        .setDescription("Verwalte Teammitglieder, Ränge und Warnungen")
        .addFields(
            { name: "📋 Teammitglied verwalten", value: "Uprank, Downrank, Warnen oder Kicken", inline: false },
            { name: "👥 Teamliste anzeigen", value: "Zeigt alle Teammitglieder", inline: false }
        )
        .setFooter({ text: "Vexo RP Team System" })
        .setTimestamp();
}

function createTeamPanelButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("team_member_manage")
            .setLabel("👤 Teammitglied verwalten")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("team_list_show")
            .setLabel("📋 Teamliste")
            .setStyle(ButtonStyle.Secondary)
    );
}

// =====================================================
// TEAMMITGLIED AUSWÄHLEN
// =====================================================

function createMemberSelectEmbed() {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("TEAMMITGLIED AUSWÄHLEN")
        .setDescription("Wähle das Teammitglied aus, das du verwalten möchtest.\n\nDu kannst nach dem Namen suchen.")
        .setFooter({ text: "Vexo RP Team System" });
}

function createMemberSelectMenu() {
    return new UserSelectMenuBuilder()
        .setCustomId("team_member_select")
        .setPlaceholder("Teammitglied auswählen...")
        .setMinValues(1)
        .setMaxValues(1);
}

// =====================================================
// TEAMMITGLIED MANAGEMENT PANEL
// =====================================================

function createMemberManageEmbed(member) {
    const currentRole = getAllRoles().find(role => member.roles.cache.has(role.id));
    const roleName = currentRole ? currentRole.name : "Keine Teamrolle";

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("TEAMMITGLIED VERWALTEN")
        .setDescription(`Verwalte **${member.user.tag}**`)
        .addFields(
            { name: "👤 Mitglied", value: `<@${member.id}>`, inline: true },
            { name: "🎭 Aktuelle Rolle", value: roleName, inline: true }
        )
        .setFooter({ text: "Vexo RP Team System" })
        .setTimestamp();
}

function createMemberManageButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("team_uprank")
            .setLabel("⬆️ Uprank")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("team_downrank")
            .setLabel("⬇️ Downrank")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("team_warn_reset")
            .setLabel("🔄 Warn zurücksetzen")
            .setStyle(ButtonStyle.Secondary)
    );
}

// =====================================================
// UPRANK / DOWNRANK MODAL
// =====================================================

function createRoleSelectModal(action, member) {
    const modal = new ModalBuilder()
        .setCustomId(`team_${action}_modal`)
        .setTitle(`${action.toUpperCase()} - Rolle auswählen`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("role_search")
                    .setLabel("Rolle suchen (Name oder leer lassen für Dropdown)")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("z.B. Administrator")
                    .setRequired(false)
            )
        );

    return modal;
}

// =====================================================
// ROLLE AUSWÄHLEN DROPDOWN
// =====================================================

function createRoleSelectEmbed(action, member) {
    const actionText = action === "uprank" ? "Befördern" : "Degradieren";
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`TEAM ${action.toUpperCase()}`)
        .setDescription(`Wähle die neue Rolle für **${member.user.tag}**`)
        .addFields(
            { name: "👤 Mitglied", value: `<@${member.id}>`, inline: true },
            { name: "🎭 Neue Rolle", value: "Wähle aus der Liste oder suche", inline: true }
        )
        .setFooter({ text: "Vexo RP Team System" })
        .setTimestamp();
}

function createRoleSelectMenu() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId("team_role_select")
        .setPlaceholder("Teamrolle auswählen...")
        .setMinValues(1)
        .setMaxValues(1);

    const allRoles = getAllRoles();
    for (const role of allRoles) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(role.name)
                .setValue(role.id)
                .setDescription(`Position ${role.position}`)
        );
    }

    return menu;
}

// =====================================================
// INITIALIZE
// =====================================================

function initializeTeamManagement(client) {
    loadTeamRolesConfig();

    // MessageCreate Handler für !teampanel und !teamliste
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith("!")) return;

        const args = message.content.slice(1).split(" ");
        const command = args[0]?.toLowerCase();

        if (command === "teampanel") {
            try {
                await message.channel.send({
                    embeds: [createTeamPanelEmbed()],
                    components: [createTeamPanelButtons()]
                });
            } catch (error) {
                console.error("❌ Fehler beim Erstellen des Team-Panels:", error);
            }
        }

        if (command === "teamliste") {
            try {
                await message.channel.send({ content: "⏳ Teamliste wird geladen..." });
                const listEmbed = await createTeamListEmbed(message.guild);
                await message.channel.send({ embeds: [listEmbed] });
            } catch (error) {
                console.error("❌ Fehler beim Erstellen der Teamliste:", error);
            }
        }
    });

    // InteractionCreate Handler für Buttons und Selects
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;

        try {
            // Team-Panel Buttons
            if (interaction.isButton() && interaction.customId === "team_member_manage") {
                await interaction.reply({
                    embeds: [createMemberSelectEmbed()],
                    components: [new ActionRowBuilder().addComponents(createMemberSelectMenu())],
                    ephemeral: true
                });
            }

            if (interaction.isButton() && interaction.customId === "team_list_show") {
                await interaction.deferReply();
                const listEmbed = await createTeamListEmbed(interaction.guild);
                await interaction.editReply({ embeds: [listEmbed] });
            }

            // Mitglied auswählen
            if (interaction.isUserSelectMenu() && interaction.customId === "team_member_select") {
                const memberId = interaction.values[0];
                const member = await interaction.guild.members.fetch(memberId).catch(() => null);

                if (!member) {
                    return interaction.update({ content: "❌ Mitglied nicht gefunden.", embeds: [], components: [] });
                }

                await interaction.update({
                    embeds: [createMemberManageEmbed(member)],
                    components: [createMemberManageButtons()]
                });
            }

            // Uprank Button
            if (interaction.isButton() && interaction.customId === "team_uprank") {
                const member = interaction.message.mentions.members.first();
                if (!member) return;

                if (!isStaff(member)) {
                    return interaction.reply({
                        content: "❌ Dieses Mitglied hat keine Staffler-Teamrolle und kann nicht upranked werden.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.showModal(createRoleSelectModal("uprank", member));
            }

            // Downrank Button
            if (interaction.isButton() && interaction.customId === "team_downrank") {
                const member = interaction.message.mentions.members.first();
                if (!member) return;

                if (!isStaff(member)) {
                    return interaction.reply({
                        content: "❌ Dieses Mitglied hat keine Staffler-Teamrolle und kann nicht downranked werden.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.showModal(createRoleSelectModal("downrank", member));
            }

            // Warn zurücksetzen
            if (interaction.isButton() && interaction.customId === "team_warn_reset") {
                await interaction.reply({
                    content: "⚠️ Warn-Zurücksetzen ist noch nicht implementiert.",
                    flags: MessageFlags.Ephemeral
                });
            }

            // Modal Submit (Uprank/Downrank)
            if (interaction.isModalSubmit()) {
                if (interaction.customId === "team_uprank_modal" || interaction.customId === "team_downrank_modal") {
                    const action = interaction.customId.replace("team_", "").replace("_modal", "");
                    const roleSearch = interaction.fields.getTextInputValue("role_search");

                    const member = interaction.message.mentions.members.first();
                    if (!member) return;

                    if (roleSearch && roleSearch.trim()) {
                        // Rolle per Name suchen
                        const foundRole = findRoleByName(roleSearch.trim());
                        if (foundRole) {
                            await applyRoleChange(interaction, member, foundRole, action);
                        } else {
                            await interaction.reply({
                                content: `❌ Rolle "${roleSearch}" nicht gefunden. Bitte versuche es erneut.`,
                                flags: MessageFlags.Ephemeral
                            });
                        }
                    } else {
                        // Dropdown anzeigen
                        await interaction.reply({
                            embeds: [createRoleSelectEmbed(action, member)],
                            components: [new ActionRowBuilder().addComponents(createRoleSelectMenu())],
                            ephemeral: true
                        });
                    }
                }
            }

            // Rolle aus Dropdown auswählen
            if (interaction.isStringSelectMenu() && interaction.customId === "team_role_select") {
                const roleId = interaction.values[0];
                const role = findRoleById(roleId);
                const member = interaction.message.mentions.members.first();

                if (!role || !member) {
                    return interaction.update({ content: "❌ Fehler beim Auswählen der Rolle.", embeds: [], components: [] });
                }

                const action = interaction.message.embeds[0].title.includes("UPRANK") ? "uprank" : "downrank";
                await applyRoleChange(interaction, member, role, action);
            }

        } catch (error) {
            console.error("❌ Fehler im Team-Management:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: "❌ Ein Fehler ist aufgetreten.", flags: MessageFlags.Ephemeral });
            }
        }
    });

    console.log("✅ Team-Management-System wurde initialisiert.");
}

module.exports = {
    initializeTeamManagement,
    loadTeamRolesConfig,
    createTeamPanelEmbed,
    createTeamPanelButtons,
    createMemberSelectEmbed,
    createMemberSelectMenu,
    createMemberManageEmbed,
    createMemberManageButtons,
    createRoleSelectModal,
    createRoleSelectEmbed,
    createRoleSelectMenu,
    createTeamListEmbed
};
