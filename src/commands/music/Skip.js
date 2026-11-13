const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Skip extends AvonCommand {
    get name() { return 'skip' }
    get aliases() { return ['s', 'sk', 'next'] }
    get inVoice() { return true; }
    get cat() { return 'music' }
    get sameVoice() { return true; }
    get player() { return true; }
    async run(client, message, args, prefix, player) {
        player.skip();
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${client.emoji.skip || client.emoji.music} **| Skipped the current track**`)
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true }))
                    )
            );
        return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
    }
}
module.exports = Skip;
