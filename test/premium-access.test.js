const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const { Player } = require('shoukaku');
const { isPremium } = require('../src/structures/premiumAccess');
const CommandHandler = require('../src/structures/CommandHandler');
const { executeSlash } = require('../src/slash/execute');
const Interactions = require('../src/events/client/AvonInteractions');
const { FILTER_OPTIONS, cleanFilters } = require('../src/audio/filters');
const { continueAutoplay } = require('../src/audio/autoplay');
const PlayerDestroy = require('../src/events/poru/PlayerDestroy');
const emoji = require('../emoji.json');

const commands = [
    ...fs.readdirSync(path.join(__dirname, '../src/commands/filters')).filter(f => f.endsWith('.js'))
        .map(file => require(`../src/commands/filters/${file}`)),
    require('../src/commands/settings/Customize'),
    require('../src/commands/settings/Autoplay'),
    require('../src/commands/settings/247'),
];

function fixture(premium = false, owner = false) {
    let entitlement = premium ? { active: true, expiresAt: null } : null;
    const calls = [], updates = [];
    const channel = { id: 'text', send: async payload => { calls.push(payload); } };
    const member = { voice: { channelId: 'voice', channel: { id: 'voice' } },
        permissions: { has: () => true } };
    const me = { voice: { channelId: 'voice', channel: { id: 'voice' } },
        permissionsIn: () => ({ has: () => true }), permissions: { has: () => true } };
    const guild = { id: 'premium-access-test', members: { me },
        channels: { cache: new Collection([['text', channel], ['voice', { id: 'voice' }]]) } };
    const node = { info: { filters: Object.keys(cleanFilters()) },
        rest: { getLavalinkInfo: async () => ({ filters: Object.keys(cleanFilters()) }),
            updatePlayer: async request => updates.push(request) } };
    const player = { guildId: guild.id, textId: 'text', data: new Map(), volume: 100,
        shoukaku: new Player(guild.id, node), node, state: 1,
        queue: { current: { title: 'Song' }, previous: [], size: 0 } };
    const client = { on: () => {}, config: { owners: owner ? ['caller'] : [], coowners: [], prefix: '+' },
        user: { id: 'bot', username: 'Radio' }, emoji, poru: { players: new Map([[guild.id, player]]) },
        data: { get: async () => undefined }, data2: { get: async () => [] },
        data3: { get: async () => entitlement },
        guilds: { cache: new Collection([[guild.id, guild]]) } };
    const handler = new CommandHandler(client);
    client.AvonCommands = handler;
    const interaction = { id: 'request', commandName: '', channelId: 'text', channel, guild, member,
        user: { id: 'caller', displayAvatarURL: () => 'https://example.com/avatar.png' },
        options: { get: () => null, getString: () => null, getSubcommand: () => 'view' },
        deferReply: async () => {}, editReply: async payload => calls.push(payload),
        reply: async payload => calls.push(payload),
        isButton: () => false, isStringSelectMenu: () => true, isChatInputCommand: () => false };
    const message = { content: '', guild, member, channel, author: interaction.user,
        attachments: new Collection(), stickers: new Collection() };
    return { client, player, handler, interaction, message, calls, updates,
        set entitlement(value) { entitlement = value; } };
}
const text = calls => JSON.stringify(calls.map(p => p.components?.map(c => c.toJSON())));

test('server premium checks reject missing, expired, revoked, and malformed entitlements immediately', async () => {
    const f = fixture();
    for (const value of [null, { active: false, expiresAt: null }, { active: true, expiresAt: Date.now() - 1 },
        { active: true }, { expiresAt: 'invalid' }]) {
        f.entitlement = value;
        assert.equal(await isPremium(f.client, f.player.guildId), false);
    }
    for (const value of [{ active: true, expiresAt: null }, { active: true, expiresAt: Date.now() + 10000 }]) {
        f.entitlement = value;
        assert.equal(await isPremium(f.client, f.player.guildId), true);
    }
    f.entitlement = null;
    assert.equal(await isPremium(f.client, f.player.guildId), false);
});

test('every filter, customization, autoplay, and 247 declares premium access', () => {
    for (const Command of commands) assert.equal(new Command({}).premium, true, Command.name);
});

