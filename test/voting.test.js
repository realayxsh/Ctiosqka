const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const { Api } = require('@top-gg/sdk');
const { isVotingEnabled } = require('../src/structures/voting');
const { createDefinitions } = require('../src/slash/catalog');
const CommandHandler = require('../src/structures/CommandHandler');
const { executeSlash } = require('../src/slash/execute');
const Help = require('../src/commands/info/help');
const Vote = require('../src/commands/info/vote');
const Profile = require('../src/commands/info/profile');
const PlayerEmpty = require('../src/events/poru/PlayerEmpty');
const Interactions = require('../src/events/client/AvonInteractions');
const emoji = require('../emoji.json');

function fixture(enabled = false) {
    const sent = [], events = {};
    const user = { id: 'caller', username: 'Listener', displayAvatarURL: () => 'https://example.com/avatar.png' };
    const channel = { id: 'text', send: async payload => {
        sent.push(payload);
        return { createMessageComponentCollector: () => ({ on: (event, callback) => { events[event] = callback; } }) };
    } };
    const guild = { id: 'voting-test', name: 'Test server',
        members: { me: { permissionsIn: () => ({ has: () => true }), voice: {} } }, iconURL: () => null };
    const client = { on: () => {}, emoji,
        config: { voting: { enabled }, owners: [], coowners: [], prefix: '+', server: 'https://discord.gg/example' },
        user: { ...user, id: 'bot', username: 'Radio' }, users: { cache: new Collection() },
        data: { get: async () => 'disabled', set: async () => {} },
        data2: { get: async () => [] }, poru: { players: new Map() },
        channels: { cache: new Map([['text', channel]]) },
        guilds: { cache: new Map([[guild.id, guild]]), fetch: async () => { throw new Error('Not found'); } } };
    // Prefix lookups should use the real default rather than our feature states.
    client.data.get = async key => key.endsWith('-247') || key.endsWith('-autoPlay') ? 'disabled' : undefined;
    const handler = new CommandHandler(client);
    client.AvonCommands = handler;
    handler.commands.set('vote', new Vote(client));
    const message = { content: '+vote', author: user, guild, channel, member: { voice: {} },
        attachments: new Collection(), stickers: new Collection(), mentions: { users: new Collection() } };
    const interaction = { commandName: 'vote', guild, channel, channelId: 'text', user,
        member: { voice: {}, permissions: { has: () => true } }, options: { get: () => null },
        deferReply: async () => {}, editReply: async payload => sent.push(payload),
        reply: async payload => sent.push(payload), isButton: () => true,
        isStringSelectMenu: () => false, isChatInputCommand: () => false };
    return { client, handler, message, interaction, sent, events };
}
const text = sent => JSON.stringify(sent, (key, value) => value?.toJSON ? value.toJSON() : value);

test('one reversible switch hides and restores the vote slash registration', () => {
    assert.equal(isVotingEnabled(), false);
    assert(!createDefinitions().some(c => c.name === 'vote'));
    assert(createDefinitions(fixture(true).client).some(c => c.name === 'vote'));
});

test('disabled voting is hidden from Help home, Information, All Commands, and bot mentions', async () => {
    for (const enabled of [false, true]) {
        const f = fixture(enabled);
        f.handler.commands.set('help', new Help(f.client));
        await new Help(f.client).run(f.client, f.message, [], '+');
        assert.equal(/top\.gg/.test(text(f.sent)), enabled);
        for (const customId of ['m4', 'm5']) {
            let payload;
            await f.events.collect({ isButton: () => true, customId, update: async data => { payload = data; } });
            assert.equal(text(payload).includes('`vote`'), enabled);
        }
        f.sent.length = 0;
        f.message.content = '<@bot>';
        await f.handler.run(f.message);
        assert.equal(/top\.gg/.test(text(f.sent)), enabled);
    }
});

test('disabled vote command and alias cannot be invoked by prefix, slash, or direct execution', async () => {
    const f = fixture();
    for (const name of ['vote', 'vot']) {
        f.message.content = `+${name}`;
        await f.handler.run(f.message);
        assert.match(text(f.sent.slice(-1)), /temporarily disabled/);
    }
    await executeSlash(f.client, f.interaction, { hasVoted: async () => assert.fail('No API checks') });
    assert.match(text(f.sent.slice(-1)), /temporarily disabled/);
    await new Vote(f.client).run(f.client, f.message);
    assert.doesNotMatch(text(f.sent), /top\.gg/);
});

test('vote-gated commands run without voting while premium checks remain independent', async t => {
    t.mock.method(Api.prototype, 'hasVoted', async () => assert.fail('Voting API must stay disabled'));
    const f = fixture();
    let runs = 0;
    f.handler.commands.set('sources', { name: 'sources', vote: true, run: async () => { runs++; } });
    f.message.content = '+sources';
    await f.handler.run(f.message);
    f.interaction.commandName = 'sources';
    await executeSlash(f.client, f.interaction, {
        hasVoted: async () => assert.fail('Vote gate should be skipped'), isPremium: async () => false,
    });
    assert.equal(runs, 2);
    f.handler.commands.set('autoplay', { name: 'autoplay', vote: true, premium: true,
        run: async () => assert.fail('Premium cannot be bypassed by disabling voting') });
    f.client.data3 = { get: async () => null };
    f.message.content = '+autoplay';
    await f.handler.run(f.message);
    assert.match(text(f.sent.slice(-1)), /Premium Required/);
});

test('profile hides voter badges and makes no voting API request when disabled', async t => {
    t.mock.method(Api.prototype, 'hasVoted', async () => assert.fail('Profile must not query votes'));
    const f = fixture();
    await new Profile(f.client).run(f.client, f.message, [], '+');
    assert.match(text(f.sent), /Profile for/);
    assert.doesNotMatch(text(f.sent), /Voter|top\.gg/);
});

test('queue-end vote button is hidden while disabled and restored when enabled', async t => {
    t.mock.method(global, 'setTimeout', callback => { queueMicrotask(callback); return 0; });
    for (const enabled of [false, true]) {
        const f = fixture(enabled);
        const player = { guildId: f.message.guild.id, textId: 'text' };
        await new PlayerEmpty(f.client).run(player);
        assert.match(text(f.sent), /Queue Concluded/);
        assert.equal(/top\.gg/.test(text(f.sent)), enabled);
    }
});

test('lyrics button no longer requires votes when voting is disabled', async t => {
    t.mock.method(Api.prototype, 'hasVoted', async () => assert.fail('Lyrics must not query votes'));
    t.mock.method(global, 'fetch', async () => ({ ok: true, json: async () => [] }));
    const f = fixture();
    f.client.poru.players.set(f.message.guild.id, { queue: { current: { title: 'Song', author: 'Artist' } } });
    f.interaction.customId = 'pl_lyrics';
    await new Interactions(f.client).run(f.interaction);
    assert.doesNotMatch(text(f.sent), /Vote Required|top\.gg/);
    assert.ok(f.sent.length);
});

test('vote command is retained and works again when the switch is enabled', async () => {
    const f = fixture(true);
    await f.handler.run(f.message);
    assert.match(text(f.sent), /top\.gg/);
});
