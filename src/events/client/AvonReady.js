const { restoreListeningStatus } = require('../../structures/listeningStatus');
const AvonClientEvent = require("../../structures/Eventhandler");
const wh = require("../../structures/webhook");
const { registerCommands } = require('../../slash/register');
const { isPremium } = require('../../structures/premiumAccess');
const { syncPremiumBranding } = require('../../structures/premiumBranding');
const { syncNoPrefixExpirations } = require('../../structures/noprefixExpiry');
class AvonReady extends AvonClientEvent{
    get name(){
        return 'clientReady';
    }
    async run(){
        console.log(`${this.client.user.username} is Online!`);
        const retryPremiumSync = guild => {
            const timer = setTimeout(() => {
                syncPremiumBranding(this.client, guild).catch(error => {
                    console.warn(`[Premium Branding] Could not sync a server profile (code ${Number(error?.code) || 'unknown'}); retrying.`);
                    retryPremiumSync(guild);
                });
            }, 60_000);
            timer.unref?.();
        };
        await restoreListeningStatus(this.client);
        try {
            await syncNoPrefixExpirations(this.client);
        } catch {
            console.warn('[No-Prefix Expiry] Could not reconcile timed grants at startup.');
        }
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
            try {
                await syncPremiumBranding(this.client, x);
            } catch (error) {
                console.warn(`[Premium Branding] Could not sync a server profile (code ${Number(error?.code) || 'unknown'}).`);
                retryPremiumSync(x);
            }
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