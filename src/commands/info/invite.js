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
                        `Click **[here](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=2184571968&scope=bot%20applications.commands)** to invite **${client.user.username}** to your server!`
                    ))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL()))
            );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=2184571968&scope=bot%20applications.commands`).setLabel(`Invite`)
        );
        return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container, row] });
    }
}
module.exports = Invite;
