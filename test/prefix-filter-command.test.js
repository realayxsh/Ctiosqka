const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const Filter = require('../src/commands/filters/Filter');
const AvonCommands = require('../src/structures/CommandHandler');
const { FILTER_OPTIONS, cleanFilters } = require('../src/audio/filters');

function serialized(payload) {
    return JSON.stringify(payload.components.map(component => component.toJSON()));
}

function makePlayer() {
    const state = new Map();
    const updates = [];
    const player = {
        queue: { current: { title: 'Current track' } },
        paused: false,
        data: {
            get: key => state.get(key),
            set: (key, value) => state.set(key, value),
        },
        shoukaku: {
            node: { info: { filters: Object.keys(cleanFilters()) } },
            update: async payload => updates.push(payload),
        },
    };
    return { player, state, updates };
}

function makeNoPrefixHarness(content) {
    const sent = [];
    const { player } = makePlayer();
    const client = {
        config: { owners: [], coowners: [], prefix: '+' },
        user: { id: 'bot-filter-test' },
        emoji: { filters: 'FILTER', cross: 'ERROR', warning: 'WARN', tick: 'OK' },
        data: { get: async key => key.endsWith('-prefix') ? undefined : undefined },
        data2: {
            get: async key => key === 'noprefix_bot-filter-test' ? ['np-filter-user'] : [],
            set: async () => {},
        },
        data3: { get: async () => ({ active: true, expiresAt: null }) },
        guilds: { cache: new Map() },
        poru: { players: new Map([['filter-guild', player]]) },
    };
    const handler = Object.create(AvonCommands.prototype);
    handler.client = client;
    handler.commands = new Collection([['filter', new Filter(client)]]);
    client.AvonCommands = handler;

    const permissions = { has: () => true };
    const voiceChannel = { id: 'voice' };
    const channel = {
        id: 'text',
        send: async payload => { sent.push(payload); return payload; },
    };
    const guild = {
        id: 'filter-guild',
        members: {
            me: {
                voice: { channelId: voiceChannel.id, channel: voiceChannel },
                permissionsIn: () => permissions,
            },
        },
    };
    const message = {
        author: { id: 'np-filter-user', bot: false },
        content,
        guild,
        channel,
        member: {
            voice: { channelId: voiceChannel.id, channel: voiceChannel },
            permissions: { has: () => false },
        },
        attachments: { size: 0 },
        stickers: { size: 0 },
    };
    return { client, handler, message, sent };
}

test('filter prefix command opens the shared picker with every option', async () => {
    const { client, message, sent } = makeNoPrefixHarness('+filter');
    await new Filter(client).run(client, message, [], '+');

    const output = serialized(sent[0]);
    assert.ok(output.includes('filter_select'));
    for (const option of FILTER_OPTIONS) assert.ok(output.includes(`\"value\":\"${option.value}\"`));
});

test('filter accepts an effect name directly', async () => {
    const { client, message, sent } = makeNoPrefixHarness('+filter');
    const { player, updates } = makePlayer();
    const oldMusicLogger = require('../src/structures/webhook').music;
    require('../src/structures/webhook').music = () => {};
    try {
        await new Filter(client).run(client, message, ['bass', 'boost'], '+', player);
    } finally {
        require('../src/structures/webhook').music = oldMusicLogger;
    }

    assert.equal(updates.length, 1);
    assert.match(serialized(sent[0]), /Bass Boost/);
});

test('bare filter works for a no-prefix user through the normal message dispatcher', async () => {
    const harness = makeNoPrefixHarness('filter');
    await harness.handler.run(harness.message);

    assert.equal(harness.sent.length, 1);
    assert.ok(serialized(harness.sent[0]).includes('filter_select'));

    harness.message.content = '+filter';
    await harness.handler.run(harness.message);
    assert.equal(harness.sent.length, 2);
    assert.ok(serialized(harness.sent[1]).includes('filter_select'));
});
