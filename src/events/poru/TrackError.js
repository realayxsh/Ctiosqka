const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const AvonClientEvent = require("../../structures/Eventhandler");
const wh = require('../../structures/webhook');

class TrackError extends AvonClientEvent {
    get name() { return 'trackError'; }
    async run(player, track, data) {
        wh.music('Track playback failed', player);
        wh.error('Music track error', data?.exception);
        try {
            const ch = this.client.channels.cache.get(player.textId);
            console.error(`[TrackError] Guild: ${player.guildId} | Track: ${track?.title} | Error: ${data?.exception?.message || JSON.stringify(data)}`);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${this.client.emoji.cross} | Track error — skipping **${track?.title || 'this track'}**.\n-# ${data?.exception?.message || 'Unknown error'}`
                ));
            ch?.send({ flags: [MessageFlags.IsComponentsV2], components: [container] }).catch(() => {});

            if (player.queue.size > 0) {
                player.stop();
            } else {
                // Check 247 before destroying — in 247 mode keep the player alive
                const is247 = await this.client.data.get(`${player.guildId}-247`);
                if(is247 === `enabled`) return;
                player.destroy();
            }
        } catch (e) { console.error('[TrackError handler]', e); }
    }
}
module.exports = TrackError;
