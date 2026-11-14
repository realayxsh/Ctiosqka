const ANNOUNCEMENT_DELAY_MS = 3500;
const TIMER_KEY = 'nowPlayingAnnouncementTimer';
const TOKEN_KEY = 'nowPlayingAnnouncementToken';

function cancelPendingNowPlayingAnnouncement(player) {
    if (!player?.data) return;
    const timer = player.data.get(TIMER_KEY);
    if (timer) clearTimeout(timer);
    player.data.delete(TIMER_KEY);
    player.data.delete(TOKEN_KEY);
}

function scheduleNowPlayingAnnouncement(player, track, announce, onError) {
    cancelPendingNowPlayingAnnouncement(player);
    const token = Symbol('now-playing-announcement');
    player.data.set(TOKEN_KEY, token);

    const timer = setTimeout(async () => {
        if (player.data.get(TOKEN_KEY) !== token) return;
        player.data.delete(TIMER_KEY);
        player.data.delete(TOKEN_KEY);
        if (player.queue.current !== track) return;

        try {
            await announce();
        } catch (error) {
            onError?.(error);
        }
    }, ANNOUNCEMENT_DELAY_MS);

    player.data.set(TIMER_KEY, timer);
    return timer;
}

module.exports = {
    ANNOUNCEMENT_DELAY_MS,
    cancelPendingNowPlayingAnnouncement,
    scheduleNowPlayingAnnouncement,
};
