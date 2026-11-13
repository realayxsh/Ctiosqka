const wh = require('../structures/webhook');
const { isPremium } = require('../structures/premiumAccess');

const pending = new WeakSet();
const normalize = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function sameTrack(a, b) {
    return Boolean(
        (a.uri && a.uri === b.uri) ||
        (a.identifier && a.identifier === b.identifier && a.sourceName === b.sourceName) ||
        (normalize(a.title) && normalize(a.title) === normalize(b.title))
    );
}

async function continueAutoplay(client, player) {
    // Duplicate empty events must not enqueue multiple recommendations.
    if (pending.has(player)) return true;
    pending.add(player);
    try {
        const busy = () => client.poru.players.get(player.guildId) !== player ||
            player.state >= 4 || player.playing || player.queue.current || player.queue.size > 0;
        if (busy()) return true;
        if (!await isPremium(client, player.guildId)) return false;
        const history = Array.isArray(player.queue.previous)
            ? player.queue.previous : [player.queue.previous].filter(Boolean);
        const seed = history[0];
        if (!seed) return false;
        // Search related music from the last artist, not generic "popular music".
        const query = seed.author && normalize(seed.author) !== 'unknown'
            ? seed.author : seed.title;
        if (!query) return false;

        for (const engine of ['youtube_music', 'youtube', 'soundcloud']) {
            let result;
            try {
                result = await player.search(query, { engine, requester: client.user });
            } catch (error) {
                wh.error('Autoplay search failed', error);
                continue;
            }
            // A listener may have queued music, stopped the player, or disabled
            // autoplay while the remote search was in flight.
            const enabled = await client.data.get(`${player.guildId}-autoPlay`);
            if (busy()) return true;
            if (enabled !== 'enabled') return true;
            if (!await isPremium(client, player.guildId)) return false;
            if (busy()) return true;
            const candidates = (result?.tracks || []).filter(track =>
                !track.isStream && track.length >= 30000 &&
                !history.slice(0, 20).some(previous => sameTrack(track, previous))
            );
            if (!candidates.length) continue;
            const track = candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
            player.queue.add(track);
            await player.play();
            if (player.queue.current || player.playing) {
                wh.music('Autoplay recommendation started', player);
                return true;
            }
            // Kazagumo can resolve play() without starting an unresolvable
            // track. Try the next source rather than reporting success.
        }
        return false;
    } finally {
        pending.delete(player);
    }
}

module.exports = { continueAutoplay };
