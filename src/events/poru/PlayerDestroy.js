const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const AvonClientEvent = require("../../structures/Eventhandler");
const wh = require('../../structures/webhook');
const { isPremium } = require('../../structures/premiumAccess');
const { clearVoiceStatus } = require('../../structures/voiceStatus');

const recreateCooldown = new Map();
const COOLDOWN_MS = 15000;

class PlayerDestroy extends AvonClientEvent{
    get name(){ return 'playerDestroy' }
    async run(player){
        wh.music('Player destroyed', player);
        await clearVoiceStatus(this.client, player);
        try{ player.data.get('music').delete() } catch(e) { }
        let guild = this.client.guilds.cache.get(player.guildId);
        if(!guild) return;
        let db = await this.client.data.get(`${guild.id}-247`);
        if(!db) return;
        if(db === `disabled`) return;
        if(db === `enabled`){
            if (!await isPremium(this.client, guild.id)) return;
            const now = Date.now();
            const lastRecreate = recreateCooldown.get(guild.id) || 0;
            if(now - lastRecreate < COOLDOWN_MS) return;

            let channel = guild.channels.cache.get(await this.client.data.get(`${guild.id}-voice`));
            if(!channel){
                this.client.data.delete(`${guild.id}-text`);
                this.client.data.delete(`${guild.id}-voice`);
                return;
            }
            if(guild.members.me.permissions.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])){
                try{
                    let text = guild.channels.cache.get(await this.client.data.get(`${guild.id}-text`));
                    recreateCooldown.set(guild.id, now);
                    this.client.poru.createPlayer({
                        guildId: guild.id,
                        textId: text.id,
                        voiceId: channel.id,
                        deaf: true,
                        volume: 100,
                        shardId: guild.shardId
                    });
                    const container = new ContainerBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${this.client.emoji.mode247 || this.client.emoji.settings} | 247 player recreated**`));
                    return text.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
                } catch(e){
                    this.client.data.set(`${guild.id}-247`, `disabled`);
                    this.client.data.delete(`${guild.id}-text`);
                    this.client.data.delete(`${guild.id}-voice`);
                    return;
                }
            } else {
                this.client.data.delete(`${guild.id}-text`);
                this.client.data.delete(`${guild.id}-voice`);
            }
        }
    }
}
module.exports = PlayerDestroy;
