const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection, GatewayIntentBits, ApplicationFlagsBitField } = require('discord.js');
const { inventory, OWNER_COMMAND_NAMES, createDefinitions, slashArguments } = require('../src/slash/catalog');
const { executeSlash, makeMessage } = require('../src/slash/execute');
const { registerCommands, sameCommands } = require('../src/slash/register');
const { gatewayIntents } = require('../src/structures/gatewayIntents');
const { runOwnerMessage } = require('../src/structures/ownerMessages');
const { PRESETS, FILTER_OPTIONS } = require('../src/audio/filters');
const emoji = require('../emoji.json');

function store() {
    const map = new Map();
    return { map, get: async key => map.get(key), set: async (key, value) => map.set(key, value), delete: async key => map.delete(key) };
}
function fixture(name, values = {}, { subcommand, owner = true } = {}) {
    const calls = [];
    const channel = { id: 'channel', name: 'music', toString: () => '<#channel>' };
    const member = { voice: { channelId: 'voice', channel: { id: 'voice' } }, permissions: { has: () => true } };
    const client = {
        config: { owners: owner ? ['caller'] : [], coowners: [], prefix: '+', voting: { enabled: true } },
        user: { id: 'bot', displayAvatarURL: () => 'https://example.com/bot.png' },
        emoji, data: store(), data3: store(),
        poru: { players: new Map() }, AvonCommands: { commands: new Collection() },
        guilds: { cache: new Collection(), fetch: async () => { throw new Error('not a member'); } },
    };
    const interaction = {
        id: 'interaction', commandName: name, channelId: channel.id, channel,
        user: { id: 'caller', displayAvatarURL: () => 'https://example.com/user.png' },
        member, guild: { id: 'guild', members: { me: { voice: { channelId: 'voice', channel: {} } }, fetch: async () => member },
            channels: { cache: new Collection([[channel.id, channel]]) } },
        options: {
            get: key => Object.hasOwn(values, key) ? { name: key, value: values[key] } : null,
            getString: key => values[key] ?? null, getSubcommand: () => subcommand,
            getUser: () => null, getMember: () => null, getChannel: () => null,
        },
        async deferReply(options) { calls.push(['defer', options]); this.deferred = true; },
        async editReply(options) { calls.push(['edit', options]); return { editable: true }; },
        async followUp(options) { calls.push(['follow', options]); return { editable: true }; },
        async reply(options) { calls.push(['reply', options]); this.replied = true; },
    };
    const access = { hasVoted: async () => true, isPremium: async () => true };
    return { client, interaction, calls, access };
}
const texts = calls => JSON.stringify(calls.filter(([type]) => type === 'edit').map(([, data]) =>
    data.components?.map(component => component.toJSON())));

test('the slash catalog covers enabled public commands, grouping filters and hiding disabled voting', () => {
    const definitions = createDefinitions();
    const names = new Set(definitions.map(command => command.name));
    assert.equal(names.size, definitions.length);
    for (const command of inventory) {
        if (command.ownerOnly) assert(!names.has(command.name));
        else if (command.name === 'vote') assert(!names.has('vote'));
        else if (command.folder === 'filters') {
            assert(names.has('filter'));
            assert(Object.hasOwn(PRESETS, command.name) || command.name === 'clearfilters');
        } else assert(names.has(command.name), `Missing /${command.name}`);
    }
    const filter = definitions.find(command => command.name === 'filter');
    assert.equal(filter.options[0].required, false);
    assert.deepEqual(new Set(filter.options[0].choices.map(choice => choice.value)),
        new Set([...Object.keys(PRESETS), 'clearfilters']));
    assert(definitions.every(command => JSON.stringify(command.contexts) === '[0]'));
    assert(names.has('lyrics') && names.has('disablechannel'));
    assert(!names.has('genpremium') && !names.has('noprefix'));
});

