const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { isVotingEnabled } = require('../../structures/voting');

class Vote extends AvonCommand{
    get name(){ return 'vote' }
    get aliases(){ return ['vot'] }
    get cat(){ return 'info' }
    async run(client, message, args, prefix){
        if (!isVotingEnabled(client)) return message.channel.send({ content: `${client.emoji.warning} | Voting is temporarily disabled.` });
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `${client.emoji.info} | Click **[here](https://top.gg/bot/1097475016880304180/vote)** to vote for **${client.user.username}**!`
                    ))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL()))
            );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://top.gg/bot/1097475016880304180/vote`).setLabel(`Vote`)
        );
        return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container, row] });
    }
}
module.exports = Vote;
