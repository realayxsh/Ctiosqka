const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class DisableChannel extends AvonCommand{
    get name(){ return 'disablechannel'; }
    get aliases(){ return ['disable','togglechannel'] }
    get cat(){ return 'set' }
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

        if(!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) && !client.config.owners.includes(message.author.id)){
            return send(`${client.emoji.warning} | **You need Manage Channels permission to use this.**`);
        }

        let target = message.mentions.channels.first() || (args[0] ? message.guild.channels.cache.get(args[0]) : message.channel);
        if (!target) return send(`${client.emoji.cross} | Please select a valid channel in this server.`);
        let key = `disabled_channel_${message.guild.id}_${target.id}`;
        let current = await client.data.get(key);

        if (this.name === 'enablechannel') {
            if (current !== 'disabled') return send(`${client.emoji.tick} | Bot commands are already **enabled** in ${target}`);
            await client.data.delete(key);
            return send(`${client.emoji.tick} | **Enabled** bot commands in ${target}`);
        }

        if(current === `disabled`){
            await client.data.delete(key);
            return send(`${client.emoji.tick} | **Enabled** bot commands in ${target}`);
        } else {
            await client.data.set(key, `disabled`);
            return send(`${client.emoji.cross} | **Disabled** bot commands in ${target}`);
        }
    }
}
module.exports = DisableChannel;
