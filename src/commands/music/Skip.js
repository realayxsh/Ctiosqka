const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const wh = require('../../structures/webhook');

class Skip extends AvonCommand {
    get name() { return 'skip' }
    get aliases() { return ['s', 'sk', 'next'] }
    get inVoice() { return true; }
    get cat() { return 'music' }
    get sameVoice() { return true; }
    get player() { return true; }
    async run(client, message, args, prefix, player) {
        const send = text => {
            const container = new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(text)
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true }))
                    )
            );
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };
        if (!args.length) {
            player.skip();
            return send(`${client.emoji.skip || client.emoji.music} **| Skipped the current track**`);
        }
        if (args.length !== 1 || !/^[1-9]\d*$/.test(args[0]) || !Number.isSafeInteger(Number(args[0]))) {
            return send(`${client.emoji.warning} | Use a whole queue position, starting at **1**.\nUsage: \`${prefix}skip [position]\``);
        }
        const position = Number(args[0]);
        if (!player.queue.length) return send(`${client.emoji.warning} | There are no songs in the upcoming queue.`);
        if (position > player.queue.length) {
            return send(`${client.emoji.warning} | That queue position doesn't exist. Choose **1–${player.queue.length}**.`);
        }
        const current = player.queue.current;
        const target = player.queue[position - 1];
        const removed = player.queue.splice(0, position);
        try {
            // Explicit replacement jumps past track-repeat without disabling it.
            // Queue positions match the numbered Coming Up list in queue.
            await player.play(target, { replaceCurrent: true });
        } catch (error) {
            player.queue.unshift(...removed);
            if (player.queue.current === target) player.queue.current = current;
            player.queue.emitChanges?.();
            wh.error('Skip to queue position failed', error);
            return send(`${client.emoji.cross} | Could not jump to that song. The queued songs have been restored.`);
        }
        if (current && Array.isArray(player.queue.previous) && !player.queue.previous.includes(current)) {
            player.queue.previous.unshift(current);
        }
        if (player.loop === 'queue') {
            // Queue-repeat rotates bypassed songs instead of losing them.
            player.queue.push(...[current, ...removed.slice(0, -1)].filter(Boolean));
        }
        player.queue.emitChanges?.();
        if (player.queue.current !== target) {
            return send(`${client.emoji.warning} | The selected song couldn't be played. Playback continued to the next available song.`);
        }
        return send(`${client.emoji.skip || client.emoji.music} **| Skipped to queue position ${position}**\n\n${client.emoji.music} **${target.title}**`);
    }
}
module.exports = Skip;
