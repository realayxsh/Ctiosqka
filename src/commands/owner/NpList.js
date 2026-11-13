const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class NpList extends AvonCommand{
    get name(){ return 'nplist'; }
    get aliases(){ return ['noprefixlist','npl']; }
    async run(client, message, args, prefix){
        try{
            let ok = [...client.config.owners, ...(client.config.coowners || [])];
            if(!ok.includes(message.author.id)) return;

            const send = (text, thumb) => {
                const container = new ContainerBuilder();
                if(thumb){
                    container.addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb))
                    );
                } else {
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
                }
                return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
            };

            // Global (all-server) noprefix list
            const globalDb = await client.data2.get(`noprefix_${client.user.id}`) || [];

            if(globalDb.length === 0) return send(`${client.emoji.cross} | No users have global no-prefix.`);

            const lines = globalDb.map((id, i) => `\`${i+1}\` <@${id}> | \`${id}\``);

            return send(
                `**${client.emoji.users} | Global No-Prefix List (${globalDb.length})**\n\n${lines.join('\n')}\n\n-# Use \`${prefix}noprefix remove <user_id> all\` to remove`,
                message.author.displayAvatarURL({ dynamic: true })
            );
        } catch(e){ console.log('[NpList Error]', e.message, e.stack); }
    }
}
module.exports = NpList;
