const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EmbedBuilder, Collection } = require('discord.js');
const wh = require('../src/structures/webhook');
const { WEBHOOK_KEYS, createWebhookLogger, validWebhookUrl } = wh;

function fixture(overrides = {}) {
    const env = Object.fromEntries(Object.values(WEBHOOK_KEYS).map((key, index) =>
        [key, `https://discord.com/api/webhooks/12345678901234567${index}/${'unit_test_only_'.repeat(5)}${index}`]));
    const sent = [], output = [], destroyed = [];
    const logger = createWebhookLogger({
        env, output: { log: text => output.push(text), warn: text => output.push(text) },
        makeClient: url => ({
            send: async payload => sent.push({ category: Object.keys(WEBHOOK_KEYS).find(category => env[WEBHOOK_KEYS[category]] === url), payload }),
            destroy: () => destroyed.push(url),
        }), ...overrides,
    });
    return { env, sent, output, destroyed, logger };
}

test('six event categories have isolated destinations and never fall back to another route', async () => {
    const f = fixture();
    assert(Object.values(f.logger.initWebhook()).every(status => status === 'configured'));
    await f.logger.send(new EmbedBuilder().setTitle('Bot joined'), 'join');
    await f.logger.send(new EmbedBuilder().setTitle('Bot left'), 'leave');
    await f.logger.command('play', { userId: 'listener', guildId: 'guild', source: 'slash' });
    await f.logger.music('Track started', { guildId: 'guild', textId: 'text' });
    await f.logger.error('Playback failure', Object.assign(new Error('private details'), { code: 50013 }));
    await f.logger.info('Bot online', 'Ready');
    assert.deepEqual(f.sent.map(item => item.category), Object.keys(WEBHOOK_KEYS));
    assert(f.sent.every(item => item.payload.allowedMentions.parse.length === 0));
    delete f.env.JOIN_LOG_WEBHOOK_URL;
    f.logger.initWebhook();
    assert.equal(await f.logger.send(new EmbedBuilder().setTitle('Bot joined'), 'join'), false);
    assert.equal(f.sent.length, 6);
});

test('missing and invalid secrets are reported without showing URLs or auto-creating webhooks', async () => {
    const env = { JOIN_LOG_WEBHOOK_URL: 'https://untrusted.example/api/webhooks/123/credential' };
    const messages = [];
    const logger = createWebhookLogger({ env,
        output: { warn: text => messages.push(text), log: text => messages.push(text) },
        makeClient: () => assert.fail('Invalid endpoint reached client construction') });
    const status = logger.initWebhook();
    assert.equal(status.join, 'invalid');
    assert.equal(status.leave, 'missing');
    assert.equal(await logger.info('Bot online', 'Ready'), false);
    assert(messages.some(text => text.includes('JOIN_LOG_WEBHOOK_URL')));
    assert(!messages.join(' ').includes('untrusted.example'));
    assert(!messages.join(' ').includes('credential'));
    for (const url of ['http://discord.com/api/webhooks/123/token', 'https://discord.com.evil.example/api/webhooks/123/token',
        'https://user:password@discord.com/api/webhooks/123/token', 'file:///tmp/webhooks']) assert.equal(validWebhookUrl(url), false);
});

test('initialization is idempotent and changing one setting does not recreate the other routes', () => {
    const f = fixture();
    const first = f.logger.initWebhook();
    assert.deepEqual(f.logger.initWebhook(), first);
    assert.equal(f.destroyed.length, 0);
    f.env.JOIN_LOG_WEBHOOK_URL = f.env.JOIN_LOG_WEBHOOK_URL.replace('/api/', '/api/v10/');
    f.logger.initWebhook();
    assert.equal(f.destroyed.length, 1);
    assert(validWebhookUrl(f.env.JOIN_LOG_WEBHOOK_URL));
});

test('config category switches disable only that destination and can be re-enabled', async () => {
    const settings = { enabled: true, webhooks: { join: { enabled: false, secret: 'JOIN_LOG_WEBHOOK_URL' } } };
    const f = fixture({ settings });
    assert.equal(f.logger.initWebhook().join, 'disabled');
    assert.equal(await f.logger.send(new EmbedBuilder().setTitle('Joined'), 'join'), false);
    assert.equal(await f.logger.info('Online', 'Ready'), true);
    settings.webhooks.join.enabled = true;
    assert.equal(f.logger.initWebhook().join, 'configured');
    assert.equal(await f.logger.send(new EmbedBuilder().setTitle('Joined'), 'join'), true);
});

