const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder } = require('discord.js');
const { FILTER_OPTIONS } = require('../audio/filters');

function buildFilterRow(client, player, customId = 'np_filter') {
    const active = player.data.get('activeFilter') || 'none';
    const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder('Choose an audio filter')
        .addOptions(...FILTER_OPTIONS.map(({ label, value, desc, key }) => {
            const option = new StringSelectMenuOptionBuilder().setLabel(label).setValue(value)
                .setDescription(desc).setDefault(value === active);
            if (client.emoji[key]) option.setEmoji(client.emoji[key]);
            return option;
        }));
    return new ActionRowBuilder().addComponents(menu);
}

function buildPlaybackRows(client, player) {
    const loopOn = Boolean(player.loop && player.loop !== 'none');
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel('Stop').setCustomId('pl1'),
            new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel(player.paused ? 'Resume' : 'Pause').setCustomId('pl2'),
            new ButtonBuilder().setStyle(loopOn ? ButtonStyle.Success : ButtonStyle.Primary).setLabel(loopOn ? 'Loop ON' : 'Loop').setCustomId('pl3'),
            new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('Skip').setCustomId('pl5'),
            new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('Lyrics').setCustomId('pl_lyrics'),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('Previous').setCustomId('pl4'),
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Get Premium').setURL(client.config.server),
        ),
        buildFilterRow(client, player, 'filter_select'),
    ];
}

module.exports = { buildFilterRow, buildPlaybackRows };
