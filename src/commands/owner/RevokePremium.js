const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class RevokePremium extends AvonCommand{
    get name(){ return 'revokepremium' }
    get aliases(){ return ['removepremium','remprem','revokeprem']; }
    async run(client, message, args, prefix){
        try{
            if(!client.config.owners.includes(message.author.id)) return;

            const send = (text, thumb) => {
                const container = new ContainerBuilder();
                if (thumb) {
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

            if(!args[0]) return send(`${client.emoji.cross} | Usage: \`${prefix}revokepremium <server_id>\``);

            let guildId = args[0];
            let isPremium = await client.data3.get(`premium_${guildId}`);
            if(!isPremium) return send(`${client.emoji.cross} | Server \`${guildId}\` does not have premium active.`);

            await client.data3.delete(`premium_${guildId}`);
            let guildName = client.guilds.cache.get(guildId)?.name || guildId;

            return send(
                `**${client.emoji.premium} | Premium Revoked**\n\n${client.emoji.tick} | Premium has been **removed** from **${guildName}**.\n\nServer ID: \`${guildId}\``,
                message.author.displayAvatarURL({ dynamic: true })
            );
        } catch(e){ console.log(e) }
    }
}
module.exports = RevokePremium;
