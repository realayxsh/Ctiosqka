const { EmbedBuilder } = require("discord.js");
const AvonClientEvent = require(`../../structures/Eventhandler`);
const wh = require('../../structures/webhook');

class AvonGuildCreate extends AvonClientEvent{
    get name(){ return 'guildCreate' }
    async run(guild){
        try{
            await Promise.all([
                this.client.data.set(`${guild.id}-247`, `disabled`),
                this.client.data.set(`${guild.id}-autoPlay`, `disabled`),
                this.client.data2.set(`noprefix_${guild.id}`, []),
            ]).catch(error => wh.error('Server join defaults failed', error));
            console.log(`[GUILD] Joined: ${guild.name} (${guild.id}) | Members: ${guild.memberCount}`);

            let owner = await guild?.fetchOwner().catch(() => null);
            const embed = new EmbedBuilder()
                .setTitle(`✅ Guild Joined`)
                .setColor(0x00FF7F)
                .setThumbnail(guild.iconURL({ dynamic: true }) || this.client.user.displayAvatarURL())
                .addFields(
                    { name: `Server`,       value: `${guild.name} (\`${guild.id}\`)`,                          inline: false },
                    { name: `Members`,      value: `\`${guild.memberCount}\``,                                  inline: true  },
                    { name: `Owner`,        value: `${owner?.user?.tag || 'Unknown'} (\`${guild.ownerId}\`)`,  inline: true  },
                    { name: `Created`,      value: `<t:${Math.round(guild.createdTimestamp/1000)}:R>`,          inline: true  },
                    { name: `Total Servers`,value: `\`${this.client.guilds.cache.size}\``,                      inline: true  }
                )
                .setTimestamp();
            await wh.send(embed, 'join');
        } catch(e){ wh.error('Bot server join event failed', e); }
    }
}
module.exports = AvonGuildCreate;
