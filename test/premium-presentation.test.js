const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const emoji = require('../emoji.json');
const TrackStart = require('../src/events/poru/TrackStart');
const NowPlaying = require('../src/commands/music/NowPlaying');
const Help = require('../src/commands/info/help');
const PremiumStatus = require('../src/commands/settings/PremiumStatus');

function fixture() {
    const sent = [], edits = [], events = {};
    const collector = { on: (event, callback) => { events[event] = callback; } };
    const message = { editable: true, edit: async payload => edits.push(payload),
        createMessageComponentCollector: () => collector };
    const channel = { send: async payload => { sent.push(payload); return message; } };
    const requester = { id: 'listener', displayAvatarURL: () => 'https://example.com/avatar.png', toString: () => '<@listener>' };
    const track = { title: 'Test song', author: 'Test artist', length: 180000,
        uri: 'https://example.com/song', requester };
    const player = { textId: 'text', position: 15000, volume: 80, loop: 'none',
        queue: { current: track }, data: new Map([['qualityInit', true]]) };
    const client = {
        config: { prefix: '+', server: 'https://discord.gg/example' }, emoji,
        user: { id: 'bot', username: 'Radio', displayAvatarURL: requester.displayAvatarURL },
        channels: { cache: new Map([['text', channel]]) }, poru: { players: new Map([['guild', player]]) },
        data4: { get: async () => ({}) }, data3: { get: async () => ({ expiresAt: null }) },
        AvonCommands: { commands: new Collection([
            ['play', { name: 'play', cat: 'music' }], ['8d', { name: '8d', cat: 'filters' }],
            ['premium', { name: 'premium', cat: 'premium' }],
        ]) },
    };
    return { client, player, track, sent, edits, events,
        message: { author: requester, guild: { id: 'guild', name: 'Test server', iconURL: () => null }, channel } };
}
const serialize = payload => JSON.stringify(payload.components.map(component => component.toJSON()));

test('automatic track cards retain every control, the filter dropdown, and Premium, with Lyrics in the first row', async () => {
    const f = fixture();
    await new TrackStart(f.client).run(f.player, f.track);
    const card = serialize(f.sent[0]);
    assert.match(card, /Now Playing/);
    assert(card.includes(`${emoji.music} **[Test song]`));
    assert.match(card, /Get Premium/);
    assert.match(card, /pl1/);
    assert.match(card, /pl_lyrics/);
    const rows = f.sent[0].components[0].toJSON().components.filter(component => component.type === 1);
    assert.deepEqual(rows[0].components.map(button => button.label), ['Stop', 'Pause', 'Loop', 'Skip', 'Lyrics']);
    assert.deepEqual(rows[1].components.map(button => button.label), ['Previous', 'Get Premium']);
    assert.equal(rows[2].components[0].custom_id, 'filter_select');
    assert.equal(rows[2].components[0].options.length, 16);
    assert.equal(f.player.data.get('music').editable, true);
});

test('pause and loop button updates preserve the same rows and all filter choices', async () => {
    const f = fixture();
    const Interactions = require('../src/events/client/AvonInteractions');
    f.player.data.set('music', { id: 'playback-message' });
    f.player.pause = paused => { f.player.paused = paused; };
    f.player.setLoop = loop => { f.player.loop = loop; };
    const updates = [];
    const interaction = {
        customId: 'pl2', user: { id: 'listener' }, channelId: 'text',
        guild: { id: 'guild', members: { me: { voice: { channelId: 'voice' } } } },
        member: { voice: { channelId: 'voice' } }, message: { id: 'playback-message' },
        isButton: () => true, isStringSelectMenu: () => false, isChatInputCommand: () => false,
        update: async payload => updates.push(payload),
    };
    const event = new Interactions(f.client);
    await event.run(interaction);
    interaction.customId = 'pl3';
    await event.run(interaction);
    assert.equal(updates.length, 2);
    for (const payload of updates) {
        assert(serialize(payload).includes(`${emoji.music} **[Test song]`));
        const rows = payload.components[0].toJSON().components.filter(component => component.type === 1);
        assert.equal(rows[0].components.length, 5);
        assert.equal(rows[0].components[4].custom_id, 'pl_lyrics');
        assert.equal(rows[1].components[0].custom_id, 'pl4');
        assert.equal(rows[1].components[1].label, 'Get Premium');
        assert.equal(rows[2].components[0].options.length, 16);
    }
    assert.match(serialize(updates[0]), /Resume/);
    assert.match(serialize(updates[1]), /Loop ON/);
});

