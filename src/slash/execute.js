const { ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, MessageFlags, Collection, PermissionsBitField } = require('discord.js');
const { PRESETS, FILTER_OPTIONS, applyFilter, filterMessage, filterFailure } = require('../audio/filters');
const { OWNER_COMMAND_NAMES, createDefinitions, slashArguments } = require('./catalog');
const wh = require('../structures/webhook');
const { isVotingEnabled } = require('../structures/voting');

const publicNames = new Set([...createDefinitions().map(command => command.name), 'vote']);
const response = text => ({
    flags: [MessageFlags.IsComponentsV2],
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))],
});

function makeMessage(client, interaction, args, commandName, member) {
    let responded = false;
    const send = async data => {
        const payload = typeof data === 'string' ? { content: data } : data;
        const message = await (responded ? interaction.followUp(payload) : interaction.editReply(payload));
        responded = true;
        return message;
    };
    const selectedUser = interaction.options.getUser?.('user') || null;
    const selectedMember = interaction.options.getMember?.('user') || null;
    const selectedChannel = interaction.options.getChannel?.('channel') || null;
    const channel = new Proxy(interaction.channel || { id: interaction.channelId }, {
        get(target, property) {
            if (property === 'send') return send;
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
    return {
        id: interaction.id, client, guild: interaction.guild, author: interaction.user, member,
        content: `${commandName} ${args.join(' ')}`, channel, reply: send,
        createdTimestamp: interaction.createdTimestamp || Date.now(), createdAt: interaction.createdAt || new Date(),
        attachments: new Collection(), stickers: new Collection(),
        mentions: {
            users: new Collection(selectedUser ? [[selectedUser.id, selectedUser]] : []),
            members: new Collection(selectedMember ? [[selectedMember.id, selectedMember]] : []),
            channels: new Collection(selectedChannel ? [[selectedChannel.id, selectedChannel]] : []),
        },
    };
}

async function executeSlash(client, interaction, access) {
    const originalName = interaction.commandName;
    const name = originalName === 'filters' ? 'filter' : originalName;
    if (name === 'vote' && !isVotingEnabled(client)) {
        return interaction.reply({ content: 'Voting is temporarily disabled.', flags: [MessageFlags.Ephemeral] });
    }
    // An old Discord registration must never make an owner handler reachable.
    if (OWNER_COMMAND_NAMES.has(originalName) || !publicNames.has(name)) {
        return interaction.reply({ content: 'This command is not available as a slash command.', flags: [MessageFlags.Ephemeral] });
    }
    await interaction.deferReply({ flags: name === 'redeem' ? [MessageFlags.Ephemeral] : [] });
    try {
        if (!interaction.guild) return interaction.editReply(response('Use public slash commands in a server.'));
        wh.command(name, { userId: interaction.user.id, guildId: interaction.guild.id,
            channelId: interaction.channelId, source: 'slash' });
        const isOwner = client.config.owners.includes(interaction.user.id);
        let member = interaction.member;
        if (!member?.voice || typeof member.permissions?.has !== 'function') {
            member = await interaction.guild.members.fetch(interaction.user.id);
        }
        const disabled = await client.data.get(`disabled_channel_${interaction.guild.id}_${interaction.channelId}`);
        const canEnable = name === 'disablechannel' && member.permissions.has(PermissionsBitField.Flags.ManageChannels);
        if (disabled === 'disabled' && !isOwner && !canEnable) {
            return interaction.editReply(response(`${client.emoji.cross} | Commands are disabled in this channel.`));
        }
        const player = client.poru.players.get(interaction.guild.id);
        if (name === 'filter') {
            if (!await access.isPremium(client, interaction.guild.id)) {
                return interaction.editReply(response(`${client.emoji.premium} | This filter requires Premium for this server. Use /redeem to activate it.`));
            }
            const chosen = originalName === 'filters' ? interaction.options.getString('filter') : interaction.options.getString('effect');
            if (!chosen) {
                const menu = new StringSelectMenuBuilder().setCustomId('filter_select').setPlaceholder('Choose an audio filter')
                    .addOptions(...FILTER_OPTIONS.map(({ label, value, desc, key }) => {
                        const option = new StringSelectMenuOptionBuilder().setLabel(label).setValue(value).setDescription(desc);
                        if (client.emoji[key]) option.setEmoji(client.emoji[key]);
                        return option;
                    }));
                return interaction.editReply({
                    flags: [MessageFlags.IsComponentsV2],
                    components: [new ContainerBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.filters} | Choose a filter below. Join the bot's voice channel to apply it.`))
                        .addActionRowComponents(new ActionRowBuilder().addComponents(menu))],
                });
            }
            const id = chosen === 'clearfilters' ? 'none' : chosen;
            if (id !== 'none' && !Object.hasOwn(PRESETS, id)) return interaction.editReply(response('Unknown filter.'));
            if (!player?.queue.current) return interaction.editReply(response(`${client.emoji.cross} | Nothing is playing right now.`));
            if (!member.voice.channelId || member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
                return interaction.editReply(response(`${client.emoji.cross} | You must be in the same voice channel as me.`));
            }
            try {
                return interaction.editReply(response(filterMessage(await applyFilter(player, id, { toggle: true }), client.emoji)));
            } catch (error) {
                wh.error('Slash audio filter failed', error);
                return interaction.editReply(response(filterFailure(error, client.emoji)));
            }
        }
        const command = client.AvonCommands.commands.get(name);
        if (!command || command.ownerOnly) return interaction.editReply(response('This command is not available as a slash command.'));
        const args = slashArguments(interaction, name);
        if (command.inVoice && !member.voice.channelId) {
            return interaction.editReply(response(`${client.emoji.cross} | You must be connected to a voice channel.`));
        }
        const botVoice = interaction.guild.members.me.voice;
        if (command.sameVoice && botVoice.channelId && botVoice.channelId !== member.voice.channelId) {
            return interaction.editReply(response(`${client.emoji.cross} | You must be in the same voice channel as me.`));
        }
        if (command.player && !player?.queue.current && !(name === 'lyrics' && args.length)) {
            return interaction.editReply(response(`${client.emoji.cross} | Nothing is playing right now.`));
        }
        const [voted, premium] = await Promise.all([
            isVotingEnabled(client) && command.vote && !command.premium && !isOwner ? access.hasVoted(interaction.user.id, client) : true,
            command.premium ? access.isPremium(client, interaction.guild.id) : true,
        ]);
        if (!voted) return interaction.editReply(response(`${client.emoji.tick} | Vote required: https://top.gg/bot/${client.user.id}/vote`));
        if (!premium) return interaction.editReply(response(`${client.emoji.premium} | This command requires Premium. Use /redeem to activate it.`));
        const prefix = await client.data.get(`${interaction.guild.id}-prefix`) || client.config.prefix;
        const message = makeMessage(client, interaction, args, name, member);
        await command.run(client, message, args, prefix, player);
    } catch (error) {
        wh.error('Slash command failed', error);
        console.warn(`[Slash Commands] ${name} failed (${error?.name || 'Error'})`);
        await interaction.editReply(response(`${client.emoji.cross} | Could not complete this command. Please try again.`)).catch(() => {});
    }
}

module.exports = { executeSlash, makeMessage };
