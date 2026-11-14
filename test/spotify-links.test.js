const { test } = require('node:test');
const assert = require('node:assert/strict');
const SpotifyLinks = require('../src/audio/spotify');
const { normalizeSpotifyLink, musicLinkSource } = SpotifyLinks;
const Play = require('../src/commands/music/Play');
const Interactions = require('../src/events/client/AvonInteractions');
const { executeSlash } = require('../src/slash/execute');
const emoji = require('../emoji.json');
const id = '0123456789AbCdEfGhIjKl';
const playlist = `https://open.spotify.com/playlist/${id}`;

test('the Spotify wrapper satisfies Kazagumo 3 plugin registration', () => {
    const plugin = new SpotifyLinks({ clientId: 'unused', clientSecret: 'unused' });
    assert.equal(plugin.constructor.name, 'KazagumoPlugin');
});

function pluginFixture(nativeSearch) {
    const plugin = new SpotifyLinks({ clientId: 'unused', clientSecret: 'unused', playlistPageLimit: 5 });
    const manager = { search: nativeSearch };
    plugin.load(manager);
    return { plugin, manager };
}

test('Spotify URL normalization handles tracking, locale, legacy links, URIs, and angle brackets', async () => {
    for (const input of [
        `${playlist}?si=example&utm_source=copy-link`,
        `https://open.spotify.com/intl-de/playlist/${id}`,
        `https://open.spotify.com/user/example/playlist/${id}`,
        `spotify:playlist:${id}`, `spotify:user:example:playlist:${id}`,
        `<${playlist}>`,
    ]) assert.equal(await normalizeSpotifyLink(input), playlist);
    for (const type of ['track', 'album', 'artist']) {
        assert.equal(await normalizeSpotifyLink(`spotify:${type}:${id}`), `https://open.spotify.com/${type}/${id}`);
    }
});

test('supported music links use exact provider hosts, not matching words in arbitrary URLs', () => {
    assert.equal(musicLinkSource(playlist), 'Spotify');
    assert.equal(musicLinkSource(`spotify:track:${id}`), 'Spotify');
    assert.equal(musicLinkSource('https://spoti.fi/abc'), 'Spotify');
    assert.equal(musicLinkSource('https://www.deezer.com/album/123'), 'Deezer');
    assert.equal(musicLinkSource('https://on.soundcloud.com/example'), 'SoundCloud');
    for (const input of ['https://evil.example/spotify.com', 'https://open.spotify.com.evil.example/playlist/abc',
        'https://user:password@open.spotify.com/playlist/abc', 'some song title']) {
        assert.equal(musicLinkSource(input), null);
    }
});

test('Spotify short links follow bounded, allowlisted redirects to a canonical URL', async () => {
    let requests = 0;
    const result = await normalizeSpotifyLink('https://spoti.fi/example', async (url, options) => {
        requests++;
        assert.equal(options.redirect, 'manual');
        assert.equal(options.method, 'HEAD');
        return { status: 302, headers: new Headers({ location: `${playlist}?si=example` }) };
    });
    assert.equal(result, playlist);
    assert.equal(requests, 1);
    await assert.rejects(normalizeSpotifyLink('https://spotify.link/example', async () => ({
        status: 302, headers: new Headers({ location: 'http://127.0.0.1/private' }),
    })), /Unsupported Spotify redirect/);
    requests = 0;
    await assert.rejects(normalizeSpotifyLink('https://spotify.link/example', async () => {
        requests++;
        return { status: 302, headers: new Headers({ location: '/loop' }) };
    }), /Could not resolve/);
    assert.equal(requests, 5);
});

test('native playlist loading preserves every returned track and requester without calling the failing API', async () => {
    const requester = { id: 'listener' };
    const tracks = Array.from({ length: 25 }, (_, index) => ({ title: `Song ${index}`, requester }));
    const result = { type: 'PLAYLIST', playlistName: 'Public playlist', tracks };
    const { manager, plugin } = pluginFixture(async (url, options) => {
        assert.equal(url, playlist);
        assert.equal(options.requester, requester);
        return result;
    });
    plugin.requestManager.makeRequest = async () => assert.fail('Native loading must not call the Spotify API');
    assert.equal(await manager.search(`${playlist}?si=example`, { requester }), result);
});

test('Spotify links fall back to the existing API loader when a node does not support Spotify', async () => {
    for (const fails of [false, true]) {
        const { manager, plugin } = pluginFixture(async () => {
            if (fails) throw new Error('Node unavailable');
            return { type: 'SEARCH', tracks: [] };
        });
        plugin.requestManager.makeRequest = async () => ({
            id, name: 'Track', artists: [{ name: 'Artist' }], duration_ms: 180000,
            album: { images: [] },
        });
        const requester = { id: 'listener' };
        const result = await manager.search(`https://open.spotify.com/track/${id}`, { requester });
        assert.equal(result.type, 'TRACK');
        assert.equal(result.tracks.length, 1);
        assert.equal(result.tracks[0].requester, requester);
    }
});

