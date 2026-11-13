const { restoreListeningStatus } = require('../../structures/listeningStatus');
const AvonClientEvent = require("../../structures/Eventhandler");
const wh = require("../../structures/webhook");
const { registerCommands } = require('../../slash/register');
const { isPremium } = require('../../structures/premiumAccess');
class AvonReady extends AvonClientEvent{
    get name(){
        return 'clientReady';
    }
    async run(){
        console.log(`${this.client.user.username} is Online!`);
        await restoreListeningStatus(this.client);
        wh.initWebhook();
        wh.info('Bot online', `**Bot ID:** ${this.client.user.id}\n**Cluster:** ${this.client.cluster?.id ?? 0}\n**Servers in this cluster:** ${this.client.guilds.cache.size}`);
        if(!this.client.cluster || this.client.cluster.id === 0) {
            try {
                const registered = await registerCommands(this.client.rest, this.client.user.id, {
                    guildIds: [...this.client.guilds.cache.keys()],
                });
                console.log(`[Slash Commands] ${registered.count} public commands registered; removed ${registered.removed} legacy guild commands. Owner commands remain message-only.`);
                wh.info('Slash commands ready', `${registered.count} public slash commands registered. Owner commands remain message-only.`);
            } catch (error) {
                wh.error('Slash registration failed', error);
                console.error(`[Slash Commands] Registration failed (${error?.code || error?.name || 'Error'})`);
            }
        }
        this.client.guilds.cache.forEach(async x => {
            let data =  await this.client.data.get(`${x.id}-247`);
            if(!data || data === null)  this.client.data.set(`${x.id}-247`,`disabled`)  ;
            if(data === `disabled`) return;
            if(data === `enabled`)
            {
                try{
                    if (!await isPremium(this.client, x.id)) return;
                    await this.client.poru.createPlayer({
                        guildId : x.id,
                        voiceId : await this.client.data.get(`${x.id}-voice`),
                        textId : await this.client.data.get(`${x.id}-text`),
                        volume : 100,
                        shardId : x.shardId,
                        deaf : true
                    });
                }
                catch(e){
                    this.client.data.set(`${x.id}-247`,`disabled`);
                    this.client.data.delete(`${x.id}-text`);
                    this.client.data.delete(`${x.id}-voice`);
                }
            }
        })
    }
}
module.exports = AvonReady;