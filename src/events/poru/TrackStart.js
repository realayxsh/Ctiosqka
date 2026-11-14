const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, MessageFlags } = require("discord.js");
const AvonClientEvent = require(`../../structures/Eventhandler`);
const moment = require(`moment`);
require(`moment-duration-format`);

const { applyFilter } = require('../../audio/filters');
const wh = require('../../structures/webhook');
const { buildPlaybackRows } = require('../../structures/playbackControls');
const { isPremium } = require('../../structures/premiumAccess');
const { updateVoiceStatus } = require('../../structures/voiceStatus');

class TrackStart extends AvonClientEvent {
    get name() { return 'playerStart' }
    async run(player, track) {
        wh.music('Track started', player);
        let url = track.uri || '';
        const channel = this.client.channels.cache.get(player.textId);
        let duration = moment.duration(player.queue.current.length).format("hh:mm:ss");
        if (player.queue.current.length < 30000) {
            player.skip();
            const skipContainer = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${this.client.emoji.settings} Skipping this track as its duration is less than 30 seconds`)
                );
            return channel?.send({ flags: [MessageFlags.IsComponentsV2], components: [skipContainer] });
        }

        await updateVoiceStatus(this.client, player, track);

        try {
            const active = player.data.get('activeFilter');
            if (active && active !== 'none' && !await isPremium(this.client, player.guildId)) {
                await applyFilter(player, 'none');
            } else {
                await applyFilter(player, 'none', { initialize: true });
            }
        } catch (error) {
            wh.error('Audio filter initialization failed', error);
            console.warn('[Audio Filters] Could not initialize clean audio');
        }

        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**${this.client.emoji.nowplaying || this.client.emoji.music} | Now Playing**\n\n${this.client.emoji.music} **[${track.title}](${url})**\nby **${track.author}** — \`${duration}\`\n\n${this.client.emoji.users} **Requester:** ${track.requester}`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(track.requester.displayAvatarURL({ dynamic: true }))
                    )
            )
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
            .addActionRowComponents(...buildPlaybackRows(this.client, player));

        if (channel) {
            return channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] })
                .then(x => player.data.set("music", x));
        }
    }
}
module.exports = TrackStart;