test('argument mapping preserves zero, optional checks, and customize subcommand order', () => {
    for (const [name, values, expected] of [
        ['volume', { level: 0 }, ['0']], ['seek', { position: 0 }, ['0']],
        ['skip', { position: 3 }, ['3']], ['skip', {}, []],
        ['play', { query: 'a song with spaces' }, ['a song with spaces']],
        ['loop', { type: 'off' }, ['off']], ['loop', {}, []],
        ['profile', { user: '123' }, ['123']], ['setprefix', {}, []],
        ['lyrics', { query: 'artist song' }, ['artist song']],
    ]) {
        assert.deepEqual(slashArguments(fixture(name, values).interaction, name), expected);
    }
    assert.deepEqual(slashArguments(fixture('customize', { url: 'https://example.com/a.png' }, { subcommand: 'icon' }).interaction, 'customize'),
        ['icon', 'https://example.com/a.png']);
    assert.deepEqual(slashArguments(fixture('customize', {}, { subcommand: 'reset' }).interaction, 'customize'), ['reset', 'all']);
    assert.deepEqual(slashArguments(fixture('customize', {}, { subcommand: 'view' }).interaction, 'customize'), ['view']);
});

test('all public handlers dispatch through slash without any message-content event', async () => {
    for (const item of inventory.filter(command => !command.ownerOnly && command.folder !== 'filters')) {
        const { client, interaction, access, calls } = fixture(item.name, {}, { subcommand: 'view' });
        let invoked = false;
        client.AvonCommands.commands.set(item.name, {
            name: item.name, async run(bot, message) { invoked = true; await message.channel.send({ content: 'ok' }); },
        });
        await executeSlash(client, interaction, access);
        assert(invoked, `${item.name} did not dispatch`);
        assert.equal(calls[0][0], 'defer');
        assert.equal(calls[1][0], 'edit');
    }
});

test('owner command names and aliases are blocked even if stale registrations and handlers exist', async () => {
    for (const name of OWNER_COMMAND_NAMES) {
        const { client, interaction, access, calls } = fixture(name);
        client.AvonCommands.commands.set(name, { run() { assert.fail('Owner command reached by slash'); } });
        await executeSlash(client, interaction, access);
        assert.equal(calls[0][0], 'reply');
        assert.equal(interaction.deferred, undefined);
    }
});

test('/filter opens a complete picker without applying audio or requiring a text command', async () => {
    const { client, interaction, access, calls } = fixture('filter');
    await executeSlash(client, interaction, access);
    const payload = calls.find(([type]) => type === 'edit')[1];
    const serialized = JSON.stringify(payload.components.map(component => component.toJSON()));
    assert(serialized.includes('filter_select'));
    for (const option of FILTER_OPTIONS) assert(serialized.includes(`\"value\":\"${option.value}\"`));
    assert.equal(calls[0][0], 'defer');
});

test('resolved users and channels are available through all message adapter collections', async () => {
    const { client, interaction } = fixture('profile');
    const selectedUser = { id: 'selected', displayAvatarURL: () => 'https://example.com/selected.png' };
    const selectedChannel = { id: 'selected-channel' };
    interaction.options.getUser = () => selectedUser;
    interaction.options.getChannel = () => selectedChannel;
    const message = makeMessage(client, interaction, ['selected'], 'profile', interaction.member);
    assert.equal(message.mentions.users.first(), selectedUser);
    assert.equal(message.mentions.channels.first(), selectedChannel);
    assert.equal(message.channel.id, interaction.channelId);
    await message.channel.send({ content: 'first' });
    await message.reply({ content: 'second' });
});

test('voice, paid access, and disabled-channel checks run before public handlers', async () => {
    const { client, interaction, access, calls } = fixture('play', {}, { owner: false });
    let invoked = false;
    client.AvonCommands.commands.set('play', { inVoice: true, premium: true, run() { invoked = true; } });
    interaction.member.voice = {};
    await executeSlash(client, interaction, access);
    assert.match(texts(calls), /voice channel/);
    assert.ok(texts(calls).includes(emoji.warning));
    assert.equal(invoked, false);
    interaction.member.voice = { channelId: 'voice' };
    access.isPremium = async () => false;
    await executeSlash(client, interaction, access);
    assert.match(texts(calls), /requires Premium/);
    assert.ok(texts(calls).includes(`${emoji.warning} | **__Premium Required__**`));
    client.data.map.set('disabled_channel_guild_channel', 'disabled');
    await executeSlash(client, interaction, access);
    assert.match(texts(calls), /disabled in this channel/);
    const latest = calls.filter(([type]) => type === 'edit').at(-1)[1];
    assert.ok(JSON.stringify(latest).includes(`${emoji.warning} | Commands are disabled`));
    assert.equal(invoked, false);
});

