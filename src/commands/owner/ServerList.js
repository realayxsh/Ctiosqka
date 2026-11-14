const {
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder,
    SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags
} = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

const PAGE_SIZE = 8;

function buildPage(client, guilds, page) {
    const totalPages = Math.ceil(guilds.length / PAGE_SIZE);
    const slice      = guilds.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    const lines = slice.map((g, i) => {
        const num     = page * PAGE_SIZE + i + 1;
        const created = `<t:${Math.round(g.createdTimestamp / 1000)}:R>`;
        return `**${num}.** ${g.name}\n${client.emoji.members || '👥'} \`${g.memberCount}\` members • \`${g.id}\` • Created ${created}`;
    }).join('\n\n');

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**${client.emoji.servers} | Server List — ${guilds.length} total**`
                ))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ dynamic: true })))
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines || '*No servers on this page*'))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `-# Page ${page + 1} / ${totalPages} • Use the menu below to get an invite link`
        ));

    // Navigation buttons
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`sl_prev`)
            .setLabel(`◀ Prev`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`sl_next`)
            .setLabel(`Next ▶`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`sl_refresh`)
            .setLabel(`↻ Refresh`)
            .setStyle(ButtonStyle.Primary)
    );

    // Select menu to get invite for a server on this page
    const options = slice.map((g, i) =>
        new StringSelectMenuOptionBuilder()
            .setLabel(g.name.slice(0, 100))
            .setValue(g.id)
            .setDescription(`${g.memberCount} members • ${g.id}`)
    );

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`sl_invite`)
            .setPlaceholder(`Get invite link for a server...`)
            .addOptions(options)
    );

    return { container, navRow, selectRow, slice, totalPages };
}

class ServerList extends AvonCommand {
    get name()    { return 'serverlist'; }
    get aliases() { return ['guildlist', 'servers', 'sl']; }
    get cat()     { return 'owner'; }

    async run(client, message, args, prefix) {
        try {
            if (!client.config.owners.includes(message.author.id)) return;

            // Collect guilds across all shards/clusters
            let allGuilds;
            try {
                const raw = await client.cluster.broadcastEval(c =>
                    c.guilds.cache.map(g => ({
                        id:               g.id,
                        name:             g.name,
                        memberCount:      g.memberCount,
                        createdTimestamp: g.createdTimestamp,
                        iconURL:          g.iconURL({ dynamic: true })
                    }))
                );
                allGuilds = raw.flat();
            } catch {
                // Single-shard fallback
                allGuilds = client.guilds.cache.map(g => ({
                    id:               g.id,
                    name:             g.name,
                    memberCount:      g.memberCount,
                    createdTimestamp: g.createdTimestamp,
                    iconURL:          g.iconURL({ dynamic: true })
                }));
            }

            // Sort by member count descending
            allGuilds.sort((a, b) => b.memberCount - a.memberCount);

            if (!allGuilds.length) {
                const c = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${client.emoji.cross} | No servers found.`)
                );
                return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [c] });
            }

            let page = 0;
            const { container, navRow, selectRow } = buildPage(client, allGuilds, page);

            const sent = await message.channel.send({
                flags: [MessageFlags.IsComponentsV2],
                components: [container, navRow, selectRow]
            });

            const collector = sent.createMessageComponentCollector({
                filter: i => {
                    if (i.user.id !== message.author.id) {
                        i.reply({ content: `${client.emoji.cross} | Owner only.`, ephemeral: true });
                        return false;
                    }
                    return true;
                },
                time: 300000 // 5 minutes
            });

            collector.on('collect', async interaction => {
                try {
                    // ── Navigation ──
                    if (interaction.isButton()) {
                        if (interaction.customId === 'sl_prev' && page > 0) page--;
                        else if (interaction.customId === 'sl_next') page++;
                        else if (interaction.customId === 'sl_refresh') {
                            // Re-fetch guilds
                            try {
                                const raw = await client.cluster.broadcastEval(c =>
                                    c.guilds.cache.map(g => ({
                                        id: g.id, name: g.name,
                                        memberCount: g.memberCount,
                                        createdTimestamp: g.createdTimestamp
                                    }))
                                );
                                allGuilds = raw.flat().sort((a, b) => b.memberCount - a.memberCount);
                            } catch {
                                allGuilds = client.guilds.cache.map(g => ({
                                    id: g.id, name: g.name,
                                    memberCount: g.memberCount,
                                    createdTimestamp: g.createdTimestamp
                                })).sort((a, b) => b.memberCount - a.memberCount);
                            }
                        }

                        const built = buildPage(client, allGuilds, page);
                        return interaction.update({
                            flags: [MessageFlags.IsComponentsV2],
                            components: [built.container, built.navRow, built.selectRow]
                        });
                    }

                    // ── Get invite ──
                    if (interaction.isStringSelectMenu() && interaction.customId === 'sl_invite') {
                        const guildId = interaction.values[0];
                        const guild   = client.guilds.cache.get(guildId);

                        if (!guild) {
                            return interaction.reply({
                                flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
                                components: [new ContainerBuilder().addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`${client.emoji.cross} | Could not find that server on this shard.`)
                                )]
                            });
                        }

                        // Try system channel → first text channel with invite permission
                        let invite = null;
                        let inviteError = null;
                        const channels = [
                            guild.systemChannel,
                            ...guild.channels.cache
                                .filter(c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has('CreateInstantInvite'))
                                .values()
                        ].filter(Boolean);

                        for (const ch of channels) {
                            try {
                                invite = await ch.createInvite({ maxAge: 0, maxUses: 0, unique: false, reason: 'ServerList — owner request' });
                                break;
                            } catch (e) {
                                inviteError = e.message;
                            }
                        }

                        const inviteText = invite
                            ? `${client.emoji.tick} | **Invite for ${guild.name}:**\nhttps://discord.gg/${invite.code}\n\n-# Max uses: unlimited • Expires: never`
                            : `${client.emoji.cross} | Could not create invite for **${guild.name}**.\n\`${inviteError || 'Missing permissions'}\``;

                        return interaction.reply({
                            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
                            components: [new ContainerBuilder().addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(inviteText)
                            )]
                        });
                    }
                } catch (e) { console.error('[ServerList]', e); }
            });

            collector.on('end', () => {
                sent.edit({ components: [] }).catch(() => {});
            });

        } catch (e) { console.error('[ServerList]', e); }
    }
}
module.exports = ServerList;
