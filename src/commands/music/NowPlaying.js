const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { getServerBrand } = require("../../structures/serverBrand");
const ms = require("ms");

function buildPremiumRow(client) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Get Premium').setURL(client.config.server)
    );
}

function buildContainer(client, track, player, brandIcon) {
    let position = player.position || 0;
    let duration = track.length || 0;
    let size = 15;
    let filled = duration > 0 ? Math.min(Math.round((position / duration) * size), size - 1) : 0;
    let bar = `${'▬'.repeat(filled)}●${'▬'.repeat(size - 1 - filled)}`;
    let loopMode = player.loop === 'track' ? '🔂 Track' : player.loop === 'queue' ? '🔁 Queue' : '➡️ Off';
    const thumb = track.thumbnail || brandIcon || client.user.displayAvatarURL({ dynamic: true });

    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${client.emoji.nowplaying || client.emoji.music} | Now Playing**\n\n**[${track.title}](${track.uri || client.config.server})**\n\n${bar}\n\`${ms(position)} / ${ms(duration)}\`\n\n${client.emoji.users} **Requester:** ${track.requester}\n${client.emoji.music} **Loop:** ${loopMode}\n${client.emoji.ping} **Volume:** ${player.volume}%`
                    )
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(thumb)
                )
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Updates every 5 seconds`)
        );

    return container;
}

class NowPlaying extends AvonCommand {
    get name() { return 'nowplaying'; }
    get aliases() { return ['np', 'current', 'playing']; }
    get cat() { return 'music'; }
    get player() { return true; }
    get inVoice() { return false; }
    get sameVoice() { return false; }

    async run(client, message, args, prefix, player) {
        try {
            let track = player.queue.current;
            if (!track) {
                const noTrackContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${client.emoji.cross} No track is currently playing.`)
                    );
                return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [noTrackContainer] });
            }

            const brand = await getServerBrand(client, message.guild.id);
            const brandIcon = brand.icon || null;

            let msg = await message.channel.send({
                flags: [MessageFlags.IsComponentsV2],
                components: [buildContainer(client, track, player, brandIcon), buildPremiumRow(client)]
            });

            let updates = 0;
            let interval = setInterval(async () => {
                try {
                    updates++;
                    let currentPlayer = client.poru.players.get(message.guild.id);
                    let currentTrack = currentPlayer?.queue?.current;

                    if (!currentPlayer || !currentTrack || updates >= 24) {
                        clearInterval(interval);
                        if (msg.editable) {
                            const doneContainer = new ContainerBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`${client.emoji.music} No longer updating.`)
                                );
                            await msg.edit({ flags: [MessageFlags.IsComponentsV2], components: [doneContainer] }).catch(() => {});
                        }
                        return;
                    }

                    await msg.edit({
                        flags: [MessageFlags.IsComponentsV2],
                        components: [buildContainer(client, currentTrack, currentPlayer, brandIcon), buildPremiumRow(client)]
                    }).catch(() => { clearInterval(interval); });
                } catch (e) {
                    clearInterval(interval);
                }
            }, 5000);

        } catch (e) { console.log(e); }
    }
}
module.exports = NowPlaying;
