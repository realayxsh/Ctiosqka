const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    ANNOUNCEMENT_DELAY_MS,
    cancelPendingNowPlayingAnnouncement,
    scheduleNowPlayingAnnouncement,
} = require('../src/structures/nowPlayingAnnouncement');

test('Now Playing is delayed to align with buffered voice playback', async t => {
    let timer;
    t.mock.method(global, 'setTimeout', (callback, delay) => {
        timer = { callback, delay };
        return timer;
    });
    t.mock.method(global, 'clearTimeout', () => {});

    const track = { title: 'Current song' };
    const player = { data: new Map(), queue: { current: track } };
    let announced = false;
    scheduleNowPlayingAnnouncement(player, track, () => { announced = true; });

    assert.equal(timer.delay, ANNOUNCEMENT_DELAY_MS);
    assert.equal(announced, false);
    await timer.callback();
    assert.equal(announced, true);
});

test('a newer track cancels a stale pending Now Playing card', async t => {
    const timers = [];
    t.mock.method(global, 'setTimeout', (callback, delay) => {
        const timer = { callback, delay };
        timers.push(timer);
        return timer;
    });
    t.mock.method(global, 'clearTimeout', timer => { timer.cancelled = true; });

    const first = { title: 'First song' };
    const second = { title: 'Second song' };
    const player = { data: new Map(), queue: { current: first } };
    const announced = [];
    scheduleNowPlayingAnnouncement(player, first, () => announced.push(first.title));
    player.queue.current = second;
    scheduleNowPlayingAnnouncement(player, second, () => announced.push(second.title));

    assert.equal(timers[0].cancelled, true);
    await timers[0].callback();
    await timers[1].callback();
    assert.deepEqual(announced, ['Second song']);
});

test('destroying a player cancels its pending announcement', async t => {
    let timer;
    t.mock.method(global, 'setTimeout', callback => {
        timer = { callback };
        return timer;
    });
    t.mock.method(global, 'clearTimeout', value => { value.cancelled = true; });

    const track = { title: 'Current song' };
    const player = { data: new Map(), queue: { current: track } };
    let announced = false;
    scheduleNowPlayingAnnouncement(player, track, () => { announced = true; });
    cancelPendingNowPlayingAnnouncement(player);

    assert.equal(timer.cancelled, true);
    await timer.callback();
    assert.equal(announced, false);
});