test('global config switch disables all routes without reading their secret values', async () => {
    const f = fixture({ settings: { enabled: false } });
    assert(Object.values(f.logger.initWebhook()).every(status => status === 'disabled'));
    assert.equal(await f.logger.info('Online', 'Ready'), false);
    assert.equal(f.sent.length, 0);
});

test('config secret references select their own environment key', async () => {
    const f = fixture({ settings: { webhooks: { join: { secret: 'CUSTOM_JOIN_WEBHOOK_URL' } } } });
    f.env.CUSTOM_JOIN_WEBHOOK_URL = f.env.JOIN_LOG_WEBHOOK_URL;
    delete f.env.JOIN_LOG_WEBHOOK_URL;
    assert.equal(f.logger.initWebhook().join, 'configured');
    assert.equal(await f.logger.send(new EmbedBuilder().setTitle('Joined'), 'join'), true);
});

test('invalid config references or switches are rejected without printing their contents', () => {
    const f = fixture({ settings: { webhooks: {
        join: { secret: 'https://private.example/credential' }, leave: { enabled: 'false' },
    } } });
    const states = f.logger.initWebhook();
    assert.equal(states.join, 'invalid');
    assert.equal(states.leave, 'invalid');
    assert(!f.output.join(' ').includes('private.example'));
});

test('command logs omit arguments, message contents, premium codes, and eval input', async () => {
    const f = fixture();
    f.logger.initWebhook();
    await f.logger.command('redeem', { userId: 'user', guildId: 'guild', channelId: 'channel', source: 'slash',
        args: ['SENSITIVE-PREMIUM-CODE'], content: 'private message content' });
    await f.logger.command('eval', { userId: 'owner', source: 'owner DM', owner: true,
        args: ['process.env.token'], content: 'private eval content' });
    const encoded = JSON.stringify(f.sent);
    for (const value of ['SENSITIVE-PREMIUM-CODE', 'private message content', 'process.env.token', 'private eval content']) assert(!encoded.includes(value));
    assert(encoded.includes('redeem') && encoded.includes('eval') && encoded.includes('owner DM'));
});

test('embed redaction removes secret values, webhook URLs, database credentials, and authorization fields', async () => {
    const f = fixture();
    f.env.token = 'synthetic_discord_token_unit_test_only';
    f.env.SESSION_SECRET = 'synthetic_session_secret_unit_test_only';
    f.logger.initWebhook();
    const webhook = 'https://discord.com/api/webhooks/999999999999999999/unrelated_private_webhook_token_unit_test_only';
    await f.logger.info('Sensitive data test', `${f.env.token} ${f.env.SESSION_SECRET} ${webhook} mongodb+srv://user:pass@host/db authorization=private_header_value`);
    const encoded = JSON.stringify(f.sent);
    for (const value of [f.env.token, f.env.SESSION_SECRET, webhook, 'user:pass', 'private_header_value']) assert(!encoded.includes(value));
    assert(encoded.includes('REDACTED'));
});

test('error logs omit exception messages, request bodies, and stack traces', async () => {
    const f = fixture();
    f.logger.initWebhook();
    const error = Object.assign(new Error('PRIVATE-CODE-123 in request'), {
        code: 50013, requestBody: { token: 'private-request-token' },
        stack: 'Error: PRIVATE-CODE-123\n at https://private.example/sensitive',
    });
    await f.logger.error('Command failure', error);
    const encoded = JSON.stringify(f.sent);
    assert(encoded.includes('50013'));
    assert(!encoded.includes('PRIVATE-CODE-123'));
    assert(!encoded.includes('private-request-token'));
    assert(!encoded.includes('private.example'));
});

