const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Pause extends AvonCommand {
    get name() { return 'pause'; }
    get aliases() { return ['roko', 'pau'] }
    get player() { return true; }
    get cat() { return 'music' }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    async run(client, message, args, prefix, player) {
        const text = player.paused ? `${client.emoji.cross} **| Player is already paused**` : `${client.emoji.pause || client.emoji.music} **| Paused the player**`;
        if (!player.paused) player.pause(true);
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
            );
        return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
    }
}
module.exports = Pause;
