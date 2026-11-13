const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Invite extends AvonCommand{
    get name(){ return 'invite' }
    get aliases(){ return 'inv' }
    get cat(){ return 'info'; }
    async run(client, message, args, prefix){
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `Click **[here](https://discord.com/oauth2/authorize?client_id=1570724994919563304&permissions=274881399809&integration_type=0&scope=bot)** to invite **${client.user.username}** to your server!`
                    ))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL()))
            );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/oauth2/authorize?client_id=1570724994919563304&permissions=274881399809&integration_type=0&scope=bot`).setLabel(`Invite`)
        );
        return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container, row] });
    }
}
module.exports = Invite;
