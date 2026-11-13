const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Player } = require('shoukaku');
const { PRESETS, FILTER_KEYS, FILTER_OPTIONS, cleanFilters, applyFilter, filterMessage } = require('../src/audio/filters');
const FilterCommand = require('../src/structures/filterCommand');
const Interactions = require('../src/events/client/AvonInteractions');
const emoji = require('../emoji.json');
const supported = Object.keys(cleanFilters());

function fixture() {
    const requests = [];
    const node = {
        info: { filters: supported },
        rest: {
            async updatePlayer(request) { requests.push(structuredClone(request)); },
            async getLavalinkInfo() { return { filters: supported }; },
        },
    };
    const shoukaku = new Player('guild', node);
    const player = {
        data: new Map(), node, shoukaku, volume: 55, paused: false,
        queue: { current: { title: 'Test track' } },
        async setVolume(volume) {
            await node.rest.updatePlayer({ guildId: 'guild', playerOptions: { volume } });
            this.volume = volume;
        },
    };
    return { player, node, requests };
}

function commandClasses() {
    const directory = path.join(__dirname, '../src/commands/filters');
    return fs.readdirSync(directory).filter(file => file.endsWith('.js')).map(file => require(path.join(directory, file)));
}

function clientFor(player) {
    return {
        emoji, config: { owners: ['tester'], prefix: '+' },
        data: { get: async () => undefined },
        poru: { players: new Map([['guild', player]]) },
        data3: { get: async () => null },
        AvonCommands: { commands: new Map(commandClasses().map(Command => {
            const command = new Command({});
            return [command.name, command];
        })) },
    };
}

function interactionFor(value, type = 'filter_select') {
    const responses = [];
    return {
        responses, values: [value], customId: type, commandName: 'filters',
        options: { getString: () => value }, channelId: 'text',
        user: { id: 'tester', displayAvatarURL: () => 'https://example.com/avatar.png' },
        guild: { id: 'guild', members: { me: { voice: { channelId: 'voice', channel: {} } } } },
        member: { voice: { channelId: 'voice' }, permissions: { has: () => true } },
        isButton: () => false,
        isStringSelectMenu: () => type !== 'slash',
        isChatInputCommand: () => type === 'slash',
        async deferReply() { this.deferred = true; },
        async editReply(response) { responses.push(response); return response; },
        async reply(response) { this.replied = true; responses.push(response); return response; },
        async followUp(response) { responses.push(response); return response; },
    };
}

function responseText(interaction) {
    return JSON.stringify(interaction.responses.map(response =>
        response.components.map(component => component.toJSON())));
}

test('every preset produces a complete, bounded request through the real Shoukaku player', async t => {
    for (const [id, preset] of Object.entries(PRESETS)) {
        await t.test(id, async () => {
            const { player, requests } = fixture();
            player.paused = true;
            const result = await applyFilter(player, id);
            assert.equal(requests.length, 1);
            const payload = requests[0].playerOptions;
            assert.equal(payload.paused, true);
            assert.equal(player.shoukaku.paused, true);
            assert(!Object.hasOwn(payload, 'volume'), 'Native volume must not be multiplied twice');
            assert(!Object.hasOwn(payload, 'position'), 'Filter changes must not seek');
            assert(!Object.hasOwn(payload, 'track'), 'Filter changes must not restart tracks');
            assert.equal(player.volume, 55);
            assert(payload.filters.volume > 0 && payload.filters.volume <= 1);
            for (const { band, gain } of payload.filters.equalizer) {
                assert(band >= 0 && band <= 14);
                assert(gain >= -0.25 && gain <= 0.2, 'EQ should leave sensible headroom');
            }
            assert.equal(result.label, preset.label);
            assert.equal(player.data.get('activeFilter'), id);
            assert.equal(player.data.get(preset.key), true);
            assert.equal(FILTER_KEYS.filter(key => player.data.get(key)).length, 1);
        });
    }
});

test('spatial presets use distinct headphone rotation rates without a mono mixer or pitch wobble', () => {
    for (const id of ['8d', 'dolbyatmos']) {
        assert(PRESETS[id].filters.rotation.rotationHz >= 0.15);
        assert(PRESETS[id].filters.rotation.rotationHz <= 0.3);
        assert(!PRESETS[id].filters.channelMix);
        assert(!PRESETS[id].filters.vibrato);
    }
    assert.notEqual(PRESETS['8d'].filters.rotation.rotationHz, PRESETS.dolbyatmos.filters.rotation.rotationHz);
    assert.match(filterMessage({ id: 'dolbyatmos', ...PRESETS.dolbyatmos }, emoji), /not true Dolby Atmos/);
});

