const { test } = require('node:test');
const assert = require('node:assert/strict');
const { updateVoiceStatus, clearVoiceStatus } = require('../src/structures/voiceStatus');

function fixture() {
    const writes = [];
    const client = {
        emoji: { music: '<:OFJxMUSIC:1570772412591644774>' },
        rest: { put: async (route, options) => writes.push([route, options.body.status]) },
    };
    return { client, writes, player: { voiceId: '123' } };
}

test('status includes configured music emoji and song title, then clears', async () => {
    const { client, player, writes } = fixture();
    await updateVoiceStatus(client, player, { title: 'My\nSong' });
    await clearVoiceStatus(client, player);
    assert.deepEqual(writes, [
        ['/channels/123/voice-status', `${client.emoji.music} | My Song`],
        ['/channels/123/voice-status', null],
    ]);
    await clearVoiceStatus(client, player);
    assert.equal(writes.length, 2);
});

test('consecutive song writes remain ordered and status respects the limit', async () => {
    const { client, player, writes } = fixture();
    await Promise.all([
        updateVoiceStatus(client, player, { title: 'First' }),
        clearVoiceStatus(client, player),
        updateVoiceStatus(client, player, { title: '🎵'.repeat(600) }),
    ]);
    assert.match(writes[0][1], /First$/);
    assert.equal(writes[1][1], null);
    assert.equal(Array.from(writes[2][1]).length, 500);
});

test('moving channels clears the old status before setting the new one', async () => {
    const { client, player, writes } = fixture();
    await updateVoiceStatus(client, player, { title: 'Song' });
    player.voiceId = '456';
    await updateVoiceStatus(client, player, { title: 'Song' });
    assert.deepEqual(writes.slice(1), [
        ['/channels/123/voice-status', null],
        ['/channels/456/voice-status', `${client.emoji.music} | Song`],
    ]);
});

test('API permission failures do not reject playback operations', async () => {
    const { client, player } = fixture();
    client.rest.put = async () => { throw Object.assign(new Error('Missing permissions'), { code: 50013 }); };
    await assert.doesNotReject(updateVoiceStatus(client, player, { title: 'Song' }));
    await assert.doesNotReject(clearVoiceStatus(client, player));
});