test('metadata without a song list produces an explicit loader failure instead of invalid-link claims', async () => {
    const { manager, plugin } = pluginFixture(async () => ({ tracks: [] }));
    plugin.requestManager.makeRequest = async () => ({ name: 'Metadata without tracks' });
    await assert.rejects(manager.search(playlist), { code: 'SPOTIFY_LOAD_FAILED' });
});

test('non-Spotify links and text searches continue through the original search implementation', async () => {
    const calls = [];
    const { manager } = pluginFixture(async (query, options) => { calls.push({ query, options }); return { tracks: [] }; });
    for (const query of ['a song', 'https://soundcloud.com/artist/track']) {
        await manager.search(query, { engine: 'soundcloud' });
        assert.equal(calls.at(-1).query, query);
        assert.equal(calls.at(-1).options.engine, 'soundcloud');
    }
});

function playFixture({ paused = false, result } = {}) {
    const sent = [], edits = [], queued = [];
    let starts = 0;
    const author = { id: 'listener', displayAvatarURL: () => 'https://example.com/avatar.png' };
    const tracks = Array.from({ length: 3 }, (_, index) => ({
        title: `Song ${index}`, uri: `https://open.spotify.com/track/track${index}`, length: 180000, requester: author,
    }));
    const player = { paused, playing: false, setTextChannel: () => {},
        queue: { add: track => queued.push(track) },
        search: async () => result || { type: 'PLAYLIST', playlistName: 'Public playlist', tracks },
        play: async () => { starts++; player.playing = true; },
    };
    const client = { emoji, config: { server: 'https://discord.gg/example' },
        poru: { players: new Map([['guild', player]]) } };
    const message = { author, guild: { id: 'guild', shardId: 0 },
        member: { voice: { channel: { id: 'voice' } } },
        channel: { id: 'text', send: async payload => {
            sent.push(payload);
            return { edit: async payload => edits.push(payload) };
        } } };
    return { client, message, player, queued, sent, edits, get starts() { return starts; } };
}
const contents = payload => JSON.stringify(payload.components.map(component => component.toJSON()));

test('play queues all Spotify playlist tracks and replaces Searching with the loaded song count', async () => {
    for (const query of [playlist, `spotify:playlist:${id}`, `<${playlist}>`]) {
        const f = playFixture();
        await new Play(f.client).run(f.client, f.message, [query], '+');
        assert.match(contents(f.sent[0]), /Searching/);
        assert.equal(f.queued.length, 3);
        assert.equal(f.starts, 1);
        assert.match(contents(f.edits.at(-1)), /Added Playlist to Queue/);
        assert.match(contents(f.edits.at(-1)), /3/);
    }
});

test('loading a Spotify playlist does not resume paused playback', async () => {
    const f = playFixture({ paused: true });
    await new Play(f.client).run(f.client, f.message, [playlist], '+');
    assert.equal(f.queued.length, 3);
    assert.equal(f.starts, 0);
});

test('first link search overlaps voice connection and waits before queueing', async () => {
    const f = playFixture();
    f.client.poru.players.clear();
    let connect;
    let searched = false;
    f.client.poru.createPlayer = () => new Promise(resolve => { connect = resolve; });
    f.client.poru.search = async (...args) => {
        searched = true;
        return f.player.search(...args);
    };
    const running = new Play(f.client).run(f.client, f.message, [playlist], '+');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(searched, true);
    assert.equal(f.queued.length, 0);
    f.client.poru.players.set('guild', f.player);
    connect(f.player);
    await running;
    assert.equal(f.queued.length, 3);
    assert.equal(f.starts, 1);
});

test('first text query shows the engine picker before voice connects', async () => {
    const f = playFixture();
    f.client.poru.players.clear();
    let connect;
    f.client.poru.createPlayer = () => new Promise(resolve => { connect = resolve; });
    const collector = { on: () => collector };
    f.message.channel.send = async payload => {
        f.sent.push(payload);
        return {
            edit: async payload => f.edits.push(payload),
            createMessageComponentCollector: () => collector,
        };
    };
    await new Play(f.client).run(f.client, f.message, ['my song'], '+');
    assert.match(contents(f.edits[0]), /Choose the search engine/);
    assert.equal(f.queued.length, 0);
    f.client.poru.players.set('guild', f.player);
    connect(f.player);
});

