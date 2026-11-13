const AvonCommand = require('./avonCommand');
const wh = require('./webhook');
const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { applyFilter, filterMessage, filterFailure } = require('../audio/filters');

class FilterCommand extends AvonCommand {
    get premium() { return true; }

    async run(client, message, args, prefix, player) {
        const send = text => message.channel.send({
            flags: [MessageFlags.IsComponentsV2],
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
        });
        let result;
        try {
            result = await applyFilter(player, this.name, { toggle: this.name !== 'clearfilters' });
        } catch (error) {
            wh.error('Prefix audio filter failed', error);
            console.warn(`[Audio Filters] ${this.name} failed (${error?.name || 'Error'})`);
            return send(filterFailure(error, client.emoji));
        }
        return send(filterMessage(result, client.emoji));
    }
}
module.exports = FilterCommand;
