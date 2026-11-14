const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getPrefix, invalidatePrefixCache, TTL_MS } = require('../src/structures/prefixCache');

test('prefix lookup is cached and invalidation picks up a changed prefix', async () => {
    let reads = 0;
    const values = new Map([['guild-prefix', '+']]);
    const client = { config: { prefix: '+' }, data: { get: async key => { reads++; return values.get(key); } } };
    assert.equal(await getPrefix(client, 'guild'), '+');
    values.set('guild-prefix', '?');
    assert.equal(await getPrefix(client, 'guild'), '+');
    assert.equal(reads, 1);
    invalidatePrefixCache('guild');
    assert.equal(await getPrefix(client, 'guild'), '?');
    assert.equal(reads, 2);
    assert.equal(TTL_MS, 5 * 60 * 1000);
});

test('concurrent prefix cache misses share one database read', async () => {
    let reads = 0, resolveRead;
    const client = {
        config: { prefix: '+' },
        data: { get: () => {
            reads++;
            return new Promise(resolve => { resolveRead = resolve; });
        } },
    };
    const first = getPrefix(client, 'parallel-guild');
    const second = getPrefix(client, 'parallel-guild');
    assert.equal(reads, 1);
    resolveRead('!');
    assert.deepEqual(await Promise.all([first, second]), ['!', '!']);
});
