const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const AvonClientEvent = require("../../structures/Eventhandler");
const wh = require('../../structures/webhook');

class TrackStuck extends AvonClientEvent {
    get name() { return 'trackStuck'; }
    async run(player, track, data) {
        wh.music('Track stuck', player);
        wh.error('Music track stuck', { name: 'PlaybackError' });
        try {
            const ch = this.client.channels.cache.get(player.textId);
            console.warn(`[TrackStuck] Guild: ${player.guildId} | Track: ${track?.title} | Threshold: ${data?.thresholdMs}ms`);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${this.client.emoji.cross} | Track got stuck — skipping **${track?.title || 'this track'}**.`
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
        } catch (e) { console.error('[TrackStuck handler]', e); }
    }
}
module.exports = TrackStuck;
