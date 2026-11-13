const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Remove extends AvonCommand {
    get name() { return 'remove' }
    get aliases() { return [] }
    get player() { return false; }
    get cat() { return 'music' }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    async run(client, message, args, prefix) {
        const send = (text) => {
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
                );
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };
        let player = client.poru.players.get(message.guild.id);
        if (!player) return send(`${client.emoji.cross} **| No player is initiated**`);
        if (!args[0] || isNaN(args[0])) return send(`${client.emoji.cross} **| Provide a number to remove from queue**`);
        const idx = parseInt(args[0]);
        if (idx < 2) return send(`${client.emoji.cross} **| You cannot remove the currently playing song**`);
        if (idx > player.queue.length + 1) return send(`${client.emoji.cross} **| That position doesn't exist in the queue**`);
        player.queue.remove(idx - 1);
        return send(`${client.emoji.remove || client.emoji.queue} **| Removed the track**`);
    }
}
module.exports = Remove;
