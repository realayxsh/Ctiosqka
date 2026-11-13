const { test } = require('node:test');
const assert = require('node:assert/strict');
const { continueAutoplay } = require('../src/audio/autoplay');
const Autoplay = require('../src/commands/settings/Autoplay');
const PlayerEmpty = require('../src/events/poru/PlayerEmpty');

function fixture() {
    const seed = { title: 'Last song', author: 'Last artist', identifier: 'old', sourceName: 'soundcloud', length: 180000 };
    const next = { title: 'Another song', author: seed.author, identifier: 'next', length: 180000 };
    const searches = [], sent = [];
    let enabled = 'enabled', plays = 0;
    const queue = { previous: [seed], current: null, size: 0, add(track) { this.next = track; this.size++; } };
    const player = { guildId: 'guild', textId: 'text', state: 1, playing: false, queue,
        search: async (query, options) => { searches.push({ query, ...options }); return { tracks: [next] }; },
        play: async () => { plays++; queue.current = queue.next; queue.size = 0; player.playing = true; } };
    const client = { user: { username: 'Radio' }, emoji: { music: '🎵' },
        poru: { players: new Map([['guild', player]]) },
        data: { get: async key => key.endsWith('-247') ? 'enabled' : enabled,
            set: async (key, value) => { enabled = value; } },
        data3: { get: async () => ({ active: true, expiresAt: null }) },
        channels: { cache: new Map([['text', { send: async payload => sent.push(payload) }]]) } };
    return { client, player, seed, next, searches, sent, get plays() { return plays; },
        get enabled() { return enabled; }, set enabled(value) { enabled = value; } };
}

test('autoplay first use enables it and subsequent use disables it before confirming', async () => {
    const f = fixture();
    f.enabled = undefined;
    const message = { guild: { id: 'guild' }, author: { displayAvatarURL: () => 'https://example.com/avatar.png' },
        channel: { send: async () => assert.ok(['enabled', 'disabled'].includes(f.enabled)) } };
    await new Autoplay().run(f.client, message);
    assert.equal(f.enabled, 'enabled');
    await new Autoplay().run(f.client, message);
    assert.equal(f.enabled, 'disabled');
});

test('empty queue uses the latest history entry and awaits a new song', async () => {
    const f = fixture();
    assert.equal(await continueAutoplay(f.client, f.player), true);
    assert.equal(f.searches[0].query, 'Last artist');
    assert.equal(f.plays, 1);
    assert.equal(f.player.queue.current, f.next);
});

test('rejects repeats, streams, and tracks shorter than the playback minimum', async () => {
    const f = fixture();
    f.player.search = async () => ({ tracks: [f.seed, { ...f.next, length: 1000 },
        { ...f.next, isStream: true }, f.next] });
    await continueAutoplay(f.client, f.player);
    assert.equal(f.player.queue.current, f.next);
});

test('falls back after empty or unavailable search sources', async () => {
    const f = fixture();
    f.player.search = async (query, { engine }) => {
        f.searches.push(engine);
        if (engine === 'youtube_music') throw new Error('unavailable');
        return { tracks: engine === 'soundcloud' ? [f.next] : [] };
    };
    assert.equal(await continueAutoplay(f.client, f.player), true);
    assert.deepEqual(f.searches, ['youtube_music', 'youtube', 'soundcloud']);
});

test('does not interrupt a manual song queued during a search', async () => {
    const f = fixture();
    f.player.search = async () => { f.player.queue.size = 1; return { tracks: [f.next] }; };
    assert.equal(await continueAutoplay(f.client, f.player), true);
    assert.equal(f.plays, 0);
    assert.equal(f.player.queue.size, 1);
});

test('does not restart stopped players or continue after autoplay is disabled', async () => {
    for (const change of [
        f => f.client.poru.players.delete('guild'),
        f => { f.enabled = 'disabled'; },
        f => { f.player.state = 4; },
    ]) {
        const f = fixture();
        f.player.search = async () => { change(f); return { tracks: [f.next] }; };
        await continueAutoplay(f.client, f.player);
        assert.equal(f.plays, 0);
    }
});

test('duplicate empty events start at most one recommendation', async () => {
    const f = fixture();
    let finish, searching;
    const entered = new Promise(resolve => { searching = resolve; });
    f.player.search = () => new Promise(resolve => { finish = resolve; searching(); });
    const first = continueAutoplay(f.client, f.player);
    await entered;
    assert.equal(await continueAutoplay(f.client, f.player), true);
    finish({ tracks: [f.next] });
    await first;
    assert.equal(f.plays, 1);
});

test('awaited playback failures propagate and release the recommendation lock', async () => {
    const f = fixture();
    f.player.play = async () => { throw new Error('play failed'); };
    await assert.rejects(continueAutoplay(f.client, f.player), /play failed/);
    f.player.queue.size = 0;
    f.player.play = async () => { f.player.queue.current = f.next; };
    assert.equal(await continueAutoplay(f.client, f.player), true);
});

test('no history or only repeated results reports no recommendation', async () => {
    const f = fixture();
    f.player.search = async () => ({ tracks: [f.seed] });
    assert.equal(await continueAutoplay(f.client, f.player), false);
    f.player.queue.previous = [];
    assert.equal(await continueAutoplay(f.client, f.player), false);
});

test('queue end starts autoplay even in 24/7 mode', async () => {
    const f = fixture();
    await new PlayerEmpty(f.client).run(f.player);
    assert.equal(f.plays, 1);
    assert.equal(f.sent.length, 0);
});

test('failed autoplay sends an explanation without leaving in 24/7 mode', async () => {
    const f = fixture();
    f.player.search = async () => ({ tracks: [] });
    await new PlayerEmpty(f.client).run(f.player);
    assert.equal(f.plays, 0);
    assert.match(JSON.stringify(f.sent[0]), /couldn't find a playable new song/);
    assert.ok(f.client.poru.players.has('guild'));
});
