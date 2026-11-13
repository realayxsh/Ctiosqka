const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Previous extends AvonCommand {
    get name() { return 'previous'; }
    get aliases() { return ['prev']; }
    get cat() { return 'music'; }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    get player() { return true; }
    async run(client, message, args, prefix, player) {
        const send = (text) => {
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
                );
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };
        if (player.queue.previous === null) return send(`${client.emoji.cross} **| No previous song available**`);
        player.queue.unshift(player.queue.previous);
        player.skip();
        return send(`${client.emoji.previous || client.emoji.music} **| Playing previous track**`);
    }
}
module.exports = Previous;