test('prefix commands deny free servers including owners and allow premium without voting', async () => {
    for (const owner of [false, true]) {
        const f = fixture(false, owner);
        for (const Command of commands) {
            const command = new Command(f.client);
            let ran = false;
            command.run = async () => { ran = true; };
            f.handler.commands.set(command.name, command);
            f.message.content = `+${command.name}`;
            f.calls.length = 0;
            await f.handler.run(f.message);
            assert.equal(ran, false, `${command.name} allowed on a free server`);
            assert.match(text(f.calls), /Premium Required/);
            f.entitlement = { active: true, expiresAt: null };
            await f.handler.run(f.message);
            assert.equal(ran, true, `${command.name} blocked on a premium server`);
            f.entitlement = null;
        }
    }
});

test('slash premium commands cannot be unlocked by owners or votes', async () => {
    for (const owner of [false, true]) {
        const f = fixture(false, owner);
        const access = { isPremium, hasVoted: async () => assert.fail('Premium features must not require votes') };
        for (const name of ['customize', 'autoplay', '247']) {
            const Command = commands.find(C => new C({}).name === name);
            const command = new Command(f.client);
            let ran = false;
            command.run = async () => { ran = true; };
            f.handler.commands.set(name, command);
            f.interaction.commandName = name;
            await executeSlash(f.client, f.interaction, access);
            assert.equal(ran, false);
            assert.match(text(f.calls), /requires Premium/);
            f.entitlement = { active: true, expiresAt: null };
            await executeSlash(f.client, f.interaction, access);
            assert.equal(ran, true);
            f.entitlement = null;
        }
    }
});

test('slash filters and both dropdowns enforce premium for all effects and clearing filters', async () => {
    for (const owner of [false, true]) {
        const f = fixture(false, owner);
        const access = { isPremium, hasVoted: async () => assert.fail('No vote-only filters') };
        f.interaction.commandName = 'filter';
        await executeSlash(f.client, f.interaction, access);
        assert.match(text(f.calls), /requires Premium/);
        for (const { value } of FILTER_OPTIONS) {
            f.interaction.options.getString = () => value;
            await executeSlash(f.client, f.interaction, access);
            assert.match(text(f.calls.slice(-1)), /requires Premium/);
            for (const customId of ['filter_select', 'np_filter']) {
                f.interaction.customId = customId;
                f.interaction.values = [value];
                await new Interactions(f.client).run(f.interaction);
                assert.match(text(f.calls.slice(-1)), /Premium Required/);
            }
        }
        assert.equal(f.updates.length, 0);
        f.entitlement = { active: true, expiresAt: null };
        for (const { value } of FILTER_OPTIONS) {
            f.interaction.options.getString = () => value;
            await executeSlash(f.client, f.interaction, access);
            assert.doesNotMatch(text(f.calls.slice(-1)), /Premium Required|requires Premium|Vote required/);
        }
        assert.equal(f.updates.length, FILTER_OPTIONS.length);
    }
});

test('premium status and redemption remain available to non-premium servers', async () => {
    const f = fixture();
    for (const file of ['PremiumStatus', 'Redeem']) {
        const command = new (require(`../src/commands/settings/${file}`))(f.client);
        assert.ok(!command.premium);
        let ran = false;
        command.run = async () => { ran = true; };
        f.handler.commands.set(command.name, command);
        f.interaction.commandName = command.name;
        await executeSlash(f.client, f.interaction, { isPremium, hasVoted: async () => true });
        assert.equal(ran, true);
    }
});

test('saved autoplay and 247 recreation cannot bypass expired server premium', async () => {
    const f = fixture();
    f.player.queue.current = null;
    f.player.queue.previous = [{ title: 'Last song', author: 'Artist' }];
    f.player.search = async () => assert.fail('Free autoplay must not search');
    assert.equal(await continueAutoplay(f.client, f.player), false);
    f.client.data.get = async () => 'enabled';
    f.client.poru.createPlayer = async () => assert.fail('Free 247 must not recreate');
    await new PlayerDestroy(f.client).run(f.player);
});
