const AvonCommand = require('../../structures/avonCommand');
const { isOwner } = require('../../structures/ownerMessages');
const { DEFAULT_LISTENING, setListeningStatus } = require('../../structures/listeningStatus');

class SetListening extends AvonCommand {
    get name() { return 'setlistening'; }
    get aliases() { return ['listening']; }
    get cat() { return 'owner'; }

    async run(client, message, args) {
        if (!isOwner(client, message.author.id)) return;
        const input = args.join(' ').trim();
        if (!input) {
            return message.reply({ content: `${client.emoji.info} | Use \`setlistening <text>\` or \`setlistening reset\`.` });
        }
        const text = input.toLowerCase() === 'reset' ? DEFAULT_LISTENING : input;
        if (Array.from(text).length > 128) {
            return message.reply({ content: `${client.emoji.cross} | Listening text must be 128 characters or fewer.` });
        }
        await setListeningStatus(client, text);
        return message.reply({
            content: `${client.emoji.tick} | Listening status updated to: ${text}`,
            allowedMentions: { parse: [] },
        });
    }
}

module.exports = SetListening;
