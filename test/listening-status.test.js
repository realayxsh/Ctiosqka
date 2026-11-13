const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ActivityType } = require('discord.js');
const SetListening = require('../src/commands/owner/SetListening');
const { restoreListeningStatus } = require('../src/structures/listeningStatus');

function fixture(owner = true) {
    const store = new Map(), updates = [], replies = [];
    const client = {
        config: { owners: ['owner'], coowners: [] },
        emoji: { tick: 'OK', cross: 'ERROR', info: 'INFO' },
        data: { get: async key => store.get(key), set: async (key, value) => store.set(key, value) },
        user: { setPresence: value => updates.push(value) },
    };
    const message = { author: { id: owner ? 'owner' : 'visitor' }, reply: async value => replies.push(value) };
    return { client, message, updates, replies, store };
}

test('default presence contains only help commands and does not promote Premium', async () => {
    const f = fixture();
    await restoreListeningStatus(f.client);
    assert.deepEqual(f.updates, [{ activities: [{ name: '+help | /help', type: ActivityType.Listening }], status: 'idle' }]);
});

test('owner can change listening text, restore it after restart, and reset', async () => {
    const f = fixture(), command = new SetListening(f.client);
    await command.run(f.client, f.message, ['your', 'music']);
    assert.equal(f.updates.at(-1).activities[0].name, 'your music');
    await restoreListeningStatus(f.client);
    assert.equal(f.updates.at(-1).activities[0].name, 'your music');
    await command.run(f.client, f.message, ['reset']);
    assert.equal(f.updates.at(-1).activities[0].name, '+help | /help');
});

test('non-owners cannot change or persist presence', async () => {
    const f = fixture(false);
    await new SetListening(f.client).run(f.client, f.message, ['bad']);
    assert.equal(f.store.size, 0);
    assert.equal(f.updates.length, 0);
});

test('empty or oversized input does not change presence', async () => {
    const f = fixture(), command = new SetListening(f.client);
    await command.run(f.client, f.message, []);
    await command.run(f.client, f.message, ['x'.repeat(129)]);
    assert.equal(f.replies.length, 2);
    assert.equal(f.store.size, 0);
});

test('owner changes are broadcast to all clusters', async () => {
    const f = fixture(), second = [];
    f.client.cluster = { broadcastEval: async (fn, { context }) => {
        fn(f.client, context);
        fn({ user: { setPresence: value => second.push(value) } }, context);
    } };
    await new SetListening(f.client).run(f.client, f.message, ['custom']);
    assert.equal(f.updates[0].activities[0].name, 'custom');
    assert.equal(second[0].activities[0].name, 'custom');
});
