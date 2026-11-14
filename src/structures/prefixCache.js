const TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const pending = new Map();

async function getPrefix(client, guildId) {
    const cached = cache.get(guildId);
    if (cached && cached.expires > Date.now()) return cached.prefix;
    const inFlight = pending.get(guildId);
    if (inFlight) return inFlight;

    let request;
    request = client.data.get(`${guildId}-prefix`).then(value => {
        const prefix = value || client.config.prefix;
        if (pending.get(guildId) === request) cache.set(guildId, { prefix, expires: Date.now() + TTL_MS });
        return prefix;
    }).finally(() => {
        if (pending.get(guildId) === request) pending.delete(guildId);
    });
    pending.set(guildId, request);
    return request;
}

function invalidatePrefixCache(guildId) {
    cache.delete(guildId);
    pending.delete(guildId);
}

module.exports = { getPrefix, invalidatePrefixCache, TTL_MS };
