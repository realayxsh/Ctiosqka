const { parsePremiumDuration } = require('./premiumDuration');

function entryUserId(entry) {
    return typeof entry === 'string' ? entry : entry?.id || entry?.userId || null;
}

function isEntryActive(entry, now = Date.now()) {
    if (typeof entry === 'string') return true;
    if (!entry || typeof entry !== 'object') return false;
    if (entry.expiresAt === null || entry.expiresAt === undefined) return true;
    return Number.isFinite(entry.expiresAt) && now < entry.expiresAt;
}

function activeEntries(entries, now = Date.now()) {
    return (Array.isArray(entries) ? entries : []).filter(entry => entryUserId(entry) && isEntryActive(entry, now));
}

function hasExpiredEntries(entries, now = Date.now()) {
    return (Array.isArray(entries) ? entries : []).some(entry =>
        entryUserId(entry) && !isEntryActive(entry, now)
    );
}

function entryExpiryText(entry) {
    if (typeof entry === 'string' || entry?.expiresAt == null) return 'Lifetime';
    if (!Number.isFinite(entry.expiresAt)) return 'Expired';
    return `<t:${Math.floor(entry.expiresAt / 1000)}:R>`;
}

function makeNoPrefixEntry(userId, durationText) {
    const duration = parsePremiumDuration(durationText);
    if (!duration) return null;
    return {
        id: userId,
        expiresAt: duration.milliseconds === null ? null : Date.now() + duration.milliseconds,
    };
}

async function getStoredNoPrefixEntries(client, key) {
    const prefix = `noprefix_`;
    const scopeId = key.startsWith(prefix) ? key.slice(prefix.length) : null;
    const scope = scopeId === client.user.id
        ? { type: 'global' }
        : {
            type: 'guild',
            guildId: scopeId,
            guildName: client.guilds?.cache?.get(scopeId)?.name,
        };
    return require('./noprefixExpiry').reconcileNoPrefixScope(client, scope);
}

module.exports = {
    entryUserId, isEntryActive, activeEntries, hasExpiredEntries,
    entryExpiryText, makeNoPrefixEntry, getStoredNoPrefixEntries,
};
