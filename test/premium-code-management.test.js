const { test } = require('node:test');
const assert = require('node:assert/strict');
const ListPremiumCodes = require('../src/commands/owner/ListPremiumCodes');
const RevokePremiumCode = require('../src/commands/owner/RevokePremiumCode');

function fixture(owner = true) {
    const codes = [
        { code: 'PREM-ONE', duration: '60d' },
        { code: 'PREM-TWO', duration: 'lifetime' },
        'PREM-LEGACY',
    ];
    const sent = [];
    let writes = 0;
    const client = {
        config: { owners: ['owner'], coowners: [] },
        emoji: { premium: 'PREMIUM', cross: 'ERROR', tick: 'OK', info: 'INFO' },
        data3: {
            get: async () => codes,
            set: async (_, next) => { writes++; codes.splice(0, codes.length, ...next); },
        },
    };
    const message = {
        author: { id: owner ? 'owner' : 'visitor' },
        channel: { send: async payload => { sent.push(payload); return payload; } },
    };
    return { client, message, sent, codes, get writes() { return writes; } };
}

const text = payload => payload.components.map(component => component.toJSON().components
    .map(child => child.content || '').join('\n')).join('\n');

test('listpremcodes shows unused codes and their durations', async () => {
    const f = fixture();
    await new ListPremiumCodes(f.client).run(f.client, f.message);
    const output = f.sent.map(text).join('\n');
    assert.match(output, /PREM-ONE.*2 Months/);
    assert.match(output, /PREM-TWO.*Lifetime/);
    assert.match(output, /PREM-LEGACY.*30 Days/);
});

test('revokepremcode removes only the matching unused code case-insensitively', async () => {
    const f = fixture();
    await new RevokePremiumCode(f.client).run(f.client, f.message, ['prem-two'], '+');
    assert.deepEqual(f.codes.map(code => typeof code === 'string' ? code : code.code), ['PREM-ONE', 'PREM-LEGACY']);
    assert.equal(f.writes, 1);
    assert.match(text(f.sent[0]), /revoked/);
});

test('revoking missing codes does not change the inventory', async () => {
    const f = fixture();
    await new RevokePremiumCode(f.client).run(f.client, f.message, ['missing'], '+');
    assert.equal(f.codes.length, 3);
    assert.equal(f.writes, 0);
});

test('code inventory and revocation stay restricted to owners', async () => {
    const f = fixture(false);
    await new ListPremiumCodes(f.client).run(f.client, f.message);
    await new RevokePremiumCode(f.client).run(f.client, f.message, ['PREM-ONE'], '+');
    assert.equal(f.sent.length, 0);
    assert.equal(f.writes, 0);
});
