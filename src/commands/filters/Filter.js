const {
    ActionRowBuilder,
    ContainerBuilder,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextDisplayBuilder,
} = require('discord.js');
const AvonCommand = require('../../structures/avonCommand');
const { FILTER_OPTIONS, PRESETS, applyFilter, filterFailure, filterMessage } = require('../../audio/filters');
const wh = require('../../structures/webhook');

class Filter extends AvonCommand {
    get name() { return 'filter'; }
    get aliases() { return []; }
    get cat() { return 'filters'; }
    get premium() { return true; }

    async run(client, message, args, prefix, player) {
        const send = text => message.channel.send({
            flags: [MessageFlags.IsComponentsV2],
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
        });

        if (args.length) {
            const requested = args.join('').toLowerCase().replace(/[^a-z0-9]/g, '');
            const selection = ['none', 'clear', 'clearfilters', 'off'].includes(requested)
                ? 'none'
                : Object.entries(PRESETS).find(([id, preset]) =>
                    id === requested || preset.label.toLowerCase().replace(/[^a-z0-9]/g, '') === requested
                )?.[0];
            if (selection === undefined) {
                return send(`${client.emoji.cross} | Unknown filter. Run \`${prefix}filter\` to open the selector.`);
            }
            if (!message.member?.voice?.channelId) {
                return send(`${client.emoji.cross} | You must be connected to a voice channel.`);
            }
            if (message.guild.members.me.voice.channelId !== message.member.voice.channelId) {
                return send(`${client.emoji.cross} | You must be in the same voice channel as me.`);
            }
            if (!player?.queue?.current) {
                return send(`${client.emoji.cross} | I am not playing anything.`);
            }
            try {
                return send(filterMessage(await applyFilter(player, selection, { toggle: true }), client.emoji));
            } catch (error) {
                wh.error('Prefix audio filter failed', error);
                console.warn(`[Audio Filters] filter failed (${error?.name || 'Error'})`);
                return send(filterFailure(error, client.emoji));
            }
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId('filter_select')
            .setPlaceholder('Choose an audio filter')
            .addOptions(...FILTER_OPTIONS.map(({ label, value, desc, key }) => {
                const option = new StringSelectMenuOptionBuilder()
                    .setLabel(label)
                    .setValue(value)
                    .setDescription(desc);
                if (client.emoji[key]) option.setEmoji(client.emoji[key]);
                return option;
            }));

        return message.channel.send({
            flags: [MessageFlags.IsComponentsV2],
            components: [new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${client.emoji.filters} | Choose a filter below. Join the bot's voice channel to apply it.`
                ))
                .addActionRowComponents(new ActionRowBuilder().addComponents(menu))],
        });
    }
}

module.exports = Filter;
