const delay = require("delay");
const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const AvonClientEvent = require("../../structures/Eventhandler");
const wh = require('../../structures/webhook');
const { continueAutoplay } = require('../../audio/autoplay');
const { isPremium } = require('../../structures/premiumAccess');
const { isVotingEnabled } = require('../../structures/voting');

class PlayerEmpty extends AvonClientEvent{
    get name(){ return 'playerEmpty'; }
    async run(player){
        wh.music('Queue empty', player);
        // Check 247 FIRST so we never show "Queue Concluded" while in 247 mode
        let data = await this.client.data.get(`${player.guildId}-247`);
        if(!data || data === null) this.client.data.set(`${player.guildId}-247`, `disabled`);
        let db = await this.client.data.get(`${player.guildId}-autoPlay`);
        if(!db || db === null) this.client.data.set(`${player.guildId}-autoPlay`, `disabled`);
        const premium = (data === 'enabled' || db === 'enabled') &&
            await isPremium(this.client, player.guildId);
        const is247 = data === `enabled` && premium;
        if (!premium) db = 'disabled';

        if(db === `enabled`){
            try {
                if (await continueAutoplay(this.client, player)) return;
            } catch(e) {
                wh.error('Autoplay playback failed', e);
                console.warn('[Autoplay] Could not start a recommendation');
            }
            const channel = this.client.channels.cache.get(player.textId) ||
                await this.client.channels.fetch(player.textId).catch(() => null);
            const container = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${this.client.emoji.warning} | Autoplay couldn't find a playable new song. Add a song with /play to continue.`
                )
            );
            await channel?.send({ flags: [MessageFlags.IsComponentsV2], components: [container] }).catch(() => {});
        }

        // Only show "Queue Concluded" if NOT in 247 mode
        if(db !== `enabled` && !is247){
            let ch = this.client.channels.cache.get(player.textId);
            if(!ch) ch = await this.client.channels.fetch(player.textId).catch(() => null);
            let guild = this.client.guilds.cache.get(player.guildId);
            if(ch){
                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${this.client.emoji.queue} | Queue Concluded**`))
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(guild?.iconURL({ dynamic: true }) || this.client.user.displayAvatarURL()))
                    );
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://top.gg/bot/1097475016880304180/vote`).setLabel(`Vote`)
                );
                ch.send({ flags: [MessageFlags.IsComponentsV2], components: isVotingEnabled(this.client) ? [container, row] : [container] }).catch(() => {});
            }
        }

        // If 247 is enabled, just stay silent in the VC — no destroy, no message
        if(is247) return;

        // Not 247: wait 3 minutes then destroy if still idle
        await delay(180000);
        let activePlayer = this.client.poru.players.get(player.guildId);
        if(!activePlayer) return;
        if(activePlayer !== player || activePlayer.playing || activePlayer.queue.size > 0 || activePlayer.queue.current) return;
        activePlayer.destroy().catch(() => {});
        let ch = this.client.channels.cache.get(player.textId);
        if(!ch){
            let channel = await this.client.channels.fetch(player.textId).catch(() => null);
            if(!channel) return;
            else ch = channel;
        }
        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `${this.client.emoji.warning} | Enable 247 mode of **${this.client.user.username}** to keep me in the voice channel.`
            ));
        ch.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
    }
}
module.exports = PlayerEmpty;
