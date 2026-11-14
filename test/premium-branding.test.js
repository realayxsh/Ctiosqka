const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    PREMIUM_NICKNAME, applyPremiumBranding, restorePremiumBranding,
} = require('../src/structures/premiumBranding');

function fixture({ nickname = null, avatar = null, saved = {} } = {}) {
    const store = new Map([['server_brand_guild', structuredClone(saved)]]);
    const updates = [];
    const me = {
        nickname, avatar,
        setNickname: async value => { updates.push(['nickname', value]); me.nickname = value; },
        avatarURL: () => avatar ? `https://cdn.discordapp.com/guilds/guild/users/bot/avatars/${avatar}.png` : null,
    };
    const guild = {
        id: 'guild',
        members: {
            get me() { return me; },
            fetchMe: async () => {
                me.avatar = 'new-avatar';
                me.avatarURL = () => 'https://cdn.discordapp.com/guilds/guild/users/bot/avatars/new-avatar.png';
                return me;
            },
        },
    };
    const client = {
        data4: {
            get: async key => structuredClone(store.get(key)),
            set: async (key, value) => store.set(key, structuredClone(value)),
            delete: async key => store.delete(key),
        },
        rest: { patch: async (route, { body }) => updates.push(['avatar', route, body.avatar]) },
    };
    return { client, guild, me, updates, store };
}

test('Premium applies a per-server nickname and bundled logo while preserving the previous identity', async () => {
    const f = fixture({ nickname: 'Radio', saved: { icon: 'https://example.com/old-icon.png', banner: 'old-banner' } });
    const result = await applyPremiumBranding(f.client, f.guild);
    assert.deepEqual(result, { nickname: true, avatar: true });
    assert.equal(f.updates[0][1], PREMIUM_NICKNAME);
    assert.match(f.updates[1][2], /^data:image\/jpeg;base64,/);
    const saved = f.store.get('server_brand_guild');
    assert.deepEqual(saved.premiumIdentity, {
        nickname: 'Radio',
        avatarUrl: null,
        icon: 'https://example.com/old-icon.png',
        appliedAvatarHash: 'new-avatar',
    });
    assert.equal(saved.banner, 'old-banner');
    assert.match(saved.icon, /new-avatar\.png$/);
});

test('expiration restores the previous nickname, avatar, and embed icon', async () => {
    const f = fixture({ saved: {
        icon: 'https://example.com/old-icon.png',
        banner: 'keep-banner',
        premiumIdentity: { nickname: 'Radio', avatarUrl: null, icon: 'https://example.com/old-icon.png' },
    } });
    assert.equal(await restorePremiumBranding(f.client, f.guild), true);
    assert.deepEqual(f.updates, [
        ['nickname', 'Radio'],
        ['avatar', '/guilds/guild/members/@me', null],
    ]);
    assert.deepEqual(f.store.get('server_brand_guild'), {
        icon: 'https://example.com/old-icon.png',
        banner: 'keep-banner',
    });
});

test('restore removes the branding record when there was no earlier customization', async () => {
    const f = fixture({ saved: { premiumIdentity: { nickname: null, avatarUrl: null, icon: null } } });
    assert.equal(await restorePremiumBranding(f.client, f.guild), true);
    assert.equal(f.store.has('server_brand_guild'), false);
});

test('redeeming Premium replies before applying the server-specific profile', { timeout: 5000 }, async () => {
    const Redeem = require('../src/commands/settings/Redeem');
    const f = fixture({ nickname: null });
    const data = new Map([
        ['premium_guild', null],
        ['premium_codes', [{ code: 'RADIO30', duration: '30d' }]],
    ]);
    f.client.data3 = {
        get: async key => data.get(key),
        set: async (key, value) => data.set(key, value),
    };
    Object.assign(f.client, {
        config: { owners: [] },
        emoji: { premium: 'PREMIUM', tick: 'OK', warning: 'WARN', cross: 'ERROR' },
    });
    f.guild.name = 'Test server';
    f.guild.iconURL = () => null;
    const replies = [];
    let finishAvatarUpdate;
    let markAvatarUpdateStarted;
    const avatarUpdateStarted = new Promise(resolve => { markAvatarUpdateStarted = resolve; });
    f.client.rest.patch = async (route, { body }) => {
        f.updates.push(['avatar', route, body.avatar]);
        markAvatarUpdateStarted();
        await new Promise(resolve => { finishAvatarUpdate = resolve; });
    };
    const message = {
        guild: f.guild, author: { id: 'admin' },
        member: { permissions: { has: () => true } },
        channel: { send: async payload => { replies.push(payload); return payload; } },
    };
    await new Redeem(f.client).run(f.client, message, ['radio30'], '+');
    assert.equal(data.get('premium_guild').active, true);
    assert.equal(replies.length, 1);
    await avatarUpdateStarted;
    assert.equal(f.updates[0][1], PREMIUM_NICKNAME);
    assert.match(f.updates[1][2], /^data:image\/jpeg;base64,/);
    finishAvatarUpdate();
    await new Promise(resolve => setImmediate(resolve));
});
