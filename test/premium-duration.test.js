const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    parsePremiumDuration, parseGenerationArgs,
} = require('../src/structures/premiumDuration');
const GenPremium = require('../src/commands/owner/GenPremium');

test('duration shorthand maps to the expected length and labels', () => {
    const day = 24 * 60 * 60 * 1000;
    assert.deepEqual(parsePremiumDuration('1m'), { key: '30d', milliseconds: 30 * day, label: '1 Month' });
    assert.deepEqual(parsePremiumDuration('2m'), { key: '60d', milliseconds: 60 * day, label: '2 Months' });
    assert.deepEqual(parsePremiumDuration('1y'), { key: '365d', milliseconds: 365 * day, label: '1 Year' });
    assert.equal(parsePremiumDuration('lifetime').milliseconds, null);
    assert.equal(parsePremiumDuration('forever').key, 'lifetime');
    assert.equal(parsePremiumDuration('25m'), null);
    assert.equal(parsePremiumDuration('6y'), null);
});

test('generation requires the number first and the duration second', () => {
    assert.equal(parseGenerationArgs(['5', '2m']).amount, 5);
    assert.equal(parseGenerationArgs(['3', '1y']).duration.key, '365d');
    assert.equal(parseGenerationArgs(['11', '1m']).error, 'Amount must be between 1 and 10.');
    assert.match(parseGenerationArgs(['2m', '5']).error, /first argument/);
    assert.match(parseGenerationArgs(['5']).error, /both/);
    assert.match(parseGenerationArgs(['5', '25m']).error, /Choose a duration/);
});

test('genprem stores the requested count and duration from positional arguments', async () => {
    const store = new Map([['premium_codes', []]]);
    const client = {
        config: { owners: ['owner'], coowners: [] },
        emoji: { premium: 'PREMIUM', cross: 'ERROR' },
        data3: {
            get: async key => store.get(key),
            set: async (key, value) => store.set(key, value),
        },
    };
    const message = {
        author: { id: 'owner', displayAvatarURL: () => 'https://example.com/avatar.png' },
        channel: { send: async payload => payload },
    };
    await new GenPremium(client).run(client, message, ['3', '2m'], '+');
    const codes = store.get('premium_codes');
    assert.equal(codes.length, 3);
    assert.ok(codes.every(code => code.duration === '60d'));
});
