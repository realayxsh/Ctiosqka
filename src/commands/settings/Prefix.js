const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { invalidatePrefixCache } = require("../../structures/CommandHandler");

class Prefix extends AvonCommand{
    get name(){ return 'setprefix' }
    get cat(){ return 'set' }
    get vote(){ return true; }
    get aliases(){ return ['prefix','set-prefix'] }
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
        if(!args[0]) return send(`**${client.emoji.settings} | My current prefix is** \`${prefix}\``);
        if(!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) && !client.config.owners.includes(message.author.id)){
            return send(`**${client.emoji.cross} | You are lacking permissions: Manage Guild**`);
        }
        if(args[0].length > 3) return send(`**${client.emoji.cross} | Can't set a prefix having more than 3 characters**`);
        if(args[1]) return send(`**${client.emoji.cross} | You can't use spaces in the prefix**`);
        if(args[0] === client.config.prefix){
            client.data.delete(`${message.guild.id}-prefix`);
            invalidatePrefixCache(message.guild.id);
            return send(`**${client.emoji.settings} | Guild prefix has been reset**`);
        }
        client.data.set(`${message.guild.id}-prefix`, args[0]);
        invalidatePrefixCache(message.guild.id);
        return send(`**${client.emoji.settings} | Guild's prefix has been set to** \`${args[0]}\``);
    }
}
module.exports = Prefix;
