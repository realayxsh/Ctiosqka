const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Loop extends AvonCommand {
    get name() { return 'loop' }
    get aliases() { return ['repeat', 'lop'] }
    get inVoice() { return true; }
    get cat() { return 'music' }
    get sameVoice() { return true; }
    get player() { return true; }
    async run(client, message, args, prefix, player) {
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

            let mode = player.loop === 'track' ? 'Track' : player.loop === 'queue' ? 'Queue' : 'Off';

            if (!args[0]) return send(`${client.emoji.loop || client.emoji.music} **| Loop mode is currently set to ${mode}**\nUse \`${prefix}loop <off/track/queue>\``);

            let op = args[0].toLowerCase();
            if (op === 'off') { player.setLoop('none'); return send(`${client.emoji.loop || client.emoji.music} **| Loop mode has been set to Off**`); }
            if (op === 'track') { player.setLoop('track'); return send(`${client.emoji.loop || client.emoji.music} **| Loop mode has been set to Track**`); }
            if (op === 'queue') { player.setLoop('queue'); return send(`${client.emoji.loop || client.emoji.music} **| Loop mode has been set to Queue**`); }
            return send(`${client.emoji.cross} **| Use \`${prefix}loop <off/track/queue>\`**`);
        } catch (e) { console.log(e) }
    }
}
module.exports = Loop;
