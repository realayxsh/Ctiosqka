const { EmbedBuilder } = require("discord.js");
const AvonClientEvent = require("../../structures/Eventhandler");
const wh = require('../../structures/webhook');

class AvonGuildDelete extends AvonClientEvent{
    get name(){ return 'guildDelete'; }
    async run(guild){
        await Promise.all([
            this.client.data2.delete(`noprefix_${guild.id}`),
            this.client.data.delete(`${guild.id}-247`),
            this.client.data.delete(`${guild.id}-autoPlay`),
        ]).catch(error => wh.error('Server leave cleanup failed', error));
        console.log(`[GUILD] Left: ${guild.name} (${guild.id})`);

        const servers = await this.client.cluster.broadcastEval(c => c.guilds.cache.size).then(r => r.reduce((a,b)=>a+b,0)).catch(()=>0);
        const users   = await this.client.cluster.broadcastEval(c => c.guilds.cache.reduce((a,g)=>a+g.memberCount,0)).then(r=>r.reduce((a,b)=>a+b,0)).catch(()=>0);

        const embed = new EmbedBuilder()
            .setTitle(`❌ Guild Left`)
            .setColor(0xFF4444)
            .setThumbnail(guild.iconURL({ dynamic: true }) || this.client.user.displayAvatarURL())
            .addFields(
                { name: `Server`,        value: `${guild.name} (\`${guild.id}\`)`,              inline: false },
                { name: `Members`,       value: `\`${guild.memberCount}\``,                     inline: true  },
                { name: `Created`,       value: `<t:${Math.round(guild.createdTimestamp/1000)}:R>`, inline: true },
                { name: `Total Servers`, value: `\`${servers}\``,                               inline: true  },
                { name: `Total Users`,   value: `\`${users}\``,                                 inline: true  }
            )
            .setTimestamp();
        await wh.send(embed, 'leave');
    }
}
module.exports = AvonGuildDelete;