test('/disablechannel can enable a disabled channel for an authorized manager', async () => {
    const Disable = require('../src/commands/settings/DisableChannel');
    const { client, interaction, access } = fixture('disablechannel', {}, { owner: false });
    client.AvonCommands.commands.set('disablechannel', new Disable(client));
    await executeSlash(client, interaction, access);
    assert.equal(client.data.map.get('disabled_channel_guild_channel'), 'disabled');
    await executeSlash(client, interaction, access);
    assert.equal(client.data.map.has('disabled_channel_guild_channel'), false);
});

test('premium-code redemption responses are deferred privately', async () => {
    const { client, interaction, access, calls } = fixture('redeem', { code: 'test-code' });
    client.AvonCommands.commands.set('redeem', { run: async () => {} });
    await executeSlash(client, interaction, access);
    assert.deepEqual(calls[0], ['defer', { flags: [64] }]);
});

test('/enablechannel restores commands and never disables an already enabled channel', async () => {
    const Enable = require('../src/commands/settings/EnableChannel');
    const { client, interaction, access, calls } = fixture('enablechannel', {}, { owner: false });
    client.AvonCommands.commands.set('enablechannel', new Enable(client));
    client.data.map.set('disabled_channel_guild_channel', 'disabled');
    await executeSlash(client, interaction, access);
    assert.equal(client.data.map.has('disabled_channel_guild_channel'), false);
    assert.match(texts(calls), /Enabled/);
    await executeSlash(client, interaction, access);
    assert.equal(client.data.map.has('disabled_channel_guild_channel'), false);
    assert.match(texts(calls), /already/);
    const schema = createDefinitions().find(command => command.name === 'enablechannel');
    assert.equal(schema.options[0].name, 'channel');
    assert.equal(schema.options[0].required, false);
    assert.deepEqual(slashArguments(fixture('enablechannel', { channel: 'other' }).interaction, 'enablechannel'), ['other']);
});

test('/enablechannel requires Manage Channels or owner access', async () => {
    const Enable = require('../src/commands/settings/EnableChannel');
    const { client, interaction, access, calls } = fixture('enablechannel', {}, { owner: false });
    client.AvonCommands.commands.set('enablechannel', new Enable(client));
    interaction.member.permissions.has = () => false;
    client.data.map.set('disabled_channel_guild_channel', 'disabled');
    await executeSlash(client, interaction, access);
    assert.equal(client.data.map.get('disabled_channel_guild_channel'), 'disabled');
    client.data.map.clear();
    await executeSlash(client, interaction, access);
    assert.match(texts(calls), /Manage Channels/);
});

test('prefix enable and enablechannel work inside disabled channels for managers', async () => {
    const Handler = require('../src/structures/CommandHandler');
    const Enable = require('../src/commands/settings/EnableChannel');
    const { client, interaction, calls } = fixture('enablechannel', {}, { owner: false });
    client.on = () => {};
    client.data2 = store();
    const handler = new Handler(client);
    handler.commands.set('enablechannel', new Enable(client));
    interaction.guild.members.me.permissionsIn = () => ({ has: () => true });
    const message = makeMessage(client, interaction, [], 'enablechannel', interaction.member);
    for (const name of ['enablechannel', 'enable']) {
        client.data.map.set('disabled_channel_guild_channel', 'disabled');
        message.content = `+${name}`;
        await handler.run(message);
        assert.equal(client.data.map.has('disabled_channel_guild_channel'), false);
    }
    assert.match(texts(calls), /Enabled/);
});

