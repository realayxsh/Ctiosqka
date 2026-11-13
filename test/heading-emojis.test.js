const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const emojis = require('../emoji.json');

const root = path.resolve(__dirname, '..');
function sourceFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? sourceFiles(file) : file.endsWith('.js') ? [file] : [];
    });
}
const sources = sourceFiles(path.join(root, 'src')).map(file => ({
    file: path.relative(root, file),
    content: fs.readFileSync(file, 'utf8'),
}));
const optionalKeys = [
    'search', 'pause', 'resume', 'stop', 'skip', 'previous', 'restart',
    'loop', 'shuffle', 'volume', 'connect', 'disconnect', 'seek',
    'remove', 'clearqueue', 'autoplay', 'mode247',
];

test('bot source parses and no embed starts with a bare heading separator', () => {
    for (const { file, content } of sources) {
        assert.doesNotThrow(() => new vm.Script(content, { filename: file }));
        assert(!content.includes('`**|'), `Missing heading emoji in ${file}`);
    }
});

test('heading emoji expressions resolve with empty keys and custom animated replacements', () => {
    const expressions = sources.flatMap(({ content }) => Array.from(content.matchAll(
        /\$\{((?:this\.)?client\.emoji\.\w+(?:\s*\|\|\s*(?:this\.)?client\.emoji\.\w+)*)\} (?:\*\*)?\|/g
    ), match => match[1]));
    assert(expressions.length > 0);
    for (const expression of expressions) {
        const keys = Array.from(expression.matchAll(/emoji\.(\w+)/g), match => match[1]);
        keys.forEach(key => assert(Object.hasOwn(emojis, key), `Missing emoji key ${key}`));
        const resolve = new Function('client', `return (${expression.replaceAll('this.client', 'client')});`);
        assert.match(resolve({ emoji: emojis }), /^<a?:\w+:\d+>$/);
        for (const key of keys) {
            const replacement = '<a:CustomHeading:123456789012345678>';
            const custom = { ...emojis, [key]: replacement };
            const expected = keys.map(name => custom[name]).find(Boolean);
            assert.equal(resolve({ emoji: custom }), expected);
        }
    }
    for (const key of optionalKeys) {
        assert(Object.hasOwn(emojis, key));
        assert(expressions.some(expression => expression.includes(`emoji.${key} ||`)), `Unwired ${key} key`);
    }
});

test('both song and playlist queue additions use the configured queue emoji', () => {
    const play = sources.find(source => source.file === 'src/commands/music/Play.js').content;
    assert.equal(play.split('**${client.emoji.queue} | Added Song to Queue**').length - 1, 2);
    assert.equal(play.split('**${client.emoji.queue} | Added Playlist to Queue**').length - 1, 2);
});

test('nowplaying emoji is configured centrally and retained during message updates', () => {
    assert.equal(emojis.nowplaying, '<a:RedPlaying:1210730216104792145>');
    for (const file of [
        'src/events/poru/TrackStart.js',
        'src/commands/music/NowPlaying.js',
        'src/events/client/AvonInteractions.js',
    ]) {
        const content = sources.find(source => source.file === file).content;
        assert(content.includes('.emoji.nowplaying ||'));
        assert(!content.includes('<a:RedPlaying:'));
    }
});
