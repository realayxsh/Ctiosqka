const fs = require('node:fs');
const path = require('node:path');
const { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType, ChannelType } = require('discord.js');
const { PRESETS } = require('../audio/filters');
const { isVotingEnabled } = require('../structures/voting');

// Read identifiers without executing command modules (some import the command loader).
function commandInventory() {
    const root = path.join(__dirname, '../commands');
    return fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory()).flatMap(folder =>
        fs.readdirSync(path.join(root, folder.name)).filter(file => file.endsWith('.js')).map(file => {
            const source = fs.readFileSync(path.join(root, folder.name, file), 'utf8');
            const name = source.match(/get name\(\)\s*\{\s*return\s*['"`]([^'"`]+)['"`]/)?.[1];
            if (!name) throw new Error(`Missing command identifier: ${folder.name}/${file}`);
            const aliases = source.match(/get aliases\(\)\s*\{\s*return\s*(\[[^\]]*\]|['"`][^'"`]*['"`])/)?.[1] || '';
            return { name, folder: folder.name, ownerOnly: folder.name === 'owner',
                aliases: Array.from(aliases.matchAll(/['"`]([^'"`]+)['"`]/g), match => match[1]) };
        }));
}

const inventory = commandInventory();
const OWNER_COMMAND_NAMES = new Set(inventory.filter(command => command.ownerOnly).flatMap(command => [command.name, ...command.aliases]));
const descriptions = {
    play: 'Play a song or playlist', skip: 'Skip the current track', stop: 'Stop playback and clear the queue',
    pause: 'Pause playback', resume: 'Resume playback', queue: 'Show the music queue',
    loop: 'Check or change the loop mode', shuffle: 'Shuffle the queue', clearqueue: 'Clear queued tracks',
    volume: 'Check or change playback volume', seek: 'Seek to a position in the current track',
    remove: 'Remove a queued track', previous: 'Play the previous track', connect: 'Join your voice channel',
    disconnect: 'Leave voice and clear the queue', restart: 'Restart the current track',
    lyrics: 'Find lyrics for a song or the current track', nowplaying: 'Show the current track and filter controls',
    help: 'Show slash commands and help', ping: 'Check bot latency', invite: 'Get the bot invite link',
    vote: 'Vote for the bot', sources: 'Show supported music sources', support: 'Get the support server link',
    uptime: 'Show bot uptime', profile: 'View a user profile and badges',
    setprefix: 'Check or change the server text-command prefix', '247': 'Toggle staying in voice around the clock',
    autoplay: 'Toggle automatic song recommendations', disablechannel: 'Enable or disable commands in a channel',
    customize: 'Customize the bot appearance for this server', premium: 'Check server premium status',
    redeem: 'Redeem a server premium code',
};

const argumentsByCommand = {
    play: ['query'], loop: ['type'], volume: ['level'], seek: ['position'], remove: ['position'],
    lyrics: ['query'], profile: ['user'], setprefix: ['prefix'], disablechannel: ['channel'], redeem: ['code'],
};

function createDefinitions(client) {
    const commands = inventory.filter(command => !command.ownerOnly && command.folder !== 'filters' &&
        (command.name !== 'vote' || isVotingEnabled(client))).map(({ name }) => {
        if (!descriptions[name]) throw new Error(`Add a slash schema for public command: ${name}`);
        const builder = new SlashCommandBuilder().setName(name).setDescription(descriptions[name])
            .setContexts(InteractionContextType.Guild).setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
        switch (name) {
            case 'play':
                builder.addStringOption(option => option.setName('query').setDescription('Song name or supported song/playlist URL').setRequired(true));
                break;
            case 'loop':
                builder.addStringOption(option => option.setName('type').setDescription('Loop mode; omit to check it').addChoices(
                    { name: 'Track', value: 'track' }, { name: 'Queue', value: 'queue' }, { name: 'Off', value: 'off' }));
                break;
            case 'volume':
                builder.addIntegerOption(option => option.setName('level').setDescription('Volume from 0 (mute) to 200; omit to check').setMinValue(0).setMaxValue(200));
                break;
            case 'seek':
                builder.addIntegerOption(option => option.setName('position').setDescription('Position in seconds').setMinValue(0).setRequired(true));
                break;
            case 'remove':
                builder.addIntegerOption(option => option.setName('position').setDescription('Queue position, starting at 2 for the next track').setMinValue(2).setRequired(true));
                break;
            case 'lyrics':
                builder.addStringOption(option => option.setName('query').setDescription('Song name; omit for the currently playing track'));
                break;
            case 'profile':
                builder.addUserOption(option => option.setName('user').setDescription('Whose profile to display; omit for yourself'));
                break;
            case 'setprefix':
                builder.addStringOption(option => option.setName('prefix').setDescription('New text prefix; omit to view the current prefix').setMinLength(1).setMaxLength(3));
                break;
            case 'disablechannel':
                builder.addChannelOption(option => option.setName('channel').setDescription('Channel to toggle; omit for this channel')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.GuildVoice));
                break;
            case 'customize':
                builder.addSubcommand(sub => sub.setName('view').setDescription('View server customization'))
                    .addSubcommand(sub => sub.setName('icon').setDescription('Set the bot icon for this server')
                        .addStringOption(option => option.setName('url').setDescription('Direct image URL').setRequired(true)))
                    .addSubcommand(sub => sub.setName('banner').setDescription('Set the bot banner for this server')
                        .addStringOption(option => option.setName('url').setDescription('Direct image URL').setRequired(true)))
                    .addSubcommand(sub => sub.setName('reset').setDescription('Remove server customization')
                        .addStringOption(option => option.setName('target').setDescription('What to reset; omit for everything').addChoices(
                            { name: 'Everything', value: 'all' }, { name: 'Icon', value: 'icon' }, { name: 'Banner', value: 'banner' })));
                break;
            case 'redeem':
                builder.addStringOption(option => option.setName('code').setDescription('Premium activation code').setRequired(true));
                break;
        }
        return builder.toJSON();
    });
    commands.push(new SlashCommandBuilder().setName('filter').setDescription('Choose an audio filter from a list')
        .setContexts(InteractionContextType.Guild).setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
        .addStringOption(option => option.setName('effect').setDescription('Choose a filter, or omit to open the filter menu')
            .addChoices(...Object.entries(PRESETS).map(([value, preset]) => ({ name: preset.label, value })),
                { name: 'Clear Filters', value: 'clearfilters' })).toJSON());
    return commands;
}

function slashArguments(interaction, commandName) {
    const options = interaction.options;
    if (commandName === 'customize') {
        const sub = options.getSubcommand();
        const value = sub === 'reset' ? options.getString('target') || 'all' :
            ['icon', 'banner'].includes(sub) ? options.getString('url') : null;
        return [sub, ...(value === null ? [] : [value])];
    }
    return (argumentsByCommand[commandName] || []).flatMap(name => {
        const value = options.get(name)?.value;
        // Do not discard volume=0 or seek=0.
        return value === null || value === undefined ? [] : [String(value)];
    });
}

module.exports = { inventory, OWNER_COMMAND_NAMES, createDefinitions, slashArguments };
