const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Restart extends AvonCommand {
    get name() { return 'restart'; }
    get aliases() { return ['replay']; }
    get cat() { return 'music' }
    get player() { return true; }
    get inVoice() { return true }
    get sameVoice() { return true; }
    async run(client, message, args, prefix, player) {
        player.seek(0);
        const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.restart || client.emoji.music} **| Restarted the currently playing song**`))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
            );
        return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
    }
}
module.exports = Restart;
