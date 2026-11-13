const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Volume extends AvonCommand {
    get name() { return 'volume' }
    get aliases() { return ['vol', 'volu'] }
    get player() { return false; }
    get cat() { return 'music' }
    get inVoice() { return true; }
    get sameVoice() { return true; }
    async run(client, message, args, prefix) {
        try {
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
            if (!player) return await send(`${client.emoji.cross} **| I am not playing anything**`);
            if (!args[0]) return await send(`${client.emoji.volume || client.emoji.music} **| Current volume: ${player.volume}%**`);

            let vol = Number(args[0]);
            if (isNaN(vol) || vol < 0 || vol > 200) return await send(`${client.emoji.cross} **| Volume must be between 0 and 200**`);
            if (player.volume === vol) return await send(`${client.emoji.warning} **| Volume is already set to ${vol}%**`);

            // Use the native player volume once. Filter volume is preset headroom,
            // not a second copy of the user's volume percentage.
            await player.setVolume(vol);

            return await send(`${client.emoji.volume || client.emoji.music} **| Volume set to ${vol}%**`);
        } catch (e) { console.log('[Volume Error]', e.message); }
    }
}
module.exports = Volume;
