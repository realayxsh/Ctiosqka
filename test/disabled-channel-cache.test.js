const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    isChannelDisabled, invalidateDisabledChannel, TTL_MS,
} = require('../src/structures/disabledChannelCache');

test('reuses channel state for the short cache window and invalidates after settings changes', async () => {
    let reads = 0;
    let value;
    const client = { data: { get: async () => { reads++; return value; } } };
    assert.equal(await isChannelDisabled(client, 'guild', 'channel'), false);
    value = 'disabled';
    assert.equal(await isChannelDisabled(client, 'guild', 'channel'), false);
    assert.equal(reads, 1);

    invalidateDisabledChannel(client, 'guild', 'channel');
    assert.equal(await isChannelDisabled(client, 'guild', 'channel'), true);
    assert.equal(reads, 2);
    assert.equal(TTL_MS, 30_000);
});

test('coalesces concurrent cache misses into one database request', async () => {
    let reads = 0;
    let release;
    const client = { data: { get: () => {
        reads++;
        return new Promise(resolve => { release = resolve; });
    } } };
    const first = isChannelDisabled(client, 'guild', 'channel');
    const second = isChannelDisabled(client, 'guild', 'channel');
    assert.equal(reads, 1);
    release(undefined);
    assert.deepEqual(await Promise.all([first, second]), [false, false]);
});

test('invalidating an in-flight lookup prevents its stale result being cached', async () => {
    let reads = 0;
    let release;
    let value = 'disabled';
    const client = { data: { get: () => {
        reads++;
        const snapshot = value;
        if (reads === 1) return new Promise(resolve => { release = () => resolve(snapshot); });
        return Promise.resolve(value);
    } } };
    const pending = isChannelDisabled(client, 'guild', 'channel');
    invalidateDisabledChannel(client, 'guild', 'channel');
    value = undefined;
    release();
    assert.equal(await pending, true);
    assert.equal(await isChannelDisabled(client, 'guild', 'channel'), false);
    assert.equal(reads, 2);
});