test('registration replaces owner slash entries and cleans shadowing guild commands', async () => {
    const calls = [];
    const rest = {
        async get(route) {
            return route.includes('/guilds/') ?
                [{ id: 'old-owner', name: 'genpremium', type: 1 }, { id: 'old-play', name: 'play', type: 1 }, { id: 'context', name: 'stats', type: 2 }] :
                [{ name: 'genpremium', type: 1, description: 'old' }, { name: 'Inspect User', type: 2 }];
        },
        async put(route, options) { calls.push(['put', route, options]); },
        async delete(route) { calls.push(['delete', route]); },
    };
    const result = await registerCommands(rest, 'application', { guildIds: ['guild'] });
    const body = calls.find(([type]) => type === 'put')[2].body;
    assert(!body.some(command => OWNER_COMMAND_NAMES.has(command.name)));
    assert(body.some(command => command.name === 'Inspect User' && command.type === 2));
    assert.equal(result.removed, 2);
    assert.equal(calls.filter(([type]) => type === 'delete').length, 2);
});

test('unchanged slash definitions do not get re-created on every startup', async () => {
    const definitions = createDefinitions();
    const remote = structuredClone(definitions).map((command, index) => ({ ...command, id: String(index), version: 'server-version' }));
    assert(sameCommands(remote, definitions));
    const result = await registerCommands({
        get: async () => remote, put: async () => assert.fail('Unnecessary registration'),
    }, 'application');
    assert.equal(result.changed, false);
});

test('unapproved applications omit Message Content but keep DM, guild message, and voice events', () => {
    const base = gatewayIntents(0);
    assert.equal(base.has(GatewayIntentBits.MessageContent), false);
    for (const intent of [GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates]) assert(base.has(intent));
    for (const flag of ['GatewayMessageContent', 'GatewayMessageContentLimited']) {
        assert(gatewayIntents(ApplicationFlagsBitField.Flags[flag]).has(GatewayIntentBits.MessageContent));
    }
});

test('owners can use bare DMs and mentions without no-prefix database grants', async () => {
    const { client } = fixture('help');
    const invocations = [];
    client.AvonCommands.commands.set('genpremium', {
        name: 'genpremium', aliases: ['genprem'], ownerOnly: true,
        run: async (bot, message, args, prefix) => invocations.push({ content: message.content, args, prefix, guild: message.guild }),
    });
    for (const content of ['genpremium 30d 2', '<@bot> genpremium 30d 2', 'genprem 30d 2']) {
        assert(await runOwnerMessage(client, { content, author: { id: 'caller' }, guild: null }));
    }
    assert(invocations.every(call => call.prefix === '' && call.args.join(' ') === '30d 2'));
    assert.equal(invocations.at(-1).content, 'genprem 30d 2');
    assert.equal(await runOwnerMessage(client, { content: 'genpremium 30d', author: { id: 'stranger' } }), false);
});

test('the real genpremium command can generate codes in an owner DM without guild context', async () => {
    const GenPremium = require('../src/commands/owner/GenPremium');
    const { client } = fixture('help');
    const command = new GenPremium(client);
    command.ownerOnly = true;
    client.AvonCommands.commands.set('genpremium', command);
    const responses = [];
    const message = { content: 'genpremium 30d 2', guild: null,
        author: { id: 'caller', displayAvatarURL: () => 'https://example.com/user.png' },
        channel: { send: async response => responses.push(response) } };
    assert(await runOwnerMessage(client, message));
    assert.equal((await client.data3.get('premium_codes')).length, 2);
    assert.equal(responses.length, 1);
});

test('server-dependent owner DMs require explicit context rather than guessing a server', async () => {
    const { client } = fixture('help');
    let invoked = false;
    client.AvonCommands.commands.set('say', { name: 'say', ownerOnly: true, run: async () => { invoked = true; } });
    const replies = [];
    const message = { content: 'say 123 text', author: { id: 'caller' }, guild: null, reply: async data => replies.push(data) };
    assert(await runOwnerMessage(client, message));
    assert.equal(invoked, false);
    assert.match(replies[0].content, /--server/);
    const id = '123456789012345678';
    client.guilds.cache.set(id, { id });
    message.content += ` --server ${id}`;
    assert(await runOwnerMessage(client, message));
    assert.equal(invoked, true);
});
