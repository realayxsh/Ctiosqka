const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Stop extends AvonCommand {
    get name() { return 'stop'; }
    get aliases() { return ['st']; }
    get player() { return true; }
    get cat() { return 'music' }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    async run(client, message, args, prefix, player) {
        player.destroy().catch(() => {});
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${client.emoji.stop || client.emoji.music} **| Destroyed the player**`)
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true }))
                    )
            );
        return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
    }
}
module.exports = Stop;
