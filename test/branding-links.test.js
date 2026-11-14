const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WEBSITE_URL, PREMIUM_URL } = require('../src/structures/brandingLinks');
const fs = require('node:fs');

test('official website and premium page use the requested URLs', () => {
    assert.equal(WEBSITE_URL, 'https://radiomusic.in');
    assert.equal(PREMIUM_URL, 'https://radiomusic.in/premium');
});

test('all Get Premium buttons use the premium page, not the support server', () => {
    for (const file of ['src/structures/playbackControls.js', 'src/commands/music/NowPlaying.js', 'src/commands/settings/PremiumStatus.js']) {
        const content = fs.readFileSync(file, 'utf8');
        assert.match(content, /Get Premium.{0,100}PREMIUM_URL/s, file);
    }
});
