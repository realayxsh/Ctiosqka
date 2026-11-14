const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PREFERRED_AUDIO_ENGINES, searchBestAvailableAudio } = require('../src/audio/searchQuality');

test('default audio search prefers YouTube Music and falls back to YouTube', async () => {
    assert.deepEqual(PREFERRED_AUDIO_ENGINES, ['youtube_music', 'youtube']);
    const engines = [];
    const track = { title: 'Official track' };
    const result = await searchBestAvailableAudio(async (query, options) => {
        engines.push(options.engine);
        return options.engine === 'youtube_music' ? { tracks: [] } : { tracks: [track] };
    }, 'artist - song', { requester: 'listener' });

    assert.deepEqual(engines, ['youtube_music', 'youtube']);
    assert.deepEqual(result.tracks, [track]);
});

test('default audio search falls back when the preferred engine is unavailable', async () => {
    const engines = [];
    const track = { title: 'Available track' };
    const result = await searchBestAvailableAudio(async (query, options) => {
        engines.push(options.engine);
        if (options.engine === 'youtube_music') throw new Error('source unavailable');
        return { tracks: [track] };
    }, 'artist - song');

    assert.deepEqual(engines, ['youtube_music', 'youtube']);
    assert.deepEqual(result.tracks, [track]);
});

test('an explicitly selected source is not silently replaced', async () => {
    const engines = [];
    const result = await searchBestAvailableAudio(async (query, options) => {
        engines.push(options.engine);
        return { tracks: [] };
    }, 'artist - song', { engine: 'soundcloud' });

    assert.deepEqual(engines, ['soundcloud']);
    assert.deepEqual(result.tracks, []);
});
