const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const AvonCommand = require('../../structures/avonCommand');
const { isOwner } = require('../../structures/ownerMessages');

class RevokePremiumCode extends AvonCommand {
    get name() { return 'revokepremcode'; }
    get aliases() { return ['revokepremiumcode', 'removepremcode', 'removepremiumcode']; }
    get cat() { return 'owner'; }

    async run(client, message, args, prefix) {
        if (!isOwner(client, message.author.id)) return;
        const code = args[0]?.trim().toUpperCase();
        const send = text => message.channel.send({
            flags: [MessageFlags.IsComponentsV2],
            components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))],
        });
        if (!code || args.length !== 1) {
            return send(`${client.emoji.info} | Usage: \`${prefix}revokepremcode <code>\``);
        }
        const codes = await client.data3.get('premium_codes') || [];
        const remaining = codes.filter(entry => String(typeof entry === 'string' ? entry : entry?.code || '').toUpperCase() !== code);
        if (remaining.length === codes.length) {
            return send(`${client.emoji.cross} | Unused Premium code \`${code}\` was not found.`);
        }
        await client.data3.set('premium_codes', remaining);
        return send(`${client.emoji.tick} | Unused Premium code \`${code}\` has been revoked and can no longer be redeemed.`);
    }
}

module.exports = RevokePremiumCode;
