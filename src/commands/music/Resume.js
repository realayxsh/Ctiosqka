const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Resume extends AvonCommand {
    get name() { return 'resume' }
    get aliases() { return ['chalu', 'res'] }
    get player() { return true }
    get cat() { return 'music' }
    get inVoice() { return true }
    get sameVoice() { return true }
    async run(client, message, args, prefix, player) {
        const text = !player.paused ? `${client.emoji.warning} **| Player is already resumed**` : `${client.emoji.resume || client.emoji.music} **| Resumed the player**`;
        if (player.paused) player.pause(false);
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
            );
        return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
    }
}
module.exports = Resume;
