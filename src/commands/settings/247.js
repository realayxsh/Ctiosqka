const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class twentyfourseven extends AvonCommand{
    get name(){ return '247'; }
    get premium(){ return true; }
    get aliases(){ return ['24-7','twentyfourseven','alwaysvc','24/7'] }
    get cat(){ return 'set' }
    get player(){ return true; }
    get inVoice(){ return true; }
    get sameVoice(){ return true; }
    async run(client, message, args, prefix){
        const send = (text) => {
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
                );
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };
        if(!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) && !client.config.owners.includes(message.author.id)){
            return send(`**${client.emoji.cross} | You are lacking permissions: Manage Guild**`);
        }
        let data = await client.data.get(`${message.guild.id}-247`);
        if(data !== `enabled`){
            await Promise.all([
                client.data.set(`${message.guild.id}-247`, `enabled`),
                client.data.set(`${message.guild.id}-text`, `${message.channel.id}`),
                client.data.set(`${message.guild.id}-voice`, `${message.member.voice.channelId}`)
            ]);
            return send(`**${client.emoji.mode247 || client.emoji.settings} | Enabled 247 Mode of ${client.user.username}**`);
        } else if(data === `enabled`){
            await Promise.all([
                client.data.set(`${message.guild.id}-247`, `disabled`),
                client.data.delete(`${message.guild.id}-text`),
                client.data.delete(`${message.guild.id}-voice`)
            ]);
            return send(`**${client.emoji.mode247 || client.emoji.settings} | Disabled 247 Mode of ${client.user.username}**`);
        }
    }
}
module.exports = twentyfourseven;
