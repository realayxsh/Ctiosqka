const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class ClearQueue extends AvonCommand {
    get name() { return 'clearqueue' }
    get aliases() { return ['clear', 'cq'] }
    get player() { return true; }
    get cat() { return 'music' }
    get inVoice() { return true }
    get sameVoice() { return true; }
    async run(client, message, args, prefix, player) {
        player.queue.clear();
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.clearqueue || client.emoji.queue} **| Successfully cleared the queue**`))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
            );
        return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
    }
}
module.exports = ClearQueue;
