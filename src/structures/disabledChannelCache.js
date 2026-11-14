const TTL_MS = 30_000;
const states = new WeakMap();

function stateFor(client) {
    let state = states.get(client);
    if (!state) {
        state = { cache: new Map(), pending: new Map() };
        states.set(client, state);
    }
    return state;
}

function keyFor(guildId, channelId) {
    return `${guildId}:${channelId}`;
}

async function isChannelDisabled(client, guildId, channelId) {
    const { cache, pending } = stateFor(client);
    const key = keyFor(guildId, channelId);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value === 'disabled';

    const inFlight = pending.get(key);
    if (inFlight) return inFlight;

    let request;
    request = client.data.get(`disabled_channel_${guildId}_${channelId}`).then(value => {
        if (pending.get(key) === request) cache.set(key, { value, expires: Date.now() + TTL_MS });
        return value === 'disabled';
    }).finally(() => {
        if (pending.get(key) === request) pending.delete(key);
    });
    pending.set(key, request);
    return request;
}

function invalidateDisabledChannel(client, guildId, channelId) {
    const { cache, pending } = stateFor(client);
    const key = keyFor(guildId, channelId);
    cache.delete(key);
    pending.delete(key);
}

module.exports = { isChannelDisabled, invalidateDisabledChannel, TTL_MS };