test('switching, toggling off, and clearing fully reset old effects and every state flag', async () => {
    const { player, requests } = fixture();
    await applyFilter(player, 'dolbyatmos');
    await applyFilter(player, 'lofi');
    assert.equal(requests[1].playerOptions.filters.rotation, null);
    assert.equal(player.data.get('dolbyatmos'), false);
    assert.equal(player.data.get('lofi'), true);
    const off = await applyFilter(player, 'lofi', { toggle: true });
    assert.equal(off.disabled, true);
    assert.deepEqual(requests[2].playerOptions.filters, cleanFilters());
    for (const key of FILTER_KEYS) player.data.set(key, true);
    await applyFilter(player, 'clearfilters');
    assert(FILTER_KEYS.every(key => player.data.get(key) === false));
    assert.equal(player.data.get('activeFilter'), null);
    assert.deepEqual(player.shoukaku.filters, cleanFilters());
});

test('new tracks do not overwrite a selected filter', async () => {
    const { player, requests } = fixture();
    await applyFilter(player, 'none', { initialize: true });
    await applyFilter(player, '8d');
    assert.equal(await applyFilter(player, 'none', { initialize: true }), null);
    assert.equal(requests.length, 2);
    assert.equal(player.data.get('activeFilter'), '8d');
});

test('server rejection keeps the previous confirmed filter and later changes can recover', async () => {
    const { player, node } = fixture();
    await applyFilter(player, '8d');
    const savedFilters = structuredClone(player.shoukaku.filters);
    const update = node.rest.updatePlayer;
    node.rest.updatePlayer = async () => { throw new Error('rejected'); };
    await assert.rejects(applyFilter(player, 'dolbyatmos'), /rejected/);
    assert.equal(player.data.get('activeFilter'), '8d');
    assert.deepEqual(player.shoukaku.filters, savedFilters);
    node.rest.updatePlayer = update;
    await applyFilter(player, 'nightcore');
    assert.equal(player.data.get('activeFilter'), 'nightcore');
    assert.equal(player.shoukaku.filters.rotation, null);
});

test('missing server support is reported before claiming success', async () => {
    const { player, node, requests } = fixture();
    node.info.filters = supported.filter(name => name !== 'rotation');
    await assert.rejects(applyFilter(player, '8d'), /does not support rotation/);
    assert.equal(requests.length, 0);
    assert.equal(player.data.get('8d'), undefined);
});

test('failed capability requests are retried rather than cached as success', async () => {
    const { player, node } = fixture();
    node.info = null;
    node.rest.getLavalinkInfo = async () => { throw new Error('offline'); };
    await assert.rejects(applyFilter(player, '8d'), /offline/);
    node.rest.getLavalinkInfo = async () => ({ filters: supported });
    await applyFilter(player, '8d');
    assert.equal(player.data.get('8d'), true);
});

test('rapid selections are serialized and the last confirmed choice wins', async () => {
    const { player, node, requests } = fixture();
    const update = node.rest.updatePlayer;
    node.rest.updatePlayer = async request => {
        if (request.playerOptions.filters.rotation) await new Promise(resolve => setTimeout(resolve, 10));
        return update(request);
    };
    await Promise.all([applyFilter(player, '8d'), applyFilter(player, 'nightcore'), applyFilter(player, 'none')]);
    assert.equal(requests.length, 3);
    assert.equal(requests[0].playerOptions.filters.rotation.rotationHz, 0.25);
    assert.equal(requests[1].playerOptions.filters.rotation, null);
    assert.deepEqual(requests[2].playerOptions.filters, cleanFilters());
    assert.equal(player.data.get('activeFilter'), null);
});

test('all prefix commands inherit shared handling while retaining command identifiers and access metadata', async () => {
    for (const Command of commandClasses()) {
        const { player, requests } = fixture();
        const client = clientFor(player);
        const command = new Command(client);
        assert.equal(command.run, FilterCommand.prototype.run);
        assert.equal(command.cat, 'filters');
        assert.equal(command.player, true);
        assert.equal(command.sameVoice, true);
        assert.equal(command.vote, true);
        const messages = [];
        await command.run(client, { channel: { send: async message => messages.push(message) } }, [], '+', player);
        assert.equal(requests.length, 1);
        assert.equal(messages.length, 1);
        assert.equal(player.data.get('activeFilter'), command.name === 'clearfilters' ? null : command.name);
        if (command.name === 'dolbyatmos') {
            assert.equal(command.premium, true);
            assert.deepEqual(command.aliases, ['dolby', 'atmos']);
        }
    }
});

