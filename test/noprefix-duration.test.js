const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    entryUserId, isEntryActive, activeEntries, entryExpiryText,
    makeNoPrefixEntry, getStoredNoPrefixEntries,
} = require('../src/structures/noprefixAccess');
const Noprefix = require('../src/commands/owner/Noprefix');
const NpList = require('../src/commands/owner/NpList');

function fixture() {
    const store = new Map();
    const sent = [];
    const client = {
        config: { owners: ['owner'], coowners: [] },
        user: { id: 'bot' },
        emoji: { cross: 'ERROR', warning: 'WARN', tick: 'OK', users: 'USERS' },
        users: { fetch: async id => ({ id, username: 'Example', displayAvatarURL: () => 'https://example.com/user.png' }) },
        guilds: { fetch: async id => ({ id, name: 'Server', iconURL: () => null }) },
        data2: {
            get: async key => store.get(key),
            set: async (key, value) => store.set(key, value),
        },
    };
    const message = {
        author: { id: 'owner', displayAvatarURL: () => 'https://example.com/owner.png' },
        mentions: { users: { first: () => null } },
        channel: { send: async payload => { sent.push(payload); return payload; } },
    };
    return { client, message, store, sent };
}

function payloadText(payload) {
    return JSON.stringify(payload.components.map(component => component.toJSON()));
}

test('duration parsing supports day, month, year, and lifetime no-prefix grants', () => {
    const now = Date.now();
    for (const [duration, expected] of [['1d', 1], ['1m', 30], ['2m', 60], ['3m', 90], ['1y', 365]]) {
        const entry = makeNoPrefixEntry('user', duration);
        assert.equal(entry.id, 'user');
        assert.ok(entry.expiresAt - now >= expected * 86_400_000);
        assert.ok(entry.expiresAt - now <= expected * 86_400_000 + 1000);
    }
    const lifetime = makeNoPrefixEntry('user', 'lifetime');
    assert.equal(lifetime.expiresAt, null);
    assert.equal(makeNoPrefixEntry('user', '25m'), null);
});

test('existing string entries stay lifetime and expired records are pruned', async () => {
    const client = { data2: {
        get: async () => ['legacy-user', { id: 'expired-user', expiresAt: Date.now() - 1 }],
        set: async (_, value) => { client.saved = value; },
    } };
    assert.equal(isEntryActive('legacy-user'), true);
    assert.equal(entryUserId('legacy-user'), 'legacy-user');
    assert.deepEqual(activeEntries(['legacy-user', { id: 'expired-user', expiresAt: Date.now() - 1 }]).map(entryUserId), ['legacy-user']);
    assert.equal(entryExpiryText('legacy-user'), 'Lifetime');
    assert.deepEqual((await getStoredNoPrefixEntries(client, 'key')).map(entryUserId), ['legacy-user']);
    assert.deepEqual(client.saved, ['legacy-user']);
});

test('noprefix add stores duration and show lists its expiry', async () => {
    const f = fixture();
    const command = new Noprefix(f.client);
    await command.run(f.client, f.message, ['add', '123', 'all', '2m'], '+');
    const entries = f.store.get('noprefix_bot');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, '123');
    assert.ok(entries[0].expiresAt > Date.now());

    await command.run(f.client, f.message, ['show', 'all'], '+');
    assert.match(payloadText(f.sent.at(-1)), /123/);
    assert.match(payloadText(f.sent.at(-1)), /<t:\d+:R>/);
});

test('noprefix remove handles timed entries and nplist shows remaining expirations', async () => {
    const f = fixture();
    const entry = makeNoPrefixEntry('123', '1d');
    await f.client.data2.set('noprefix_bot', [entry]);
    await new Noprefix(f.client).run(f.client, f.message, ['remove', '123', 'all'], '+');
    assert.deepEqual(f.store.get('noprefix_bot'), []);

    await f.client.data2.set('noprefix_bot', [makeNoPrefixEntry('456', '1y')]);
    await new NpList(f.client).run(f.client, f.message, [], '+');
    assert.match(payloadText(f.sent.at(-1)), /456/);
    assert.match(payloadText(f.sent.at(-1)), /<t:\d+:R>/);
});