test('revoked webhook failures disable only their own route and do not expose request details', async () => {
    const output = [];
    let failures = 0;
    const f = fixture({
        output: { warn: text => output.push(text), log: text => output.push(text) },
        makeClient: url => ({ send: async () => {
            if (url.includes('123456789012345670')) {
                failures++;
                throw Object.assign(new Error(`secret request URL ${url}`), { status: 404, code: 10015 });
            }
        } }),
    });
    f.logger.initWebhook();
    assert.equal(await f.logger.send(new EmbedBuilder().setTitle('Joined'), 'join'), false);
    assert.equal(await f.logger.send(new EmbedBuilder().setTitle('Joined again'), 'join'), false);
    assert.equal(await f.logger.info('Online', 'Ready'), true);
    assert.equal(failures, 1);
    assert(output.some(text => text.includes('10015')));
    assert(!output.join(' ').includes('https://'));
});

test('temporary delivery errors allow later events to recover', async () => {
    let calls = 0;
    const f = fixture({ makeClient: () => ({ send: async () => {
        if (++calls === 1) throw Object.assign(new Error('temporary'), { status: 503 });
    } }) });
    f.logger.initWebhook();
    assert.equal(await f.logger.info('Online', 'Ready'), false);
    assert.equal(await f.logger.info('Online', 'Ready'), true);
});

test('pending deliveries are bounded instead of growing an unlimited queue', async () => {
    let release;
    const f = fixture({ maxPending: 1, makeClient: () => ({ send: () => new Promise(resolve => { release = resolve; }) }) });
    f.logger.initWebhook();
    const first = f.logger.info('First', 'Ready');
    assert.equal(await f.logger.info('Second', 'Ready'), false);
    release();
    assert.equal(await first, true);
    assert(f.output.some(text => text.includes('queue is full')));
});

test('bot guild join and leave handlers use different webhook categories', async t => {
    const calls = [];
    t.mock.method(wh, 'send', async (embed, category) => calls.push({ embed: embed.toJSON(), category }));
    const storage = { set: async () => {}, delete: async () => {} };
    const guild = { id: 'guild', name: 'Unit test server', memberCount: 10, ownerId: 'owner',
        createdTimestamp: 1600000000000, iconURL: () => null, fetchOwner: async () => ({ user: { tag: 'Test owner' } }) };
    const client = { data: storage, data2: storage, guilds: { cache: new Collection([['guild', guild]]) },
        user: { displayAvatarURL: () => 'https://example.com/icon.png' }, cluster: { broadcastEval: async () => [1] } };
    await new (require('../src/events/client/AvonGuildCreate'))(client).run(guild);
    await new (require('../src/events/client/AvonGuildDelete'))(client).run(guild);
    assert.deepEqual(calls.map(call => call.category), ['join', 'leave']);
});

test('slash, prefix, and owner DM entry points log metadata without command options', async t => {
    const logged = [];
    t.mock.method(wh, 'command', (name, metadata) => logged.push({ name, metadata }));
    const { executeSlash } = require('../src/slash/execute');
    const { runOwnerMessage } = require('../src/structures/ownerMessages');
    const CommandHandler = require('../src/structures/CommandHandler');
    const client = { on: () => {}, config: { owners: ['owner'], coowners: [], prefix: '+' }, user: { id: 'bot' },
        data: { get: async () => null }, data2: { get: async () => [] }, poru: { players: new Map() } };
    const handler = new CommandHandler(client);
    handler.commands.set('play', { name: 'play', run: async () => {} });
    handler.commands.set('eval', { name: 'eval', ownerOnly: true, run: async () => {} });
    client.AvonCommands = handler;
    const guild = { id: 'guild-log-test', members: { me: { permissionsIn: () => ({ has: () => true }), voice: {} } } };
    const member = { permissions: { has: () => true }, voice: { channelId: 'voice' } };
    await executeSlash(client, {
        commandName: 'play', user: { id: 'user' }, guild, member, channelId: 'channel', channel: {},
        options: { get: () => ({ value: 'private search query' }) },
        deferReply: async () => {}, editReply: async () => {},
    }, { hasVoted: async () => true, isPremium: async () => true });
    await handler.run({ content: '+play private search query', author: { id: 'user' }, guild, member,
        channel: { id: 'channel' }, attachments: new Collection(), stickers: new Collection() });
    await runOwnerMessage(client, { content: 'eval private code', author: { id: 'owner' }, guild: null });
    assert.deepEqual(logged.map(call => call.metadata.source), ['slash', 'prefix or mention', 'owner DM']);
    assert(!JSON.stringify(logged).includes('private'));
    assert.equal(logged.at(-1).metadata.owner, true);
});
