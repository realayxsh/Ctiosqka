const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reconcileNoPrefixScope, syncNoPrefixExpirations } = require('../src/structures/noprefixExpiry');
const { syncPremiumBranding, notifyPremiumExpiry } = require('../src/structures/premiumBranding');

function createDb(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        values,
        get: async key => structuredClone(values.get(key)),
        set: async (key, value) => values.set(key, structuredClone(value)),
    };
}

function makeClient({ noPrefix = {}, premium = {}, premiumBrand = {} } = {}) {
    const sends = [];
    const userRecords = {
        legacy: { id: 'legacy', username: 'Legacy', send: async payload => sends.push(['legacy', payload]) },
        'np-user': { id: 'np-user', username: 'NoPrefix', send: async payload => sends.push(['np-user', payload]) },
        owner: { id: 'owner', username: 'Owner', send: async payload => sends.push(['owner', payload]) },
        activator: { id: 'activator', username: 'Activator', send: async payload => sends.push(['activator', payload]) },
    };
    const client = {
        user: { id: 'bot', username: 'Radio', displayAvatarURL: () => 'https://example.com/bot.png' },
        cluster: { id: 0 },
        guilds: { cache: new Map() },
        users: {
            fetch: async id => {
                if (!userRecords[id]) throw new Error('unknown user');
                return userRecords[id];
            },
        },
        data2: createDb(noPrefix),
        data3: createDb(premium),
        data4: createDb(premiumBrand),
        sends,
    };
    return client;
}

function expiredRecord(userId, expiresAt = Date.now() - 1000) {
    return { id: userId, expiresAt };
}

test('expired no-prefix grant sends one DM and preserves lifetime grants', async () => {
    const client = makeClient({
        noPrefix: { 'noprefix_bot': ['legacy', expiredRecord('np-user')] },
    });
    const scope = { type: 'global' };

    const active = await reconcileNoPrefixScope(client, scope);
    await reconcileNoPrefixScope(client, scope);

    assert.deepEqual(active, ['legacy']);
    assert.deepEqual(client.sends.map(([id]) => id), ['np-user']);
    const [recipient, message] = client.sends[0];
    assert.equal(recipient, 'np-user');
    assert.equal(message.embeds[0].data.title, 'No-Prefix Access Expired');
    assert.match(message.embeds[0].data.description, /All servers/);
    assert.deepEqual(client.data2.values.get('noprefix_bot'), ['legacy']);
});

test('expired server grant names its server and closed DMs do not block cleanup', async () => {
    const client = makeClient({
        noPrefix: { 'noprefix_guild': [expiredRecord('missing-user')] },
    });
    client.guilds.cache.set('guild', { id: 'guild', name: 'Radio Lounge' });
    client.users.fetch = async () => ({
        send: async payload => {
            client.sends.push(['missing-user', payload]);
            throw new Error('DM closed');
        },
    });

    const active = await reconcileNoPrefixScope(client, { type: 'guild', guildId: 'guild', guildName: 'Radio Lounge' });

    assert.deepEqual(active, []);
    assert.match(client.sends[0][1].embeds[0].data.description, /Radio Lounge/);
    assert.deepEqual(client.data2.values.get('noprefix_guild'), []);
});

test('startup reconciliation notifies expired global and server-specific no-prefix grants', async () => {
    const client = makeClient({
        noPrefix: {
            'noprefix_bot': [expiredRecord('np-user')],
            'noprefix_guild': [expiredRecord('legacy')],
        },
    });
    client.guilds.cache.set('guild', { id: 'guild', name: 'Radio Lounge' });

    await syncNoPrefixExpirations(client);

    assert.deepEqual(client.sends.map(([id]) => id).sort(), ['legacy', 'np-user']);
    assert.deepEqual(client.data2.values.get('noprefix_bot'), []);
    assert.deepEqual(client.data2.values.get('noprefix_guild'), []);
});

function premiumGuild(ownerId = 'owner') {
    return {
        id: 'guild',
        name: 'Radio Lounge',
        ownerId,
        members: { me: null },
    };
}

test('premium expiry DMs the server owner and activator only once', async () => {
    const client = makeClient({
        premium: {
            'premium_guild': {
                active: true, activatedAt: 10, activatedBy: 'activator',
                expiresAt: Date.now() - 1000,
            },
        },
    });
    const guild = premiumGuild();
    client.guilds.cache.set(guild.id, guild);

    await notifyPremiumExpiry(client, guild);
    await notifyPremiumExpiry(client, guild);

    assert.deepEqual(client.sends.map(([id]) => id).sort(), ['activator', 'owner']);
    assert.ok(client.sends.every(([, message]) => message.embeds[0].data.title === 'Radio Premium Expired'));
    const saved = client.data3.values.get('premium_guild');
    assert.ok(saved.expiryNoticeCompletedAt);
    assert.deepEqual(saved.expiryNoticeAttemptedUserIds.sort(), ['activator', 'owner']);
});

test('premium startup recovery notifies after downtime and continues when one DM fails', async () => {
    const client = makeClient({
        premium: {
            'premium_guild': {
                active: true, activatedAt: 20, activatedBy: 'activator',
                expiresAt: Date.now() - 1000,
            },
        },
    });
    const guild = premiumGuild();
    client.guilds.cache.set(guild.id, guild);
    const originalFetch = client.users.fetch;
    client.users.fetch = async id => {
        if (id === 'owner') return { send: async () => { throw new Error('DM closed'); } };
        return originalFetch(id);
    };

    await syncPremiumBranding(client, guild);

    assert.deepEqual(client.sends.map(([id]) => id), ['activator']);
    assert.ok(client.data3.values.get('premium_guild').expiryNoticeCompletedAt);
});

test('legacy expired Premium records notify only the server owner; active or lifetime Premium is left alone', async () => {
    const client = makeClient({
        premium: {
            'premium_guild': { active: true, expiresAt: Date.now() - 1000 },
            'premium_lifetime': { active: true, expiresAt: null },
            'premium_active': { active: true, expiresAt: Date.now() + 60_000 },
        },
    });
    const guild = premiumGuild();

    await notifyPremiumExpiry(client, guild);
    await notifyPremiumExpiry(client, { ...guild, id: 'lifetime' });
    await notifyPremiumExpiry(client, { ...guild, id: 'active' });

    assert.deepEqual(client.sends.map(([id]) => id), ['owner']);
    assert.equal(client.data3.values.get('premium_lifetime').expiryNoticeCompletedAt, undefined);
    assert.equal(client.data3.values.get('premium_active').expiryNoticeCompletedAt, undefined);
});

test('Premium owner and activator receive one DM when they are the same person', async () => {
    const client = makeClient({
        premium: {
            'premium_guild': {
                active: true, activatedAt: 30, activatedBy: 'owner',
                expiresAt: Date.now() - 1000,
            },
        },
    });

    await notifyPremiumExpiry(client, premiumGuild('owner'));

    assert.deepEqual(client.sends.map(([id]) => id), ['owner']);
    assert.match(client.sends[0][1].embeds[0].data.fields[1].value, /activating user/);
});
