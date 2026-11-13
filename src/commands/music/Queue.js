const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const ms = require('ms');
const lodash = require(`lodash`);

class Queue extends AvonCommand {
    get name() { return 'queue'; }
    get aliases() { return ['q', 'que']; }
    get inVoice() { return false; }
    get sameVoice() { return false; }
    get player() { return true; }
    get cat() { return 'music' }

    async run(client, message, args, prefix, player) {
        try {

            const buildContainer = (page, pages, withButtons) => {
                const nowPlaying = `**Now Playing**\n> ${client.emoji.music} [${player.queue.current.title}](${player.queue.current.uri || client.config.server}) ${client.emoji.arrow} ${ms(player.queue.current.length)}`;
                const comingUp = pages[page] ? `\n\n**Coming Up**\n${pages[page]}` : '';
                const footer = pages.length > 1 ? `\n\n-# Page ${page + 1} of ${pages.length}` : '';

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`**${message.guild.name}'s Queue**`)
                            )
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL({ dynamic: true }))
                            )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(nowPlaying + comingUp + footer)
                    );

                if (withButtons) {
                    container.addSeparatorComponents(new SeparatorBuilder().setDivider(false))
                        .addActionRowComponents(
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(`prev`).setLabel(`Previous`),
                                new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(`nxt`).setLabel(`Next`)
                            )
                        );
                }
                return container;
            };

            if (player.queue.length) {
                let queuedSongs = player.queue.map((track, index) =>
                    `\`[${index + 1}]\` ${client.emoji.music} [${track.title.substring(0, 45)}](${track.uri || client.config.server}) ${client.emoji.arrow} ${ms(track.length)}`
                );
                const maps = lodash.chunk(queuedSongs, 10);
                const pages = maps.map(x => x.join('\n'));
                let page = 0;

                if (player.queue.length < 11) {
                    return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [buildContainer(page, pages, false)] });
                }

                let msg = await message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [buildContainer(page, pages, true)] });

                let call = msg.createMessageComponentCollector({
                    filter: (b) => {
                        if (b.user.id === message.author.id) return true;
                        b.reply({ content: `${client.emoji.cross} | This is not your session`, ephemeral: true });
                        return false;
                    },
                    time: 60000 * 5
                });

                call.on("collect", async (b) => {
                    if (!b.isButton()) return;
                    await b.deferUpdate().catch(() => {});
                    if (b.customId === `nxt`) page = page + 1 < pages.length ? ++page : 0;
                    else if (b.customId === `prev`) page = page > 0 ? --page : pages.length - 1;
                    await msg.edit({ flags: [MessageFlags.IsComponentsV2], components: [buildContainer(page, pages, true)] });
                });

                call.on('end', async () => {
                    if (!msg) return;
                    await msg.edit({ flags: [MessageFlags.IsComponentsV2], components: [buildContainer(page, pages, false)] }).catch(() => {});
                });

            } else {
                const nowPlayingOnly = `**Now Playing**\n> ${client.emoji.music} [${player.queue.current.title}](${player.queue.current.uri || client.config.server}) ${client.emoji.arrow} ${ms(player.queue.current.length)}`;
                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`**${message.guild.name}'s Queue**`)
                            )
                            .setThumbnailAccessory(
                                new ThumbnailBuilder().setURL(message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL({ dynamic: true }))
                            )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(nowPlayingOnly)
                    );
                return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
            }
        } catch (e) { console.log(e) }
    }
}
module.exports = Queue;