test('requested Now Playing retains all filter choices and Premium during live updates', async t => {
    const f = fixture();
    let update;
    t.mock.method(global, 'setInterval', callback => { update = callback; return {}; });
    t.mock.method(global, 'clearInterval', () => {});
    await new NowPlaying(f.client).run(f.client, f.message, [], '+', f.player);
    f.player.data.set('activeFilter', '8d');
    await update();
    for (const payload of [f.sent[0], f.edits[0]]) {
        const card = serialize(payload);
        assert.match(card, /Get Premium/);
        assert.match(card, /np_filter/);
        const menu = payload.components[1].toJSON().components[0];
        assert.equal(menu.options.length, 16);
    }
    const updatedMenu = f.edits[0].components[1].toJSON().components[0];
    assert.equal(updatedMenu.options.find(option => option.default).value, '8d');
    for (let i = 0; i < 23; i++) await update();
    assert.match(serialize(f.edits.at(-1)), /np_filter/);
    assert.match(serialize(f.edits.at(-1)), /Live updates paused/);
    f.client.poru.players.delete('guild');
    await update();
    assert.doesNotMatch(serialize(f.edits.at(-1)), /np_filter/);
    assert.match(serialize(f.edits.at(-1)), /No longer playing/);
});

test('help highlights Premium and keeps filter details in their own category', async () => {
    const f = fixture();
    await new Help(f.client).run(f.client, f.message, [], '+');
    const home = f.sent[0].components[0].toJSON();
    assert.match(JSON.stringify(home), /Radio Premium/);
    assert.doesNotMatch(JSON.stringify(home), /Two ways|Use prefix/);
    assert.match(JSON.stringify(home), /`play`/);
    assert.doesNotMatch(JSON.stringify(home), /\/filter/);
    assert.doesNotMatch(JSON.stringify(home), /8D|Bass Boost/);
    const navigation = f.sent[0].components[1].toJSON();
    assert.deepEqual(navigation.components.map(button => button.custom_id), ['m1', 'm3', 'm4', 'm6', 'm5']);
    assert(navigation.components.every(button => button.style === 2 && button.emoji && !button.label));
    assert(!navigation.components.some(button => button.custom_id === 'm2'));
    let premium;
    await f.events.collect({ isButton: () => true, customId: 'm6', update: async payload => { premium = payload; } });
    const copy = serialize(premium);
    assert.match(copy, /Get Premium/);
    assert.match(copy, /icon and banner/);
    assert(copy.includes('**More ways to personalize your music**\\nAccess premium audio presets without cluttering your playback controls.'));
    assert.match(copy, /`redeem <code>`/);
    assert.doesNotMatch(copy, /filter effect:|Vote-Only Filters|Premium Filters/);
});

test('active Premium status describes real benefits rather than a filter list', async () => {
    const f = fixture();
    await new PremiumStatus(f.client).run(f.client, f.message, [], '+');
    const copy = serialize(f.sent[0]);
    assert.match(copy, /Premium/);
    assert.match(copy, /custom bot icon and banner/);
    assert.doesNotMatch(copy, /All filters are unlocked|BassBoost, Nightcore, 8D/);
});

test('help lists every filter in All Commands and the Filters category without promoting them on playback', async () => {
    const f = fixture();
    const { inventory } = require('../src/slash/catalog');
    const filters = inventory.filter(command => command.folder === 'filters');
    for (const command of filters) f.client.AvonCommands.commands.set(command.name, { name: command.name, cat: 'filters' });
    await new Help(f.client).run(f.client, f.message, [], '+');
    for (const customId of ['m5', 'm2']) {
        let payload;
        await f.events.collect({ isButton: () => true, customId, update: async data => { payload = data; } });
        const copy = serialize(payload);
        for (const command of filters) {
            const usage = `\`${command.name}\``;
            assert(copy.includes(usage), `Missing ${usage} in ${customId}`);
        }
    }
});

test('help Music and Information list commands side by side like All Commands', async () => {
    const f = fixture();
    for (const [name, cat] of [['queue', 'music'], ['pause', 'music'], ['help', 'info'], ['ping', 'info']]) {
        f.client.AvonCommands.commands.set(name, { name, cat });
    }
    await new Help(f.client).run(f.client, f.message, [], '+');
    for (const [customId, expected] of [['m1', '`pause`, `play`, `queue`'], ['m4', '`help`, `ping`']]) {
        let payload;
        await f.events.collect({ isButton: () => true, customId, update: async data => { payload = data; } });
        const components = payload.components[0].toJSON().components;
        assert.equal(components.at(-1).content, expected);
    }
});

test('help sections show a short usage note while the home menu stays uncluttered', async () => {
    const f = fixture();
    await new Help(f.client).run(f.client, f.message, [], '!');
    const check = (payload, isHome = false) => {
        const copy = serialize(payload);
        if (isHome) assert.doesNotMatch(copy, /Use prefix/);
        else assert(copy.includes('Use prefix `!` or slash `/`.'));
        assert.doesNotMatch(copy, /Two ways to use commands|Type the prefix before/);
        assert.doesNotMatch(copy, /`[\/!+][a-z0-9]/i);
        assert.equal(payload.components.length, 3);
        assert.equal(payload.components[1].toJSON().components.length, 5);
    };
    check(f.sent[0], true);
    for (const value of ['ok1', 'ok2', 'ok3', 'ok4', 'ok5', 'ok6', 'ok7']) {
        let payload;
        await f.events.collect({ isButton: () => false, isStringSelectMenu: () => true,
            values: [value], update: async data => { payload = data; } });
        check(payload, value === 'ok1');
    }
});
