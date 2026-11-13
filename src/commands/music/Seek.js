const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Seek extends AvonCommand {
    get name() { return 'seek' }
    get aliases() { return [''] }
    get cat() { return 'music' }
    get player() { return true; }
    get inVoice() { return true; }
    get sameVoice() { return true; }
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
        if (!args[0]) return send(`${client.emoji.cross} **| Usage: \`${prefix}seek <seconds>\` e.g. \`${prefix}seek 90\`**`);
        const secs = parseInt(args[0]);
        if (isNaN(secs) || secs < 0) return send(`${client.emoji.cross} **| Provide a valid number of seconds**`);
        if (!player.queue.current.isSeekable) return send(`${client.emoji.cross} **| This track is not seekable**`);
        player.seek(secs * 1000);
        return send(`${client.emoji.seek || client.emoji.music} **| Seeked to ${secs}s**`);
    }
}
module.exports = Seek;
