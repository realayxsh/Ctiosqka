const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Disconnect extends AvonCommand {
    get name() { return 'disconnect' }
    get aliases() { return ['dc', 'leave'] }
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
        if (!player) return send(`${client.emoji.cross} **| There is no player for this guild**`);
        player.destroy();
        return send(`${client.emoji.disconnect || client.emoji.music} **| Disconnected and cleared the queue**`);
    }
}
module.exports = Disconnect;
