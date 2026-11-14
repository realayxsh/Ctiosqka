const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class ListPremium extends AvonCommand{
    get name(){ return 'listpremium' }
    get aliases(){ return ['premiumlist','listprem','plists']; }
    async run(client, message, args, prefix){
        try{
            if(!client.config.owners.includes(message.author.id)) return;

            const send = (text, thumb) => {
                const section = new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
                if(thumb) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb));
                const container = new ContainerBuilder().addSectionComponents(section);
                return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
            };

            let list = [];
            for(let g of client.guilds.cache.values()){
                let data = await client.data3.get(`premium_${g.id}`);
                if(!data) continue;
                let isLifetime = data.expiresAt === null;
                let isActive   = isLifetime || Date.now() < data.expiresAt;
                if(!isActive){ await client.data3.delete(`premium_${g.id}`); continue; }
                let expText = isLifetime ? '`Lifetime`' : `<t:${Math.floor(data.expiresAt/1000)}:R>`;
                list.push(`\`${list.length+1}\` **${g.name}** | \`${g.id}\` | ${g.memberCount} members | Expires: ${expText}`);
            }

            if(list.length === 0) return send(`${client.emoji.cross} | No servers have premium active currently.`);

            return send(
                `**${client.emoji.premium} | Premium Servers (${list.length})**\n\n${list.join('\n')}\n\n-# Use ${prefix}revokepremium <server_id> to remove premium`,
                message.author.displayAvatarURL({ dynamic: true })
            );
        } catch(e){ console.log(e) }
    }
}
module.exports = ListPremium;