test('both dropdowns and slash commands apply exactly the same spatial preset', async () => {
    const payloads = [];
    for (const type of ['filter_select', 'np_filter', 'slash']) {
        const { player, requests } = fixture();
        const client = clientFor(player);
        const interaction = interactionFor('dolbyatmos', type);
        await new Interactions(client).run(interaction);
        assert.equal(interaction.deferred, true);
        assert.equal(requests.length, 1);
        assert.match(responseText(interaction), /Enabled/);
        assert.match(responseText(interaction), /not true Dolby Atmos/);
        payloads.push(requests[0].playerOptions.filters);
    }
    assert.deepEqual(payloads[0], payloads[1]);
    assert.deepEqual(payloads[1], payloads[2]);
});

test('both dropdowns enforce voice and premium access before changing audio', async () => {
    for (const type of ['filter_select', 'np_filter']) {
        const { player, requests } = fixture();
        const client = clientFor(player);
        const wrongVoice = interactionFor('8d', type);
        wrongVoice.member.voice.channelId = 'elsewhere';
        await new Interactions(client).run(wrongVoice);
        assert.match(responseText(wrongVoice), /same voice channel/);
        const denied = interactionFor('dolbyatmos', type);
        denied.user.id = 'non-owner';
        denied.guild.id = `no-premium-${type}`;
        client.poru.players.set(denied.guild.id, player);
        await new Interactions(client).run(denied);
        assert.match(responseText(denied), /Premium/);
        assert.equal(requests.length, 0);
    }
});

test('dropdown clear uses clean baseline, and node failures produce an explicit failure response', async t => {
    t.mock.method(console, 'warn', () => {});
    const { player, node, requests } = fixture();
    const client = clientFor(player);
    await applyFilter(player, 'dolbyatmos');
    const clear = interactionFor('clearfilters', 'np_filter');
    await new Interactions(client).run(clear);
    assert.deepEqual(requests.at(-1).playerOptions.filters, cleanFilters());
    assert.match(responseText(clear), /Cleared all filters/);
    node.rest.updatePlayer = async () => { throw new Error('server failed'); };
    const failure = interactionFor('8d');
    await new Interactions(client).run(failure);
    assert.match(responseText(failure), /Could not apply the filter/);
    assert.doesNotMatch(responseText(failure), /Enabled/);
    assert.equal(player.data.get('activeFilter'), null);
});

test('native volume changes, including mute, preserve the active preset without doubling gain', async () => {
    const Volume = require('../src/commands/music/Volume');
    const { player, requests } = fixture();
    const client = clientFor(player);
    await applyFilter(player, 'dolbyatmos');
    const filters = structuredClone(player.shoukaku.filters);
    const message = {
        guild: { id: 'guild' },
        author: { displayAvatarURL: () => 'https://example.com/avatar.png' },
        channel: { send: async () => {} },
    };
    await new Volume(client).run(client, message, ['0'], '+');
    assert.deepEqual(requests.at(-1).playerOptions, { volume: 0 });
    assert.equal(player.volume, 0);
    assert.deepEqual(player.shoukaku.filters, filters);
    await applyFilter(player, '8d');
    assert.equal(player.volume, 0, 'Switching filters must not unmute the player');
});

test('filter dropdowns respect disabled command channels for non-owners', async () => {
    const { player, requests } = fixture();
    const client = clientFor(player);
    client.config.owners = [];
    client.data.get = async () => 'disabled';
    const interaction = interactionFor('8d', 'np_filter');
    await new Interactions(client).run(interaction);
    assert.match(responseText(interaction), /disabled in this channel/);
    assert.equal(requests.length, 0);
});

test('menus expose all presets without claiming true Atmos or native hall reverb', () => {
    assert.equal(FILTER_OPTIONS.length, Object.keys(PRESETS).length + 1);
    assert(FILTER_OPTIONS.every(option => option.label.length <= 100 && option.desc.length <= 100));
    assert.match(FILTER_OPTIONS.find(option => option.value === 'dolbyatmos').desc, /not true Dolby Atmos/);
});
