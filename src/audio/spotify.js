const SpotifyPlugin = require('kazagumo-spotify');

const SHORT_HOSTS = new Set(['spotify.link', 'spoti.fi']);
const SPOTIFY_HOSTS = new Set(['open.spotify.com', ...SHORT_HOSTS]);
const TRACK_PATH = /^\/(?:intl-[a-z-]+\/)?(?:user\/[^/]+\/)?(track|playlist|album|artist)\/([a-z0-9]+)\/?$/i;

function musicLinkSource(query) {
    if (/^spotify:/i.test(query)) return 'Spotify';
    let url;
    try { url = new URL(query); } catch { return null; }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    if (SPOTIFY_HOSTS.has(url.hostname)) return 'Spotify';
    if (url.hostname === 'deezer.com' || url.hostname.endsWith('.deezer.com') || url.hostname === 'deezer.page.link') return 'Deezer';
    if (url.hostname === 'soundcloud.com' || url.hostname.endsWith('.soundcloud.com') || url.hostname === 'snd.sc') return 'SoundCloud';
    return null;
}

async function normalizeSpotifyLink(query, fetcher = fetch) {
    const input = query.trim().replace(/^<(.+)>$/, '$1');
    const uri = /^spotify:(?:user:[^:]+:)?(track|playlist|album|artist):([a-z0-9]+)$/i.exec(input);
    if (uri) return `https://open.spotify.com/${uri[1].toLowerCase()}/${uri[2]}`;
    let url;
    try { url = new URL(input); } catch { throw new Error('Invalid Spotify link format'); }
    for (let redirects = 0; redirects <= 5; redirects++) {
        if (!SPOTIFY_HOSTS.has(url.hostname) || url.username || url.password ||
            !['http:', 'https:'].includes(url.protocol)) {
            throw new Error('Unsupported Spotify redirect');
        }
        if (url.hostname === 'open.spotify.com') {
            const match = TRACK_PATH.exec(url.pathname);
            if (!match) throw new Error('Unsupported Spotify link format');
            // Remove locale paths and tracking parameters before either loader.
            return `https://open.spotify.com/${match[1].toLowerCase()}/${match[2]}`;
        }
        if (redirects === 5) break;
        url.protocol = 'https:';
        const response = await fetcher(url.toString(), {
            method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(5000),
        });
        const location = response.headers.get('location');
        if (response.status < 300 || response.status >= 400 || !location) break;
        url = new URL(location, url);
    }
    throw new Error('Could not resolve Spotify short link');
}

// Kazagumo 3 validates plugins by this exact constructor name, not instanceof.
class KazagumoPlugin extends SpotifyPlugin {
    async search(query, options) {
        const input = typeof query === 'string' ? query.trim().replace(/^<(.+)>$/, '$1') : query;
        if (typeof input !== 'string' || musicLinkSource(input) !== 'Spotify') {
            return super.search(query, options);
        }
        const canonical = await normalizeSpotifyLink(input);
        // The plugin catches Spotify API/schema failures and returns no tracks.
        // Its saved native search bypasses that interceptor and uses Lavalink's
        // Spotify source, preserving encoded tracks and playlist metadata.
        try {
            const result = await this._search(canonical, options);
            if (result?.tracks?.length) return result;
        } catch {
            // Keep the existing API loader for nodes without Spotify support.
        }
        const fallback = await super.search(canonical, options);
        if (fallback?.tracks?.length) return fallback;
        const error = new Error('Spotify loaders could not return playable tracks');
        error.code = 'SPOTIFY_LOAD_FAILED';
        throw error;
    }
}

module.exports = KazagumoPlugin;
module.exports.musicLinkSource = musicLinkSource;
module.exports.normalizeSpotifyLink = normalizeSpotifyLink;
