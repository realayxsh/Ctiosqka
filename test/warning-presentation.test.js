const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const emoji = require('../emoji.json');
const { filterMessage, filterFailure } = require('../src/audio/filters');

function fixture() {
    const calls = [];
    const player = { paused: true, volume: 100, pause() { throw new Error('Unexpected playback change'); },
        setVolume() { throw new Error('Unexpected volume change'); } };
    const client = { emoji, config: { owners: ['caller'] }, poru: { players: new Map([['guild', player]]) },
        data3: { get: async () => ({ active: true, expiresAt: null }) } };
    const message = { guild: { id: 'guild' }, author: { id: 'caller',
        displayAvatarURL: () => 'https://example.com/avatar.png' }, member: { permissions: { has: () => true } },
        channel: { send: async data => calls.push(data) } };
    return { client, message, player, calls };
}

test('already paused, resumed, unchanged volume, and active Premium use warning without changing state', async () => {
    for (const [file, args, configure] of [
        ['music/Pause', [], () => {}],
        ['music/Resume', [], f => { f.player.paused = false; }],
        ['music/Volume', ['100'], () => {}],
        ['settings/Redeem', ['unused-code'], () => {}],
    ]) {
        const f = fixture();
        configure(f);
        const Command = require(`../src/commands/${file}`);
        await new Command(f.client).run(f.client, f.message, args, '+', f.player);
        const text = JSON.stringify(f.calls.map(call => call.components.map(c => c.toJSON())));
        assert.ok(text.includes(emoji.warning), file);
        assert.match(text, /already/i, file);
        assert.ok(!text.includes(emoji.tick), file);
        assert.ok(!text.includes(emoji.cross), file);
    }
});

test('filter disable and clear are successes; unsupported capabilities warn and rejected updates fail', () => {
    assert.ok(filterMessage({ disabled: true, previous: '8d' }, emoji).startsWith(emoji.tick));
    assert.ok(filterMessage({ id: null }, emoji).startsWith(emoji.tick));
    assert.ok(filterFailure(new Error('Audio server does not support rotation'), emoji).startsWith(emoji.warning));
    assert.ok(filterFailure(new Error('Update rejected'), emoji).startsWith(emoji.cross));
});

test('already-active notices use warnings without treating invalid or used codes as notices', () => {
    const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? files(file) : file.endsWith('.js') ? [file] : [];
    });
    const warning = /\b(?:is already|are already|already has|already in|already connected|already paused|already resumed|already set)\b/i;
    for (const file of files(path.join(__dirname, '../src/commands'))) {
        for (const [index, line] of fs.readFileSync(file, 'utf8').split('\n').entries()) {
            const icon = line.match(/\$\{(?:client\.emoji|em)\.(cross|tick)\}/);
            if (!icon) continue;
            const text = line.slice(icon.index + icon[0].length);
            assert.ok(!warning.test(text), `${path.relative(process.cwd(), file)}:${index + 1} must use warning`);
        }
    }
});

test('invalid input, permission denials, and failed playback keep cross emojis', async () => {
    for (const [file, args, configure] of [
        ['music/Volume', ['999'], () => {}],
        ['music/Skip', ['invalid'], () => {}],
        ['settings/Redeem', ['invalid'], f => { f.client.config.owners = []; f.message.member.permissions.has = () => false; }],
        ['settings/Redeem', ['invalid'], f => { f.client.data3.get = async () => null; }],
    ]) {
        const f = fixture();
        configure(f);
        const Command = require(`../src/commands/${file}`);
        await new Command(f.client).run(f.client, f.message, args, '+', f.player);
        const text = JSON.stringify(f.calls.map(call => call.components.map(c => c.toJSON())));
        assert.ok(text.includes(emoji.cross), file);
        assert.ok(!text.includes(emoji.warning), file);
    }
});
