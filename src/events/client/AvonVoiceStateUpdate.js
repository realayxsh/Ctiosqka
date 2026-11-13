const delay = require(`delay`);
const AvonClientEvent = require("../../structures/Eventhandler");
const { isPremium } = require('../../structures/premiumAccess');

class AvonVoiceStateUpdate extends AvonClientEvent {
    get name() { return 'voiceStateUpdate'; }
    async run(os, ns) {
        let guild = ns.guild || os.guild;
        let player = this.client.poru.players.get(guild.id);

        // Unmute if server-muted
        if (ns.guild.members.me.serverMute === true) {
            ns.guild.members.me.voice.setMute(false).catch(() => {});
        }

        // Bot's own voice state changed
        if (os.id === this.client.user.id) {
            // Bot was disconnected from VC
            if (!ns.channelId) {
                if (player) player.destroy().catch(() => {});
                return;
            }

            // Bot moved to a different channel — update player voiceId
            if (player && ns.channelId && ns.channelId !== os.channelId) {
                player.voiceId = ns.channelId;
                // The Lavalink player retains its selected filters across voice moves.
                // Do not replace them with a separate quality EQ.
            }
            return;
        }

        if (!player) return;

        // All humans left the VC — check 247 mode before auto-leaving
        const vc = guild.channels.cache.get(player.voiceId);
        if (!vc) return;
        const humanCount = vc.members.filter(m => !m.user.bot).size;
        if (humanCount > 0) return;

        const is247 = await this.client.data.get(`${guild.id}-247`);
        if (is247 === `enabled` && await isPremium(this.client, guild.id)) return;

        // Wait 1 minute — if still empty, leave
        await delay(60000);
        const freshPlayer = this.client.poru.players.get(guild.id);
        if (!freshPlayer) return;
        const freshVc = guild.channels.cache.get(freshPlayer.voiceId);
        if (!freshVc) return;
        const stillEmpty = freshVc.members.filter(m => !m.user.bot).size === 0;
        if (!stillEmpty) return;

        freshPlayer.destroy().catch(() => {});
        const ch = this.client.channels.cache.get(freshPlayer.textId);
        if (ch) {
            const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${this.client.emoji.cross} | Left the voice channel — no one was listening.`
                ));
            ch.send({ flags: [MessageFlags.IsComponentsV2], components: [container] }).catch(() => {});
        }
    }
}
module.exports = AvonVoiceStateUpdate;