test('source buttons acknowledge and search with the selected provider', async () => {
    for (const [buttonId, engine] of [['def', 'youtube_music'], ['spoti', 'spotify'], ['deez', 'deezer'], ['sc', 'soundcloud']]) {
        const f = playFixture();
        const messageId = `source-${buttonId}`;
        const track = { title: 'Search result', uri: 'https://example.com/song', length: 120000 };
        let searchedQuery, searchOptions, deferred = 0;
        f.player.search = async (query, options) => {
            searchedQuery = query;
            searchOptions = options;
            return { type: 'TRACK', tracks: [track] };
        };
        f.message.channel.send = async payload => {
            f.sent.push(payload);
            return { id: messageId, edit: async payload => f.edits.push(payload) };
        };

        await new Play(f.client).run(f.client, f.message, ['Artist - Song Name'], '+');
        const button = f.edits[0].components[0].toJSON().components
            .flatMap(component => component.components || [])
            .find(component => component.custom_id === `play_source_${buttonId}`);
        assert(button, `Missing source button ${buttonId}`);
        await new Interactions(f.client).run({
            isButton: () => true,
            customId: `play_source_${buttonId}`,
            user: f.message.author,
            message: { id: messageId },
            deferUpdate: async () => { deferred++; },
        });
        assert.equal(deferred, 1);
        assert.equal(searchedQuery, 'Artist - Song Name');
        assert.equal(searchOptions.engine, engine);
        assert.deepEqual(f.queued, [track]);
    }
});

test('Default source falls back to YouTube when YouTube Music has no result', async () => {
    const f = playFixture();
    const messageId = 'source-quality-fallback';
    const track = { title: 'Fallback result', uri: 'https://example.com/song', length: 120000 };
    const engines = [];
    f.player.search = async (query, options) => {
        engines.push(options.engine);
        return options.engine === 'youtube_music'
            ? { type: 'SEARCH', tracks: [] }
            : { type: 'TRACK', tracks: [track] };
    };
    f.message.channel.send = async payload => {
        f.sent.push(payload);
        return { id: messageId, edit: async payload => f.edits.push(payload) };
    };

    await new Play(f.client).run(f.client, f.message, ['Artist - Song Name'], '+');
    await new Interactions(f.client).run({
        isButton: () => true,
        customId: 'play_source_def',
        user: f.message.author,
        message: { id: messageId },
        deferUpdate: async () => {},
    });

    assert.deepEqual(engines, ['youtube_music', 'youtube']);
    assert.deepEqual(f.queued, [track]);
});

test('/play preserves the submitted song query through the source-button click', async () => {
    const f = playFixture();
    const query = 'Artist - Song Name';
    const guildId = 'slash-play-guild';
    const channelId = 'slash-play-channel';
    const messageId = 'slash-play-response';
    const member = {
        voice: { channelId: 'voice' },
        permissions: { has: () => true },
    };
    let searchedQuery;
    f.player.search = async value => {
        searchedQuery = value;
        return { type: 'TRACK', tracks: [{ title: 'Slash result', uri: 'https://example.com/song', length: 120000 }] };
    };
    f.client.config = { owners: [], coowners: [], prefix: '+', voting: { enabled: false }, server: 'https://example.com' };
    f.client.user = { id: 'bot', displayAvatarURL: () => 'https://example.com/bot.png' };
    f.client.data = { get: async () => null };
    f.client.AvonCommands = { commands: new Map([['play', new Play(f.client)]]) };
    f.client.poru.players = new Map([[guildId, f.player]]);
    const interaction = {
        id: 'slash-play-interaction',
        commandName: 'play',
        channelId,
        channel: { id: channelId },
        user: f.message.author,
        member,
        guild: {
            id: guildId,
            members: { me: { voice: { channelId: 'voice' } } },
        },
        options: {
            getString: name => name === 'query' ? query : null,
            get: name => name === 'query' ? { value: query } : null,
            getUser: () => null,
            getMember: () => null,
            getChannel: () => null,
        },
        deferReply: async () => {},
        editReply: async payload => {
            f.sent.push(payload);
            return { id: messageId, edit: async edit => f.edits.push(edit) };
        },
        reply: async () => {},
    };
    await executeSlash(f.client, interaction, {
        hasVoted: async () => true,
        isPremium: async () => true,
    });

    assert.match(contents(f.sent[0]), /Artist - Song Name/);
    await new Interactions(f.client).run({
        isButton: () => true,
        customId: 'play_source_def',
        user: f.message.author,
        message: { id: messageId },
        deferUpdate: async () => {},
    });
    assert.equal(searchedQuery, query);
    assert.deepEqual(f.queued, [{ title: 'Slash result', uri: 'https://example.com/song', length: 120000 }]);
});

test('provider failures always replace Searching and identify the correct source', async () => {
    for (const query of [playlist, 'https://www.deezer.com/playlist/123']) {
        const f = playFixture();
        f.player.search = async () => { throw new Error('Loader failed'); };
        await new Play(f.client).run(f.client, f.message, [query], '+');
        const copy = contents(f.edits.at(-1));
        assert.match(copy, /Could not load/);
        assert.match(copy, query.includes('deezer') ? /Deezer/ : /Spotify/);
        assert.doesNotMatch(copy, /invalid|Searching/);
        assert.equal(f.queued.length, 0);
    }
});
