const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const os = require("os");

class Stats extends AvonCommand{
    get name(){ return 'stats' }
    get aliases(){ return ['botstats','statistics','botinfo']; }
    async run(client, message, args, prefix){
        try{
            if(!client.config.owners.includes(message.author.id)) return;

            const totalServers  = client.guilds.cache.size;
            const totalUsers    = client.guilds.cache.reduce((a,b) => a + b.memberCount, 0);
            const activePlayers = client.poru.players.size;

            const uptime   = process.uptime();
            const days     = Math.floor(uptime / 86400);
            const hours    = Math.floor((uptime % 86400) / 3600);
            const minutes  = Math.floor((uptime % 3600) / 60);
            const seconds  = Math.floor(uptime % 60);
            const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

            const memUsed  = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const memTotal = (os.totalmem() / 1024 / 1024).toFixed(2);
            const cpuLoad  = os.loadavg()[0].toFixed(2);
            const ping     = client.ws.ping;

            let premiumCount = 0;
            for(let g of client.guilds.cache.values()){
                let isPremium = await client.data3.get(`premium_${g.id}`);
                if(isPremium) premiumCount++;
            }

            const fields = [
                `${client.emoji.servers || '🌐'} **Servers** — \`${totalServers}\``,
                `${client.emoji.members || '👥'} **Users** — \`${totalUsers.toLocaleString()}\``,
                `${client.emoji.player  || '🎵'} **Active Players** — \`${activePlayers}\``,
                `${client.emoji.premium || '⭐'} **Premium Servers** — \`${premiumCount}\``,
                `${client.emoji.ping    || '🏓'} **Ping** — \`${ping}ms\``,
                `${client.emoji.uptime  || '⏱️'} **Uptime** — \`${uptimeStr}\``,
                `${client.emoji.ram     || '💾'} **RAM** — \`${memUsed} MB / ${memTotal} MB\``,
                `${client.emoji.cpu     || '🖥️'} **CPU Load** — \`${cpuLoad}%\``,
                `${client.emoji.nodejs  || '🟩'} **Node.js** — \`${process.version}\``,
            ].join('\n');

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${client.emoji.info} | ${client.user.username} Statistics**`))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ dynamic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(fields))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Requested by ${message.author.tag}`));

            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        } catch(e){ console.log(e) }
    }
}
module.exports = Stats;
