const { test } = require('node:test');
const assert = require('node:assert/strict');
const { KazagumoQueue } = require('kazagumo/dist/Managers/Supports/KazagumoQueue');
const Skip = require('../src/commands/music/Skip');
const { createDefinitions, slashArguments } = require('../src/slash/catalog');
const { executeSlash } = require('../src/slash/execute');
const { Collection } = require('discord.js');
const emoji = require('../emoji.json');

function fixture(loop = 'none') {
    const sent = [], plays = [], tracks = ['First', 'Second', 'Third', 'Fourth'].map(title => ({ title }));
    let skips = 0;
    const player = { loop, shoukaku: { emit: () => {} },
        skip: () => { skips++; },
        play: async (track, options) => { plays.push({ track, options }); player.queue.current = track; } };
    player.queue = new KazagumoQueue(player);
    player.queue.current = { title: 'Current' };
    player.queue.push(...tracks);
    const client = { emoji, config: { prefix: '+', owners: [], voting: { enabled: false } },
        data: { get: async () => null }, poru: { players: new Map([['guild', player]]) } };
    const message = { author: { id: 'caller', displayAvatarURL: () => 'https://example.com/avatar.png' },
        channel: { send: async payload => sent.push(payload) } };
    return { client, message, player, tracks, sent, plays, get skips() { return skips; } };
}
const copy = f => JSON.stringify(f.sent.map(payload => payload.components.map(c => c.toJSON())));

test('skip without a position preserves ordinary one-song skip behavior', async () => {
    const f = fixture();
    await new Skip().run(f.client, f.message, [], '+', f.player);
    assert.equal(f.skips, 1);
    assert.equal(f.plays.length, 0);
    assert.equal(f.player.queue.length, 4);
    assert.match(copy(f), /Skipped the current track/);
});

test('skip-to uses the same one-based numbering as the upcoming queue', async () => {
    for (const position of [1, 3, 4]) {
        const f = fixture();
        const current = f.player.queue.current;
        await new Skip().run(f.client, f.message, [String(position)], '+', f.player);
        assert.equal(f.player.queue.current, f.tracks[position - 1]);
        assert.deepEqual([...f.player.queue], f.tracks.slice(position));
        assert.equal(f.skips, 0);
        assert.deepEqual(f.plays[0].options, { replaceCurrent: true });
        assert.equal(f.player.queue.previous[0], current);
        assert.match(copy(f), new RegExp(`Skipped to queue position ${position}`));
    }
});

test('invalid positions leave the current song and entire queue untouched', async () => {
    for (const args of [['0'], ['-1'], ['1.5'], ['3abc'], ['1e2'], ['5'], ['9007199254740992'], ['2', 'extra']]) {
        const f = fixture();
        const current = f.player.queue.current;
        await new Skip().run(f.client, f.message, args, '+', f.player);
        assert.equal(f.player.queue.current, current);
        assert.deepEqual([...f.player.queue], f.tracks);
        assert.equal(f.skips, 0);
        assert.equal(f.plays.length, 0);
        assert.doesNotMatch(copy(f), /Skipped to/);
    }
});

test('a positioned skip on an empty upcoming queue does not skip the current song', async () => {
    const f = fixture();
    f.player.queue.clear();
    await new Skip().run(f.client, f.message, ['1'], '+', f.player);
    assert.equal(f.skips, 0);
    assert.match(copy(f), /no songs in the upcoming queue/);
});

test('a positioned skip jumps past track repeat while retaining repeat on the target', async () => {
    const f = fixture('track');
    await new Skip().run(f.client, f.message, ['3'], '+', f.player);
    assert.equal(f.player.queue.current, f.tracks[2]);
    assert.equal(f.player.loop, 'track');
});

test('queue repeat retains bypassed songs at the end in their original order', async () => {
    const f = fixture('queue');
    const current = f.player.queue.current;
    await new Skip().run(f.client, f.message, ['3'], '+', f.player);
    assert.deepEqual([...f.player.queue], [f.tracks[3], current, f.tracks[0], f.tracks[1]]);
    assert.equal(f.player.loop, 'queue');
});

test('failed playback restores the queue including songs added during the request', async () => {
    const f = fixture();
    const current = f.player.queue.current;
    const extra = { title: 'Newly added' };
    f.player.play = async track => {
        f.player.queue.current = track;
        f.player.queue.push(extra);
        throw new Error('Node rejected playback');
    };
    await new Skip().run(f.client, f.message, ['3'], '+', f.player);
    assert.equal(f.player.queue.current, current);
    assert.deepEqual([...f.player.queue], [...f.tracks, extra]);
    assert.match(copy(f), /restored/);
});

test('an unresolvable selected track does not produce a false success response', async () => {
    const f = fixture();
    f.player.play = async () => { f.player.queue.current = null; };
    await new Skip().run(f.client, f.message, ['2'], '+', f.player);
    assert.match(copy(f), /selected song couldn't be played/);
    assert.doesNotMatch(copy(f), /Skipped to/);
});

test('slash skip registers an optional positive queue position and passes it to the real handler', async () => {
    const definition = createDefinitions().find(command => command.name === 'skip');
    assert.equal(definition.options[0].name, 'position');
    assert.equal(definition.options[0].type, 4);
    assert.equal(definition.options[0].min_value, 1);
    assert.ok(!definition.options[0].required);
    const f = fixture();
    f.client.AvonCommands = { commands: new Collection([['skip', new Skip()]]) };
    const interaction = { commandName: 'skip', channelId: 'channel', channel: {},
        guild: { id: 'guild', members: { me: { voice: { channelId: 'voice' } } } },
        member: { voice: { channelId: 'voice' }, permissions: { has: () => true } },
        user: f.message.author, options: { get: name => name === 'position' ? { value: 3 } : null },
        deferReply: async () => {}, editReply: async payload => f.sent.push(payload) };
    assert.deepEqual(slashArguments(interaction, 'skip'), ['3']);
    await executeSlash(f.client, interaction, { hasVoted: async () => true, isPremium: async () => true });
    assert.equal(f.player.queue.current, f.tracks[2]);
    assert.match(copy(f), /Skipped to queue position 3/);
});
