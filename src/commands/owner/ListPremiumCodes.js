const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const AvonCommand = require('../../structures/avonCommand');
const { isOwner } = require('../../structures/ownerMessages');
const { parsePremiumDuration } = require('../../structures/premiumDuration');

function codeValue(entry) {
    return typeof entry === 'string' ? entry : entry?.code;
}

function codeDuration(entry) {
    if (typeof entry === 'string') return '30 Days';
    return parsePremiumDuration(entry?.duration || '30d')?.label || '30 Days';
}

class ListPremiumCodes extends AvonCommand {
    get name() { return 'listpremcodes'; }
    get aliases() { return ['premiumcodes', 'listpremiumcodes', 'premcodes']; }
    get cat() { return 'owner'; }

    async run(client, message) {
        if (!isOwner(client, message.author.id)) return;
        const codes = await client.data3.get('premium_codes') || [];
        const rows = codes.map((entry, index) =>
            `\`${index + 1}.\` \`${codeValue(entry)}\` — **${codeDuration(entry)}**`
        );
        const pages = rows.length ? Array.from({ length: Math.ceil(rows.length / 30) },
            (_, index) => rows.slice(index * 30, (index + 1) * 30)) : [[]];
        for (let index = 0; index < pages.length; index++) {
            const body = pages[index].length ? pages[index].join('\n') : 'No unused Premium codes are available.';
            const heading = `**${client.emoji.premium} | Unused Premium Codes (${codes.length})**`;
            const footer = pages.length > 1 ? `\n\n-# Page ${index + 1}/${pages.length}` : '';
            await message.channel.send({
                flags: [MessageFlags.IsComponentsV2],
                components: [new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${heading}\n\n${body}${footer}`)
                )],
            });
        }
    }
}

module.exports = ListPremiumCodes;
