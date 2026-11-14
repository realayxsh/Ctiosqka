const { EmbedBuilder } = require('discord.js');

const MAX_TIMER_MS = 2_147_000_000;
const timers = new Map();
const scopeLocks = new Map();
const startupRetryTimers = new Map();

function scopeDbKey(client, scope) {
    return scope.type === 'global'
        ? `noprefix_${client.user.id}`
        : `noprefix_${scope.guildId}`;
}

function scopeCacheKey(client, scope) {
    return scope.type === 'global'
        ? `global_${client.user.id}`
        : `guild_${scope.guildId}`;
}

function ownsScope(client, scope) {
    if (!client.cluster) return true;
    if (scope.type === 'global') return client.cluster.id === 0;
    return client.guilds.cache.has(scope.guildId);
}

function userIdOf(entry) {
    return typeof entry === 'string' ? entry : entry?.id || entry?.userId;
}

function isTimedEntry(entry) {
    return entry && typeof entry === 'object' && Number.isFinite(entry.expiresAt);
}

function isExpiredEntry(entry, now = Date.now()) {
    return isTimedEntry(entry) && entry.expiresAt <= now;
}

function expiryEmbed(client, scope, entry) {
    const global = scope.type === 'global';
    const scopeName = global ? 'All servers' : (scope.guildName || 'This server');
    return new EmbedBuilder()
        .setColor(0xF0A332)
        .setAuthor({
            name: `${client.user.username} • Access update`,
            iconURL: client.user.displayAvatarURL(),
        })
        .setTitle('No-Prefix Access Expired')
        .setDescription(
            `Your no-prefix grant for **${scopeName}** has expired. Any separate active grant remains unaffected.\n\n` +
            `You can still use commands with the server's prefix or slash commands.`
        )
        .addFields({
            name: 'Expired',
            value: `<t:${Math.floor(entry.expiresAt / 1000)}:F>`,
            inline: true,
        })
        .setFooter({ text: 'Radio Music • Access notice' })
        .setTimestamp();
}

function invalidateCache(client, scope) {
    try {
        require('./CommandHandler').invalidateNoprefixCache(scopeCacheKey(client, scope));
    } catch {
        // The command handler may not have loaded yet during startup.
    }
}

async function withScopeLock(client, scope, task) {
    const key = `${client.cluster?.id ?? 0}:${scopeDbKey(client, scope)}`;
    const previous = scopeLocks.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    scopeLocks.set(key, current);
    try {
        return await current;
    } finally {
        if (scopeLocks.get(key) === current) scopeLocks.delete(key);
    }
}

async function reconcileNoPrefixScope(client, scope) {
    if (!ownsScope(client, scope)) {
        const stored = await client.data2.get(scopeDbKey(client, scope));
        return Array.isArray(stored) ? stored : [];
    }

    return withScopeLock(client, scope, async () => {
        const key = scopeDbKey(client, scope);
        const stored = await client.data2.get(key);
        let entries = Array.isArray(stored) ? stored : [];
        const expired = entries.filter(entry => isExpiredEntry(entry));

        for (const entry of expired) {
            const index = entries.findIndex(candidate =>
                userIdOf(candidate) === userIdOf(entry) &&
                candidate?.expiresAt === entry.expiresAt
            );
            if (index < 0) continue;
            const current = entries[index];

            if (!current.expiryNoticeAttemptedAt) {
                entries[index] = { ...current, expiryNoticeAttemptedAt: Date.now() };
                await client.data2.set(key, entries);
                try {
                    const user = await client.users.fetch(userIdOf(current));
                    await user.send({
                        embeds: [expiryEmbed(client, scope, current)],
                        allowedMentions: { parse: [] },
                    });
                } catch {
                    console.warn('[No-Prefix Expiry] Could not deliver an expiration DM.');
                }
            }

            entries = entries.filter(candidate =>
                !(userIdOf(candidate) === userIdOf(current) &&
                    candidate?.expiresAt === current.expiresAt &&
                    isTimedEntry(candidate))
            );
            await client.data2.set(key, entries);
        }

        invalidateCache(client, scope);
        const active = entries.filter(entry => userIdOf(entry) &&
            (!isTimedEntry(entry) || entry.expiresAt > Date.now()));
        for (const entry of active) scheduleNoPrefixExpiry(client, scope, entry);
        return active;
    });
}

function scheduleNoPrefixExpiry(client, scope, entry) {
    if (!ownsScope(client, scope) || !isTimedEntry(entry)) return false;
    const key = `${client.cluster?.id ?? 0}:${scopeDbKey(client, scope)}:${userIdOf(entry)}:${entry.expiresAt}`;
    clearTimeout(timers.get(key));
    if (entry.expiresAt <= Date.now()) {
        const timer = setTimeout(() => {
            timers.delete(key);
            reconcileNoPrefixScope(client, scope).catch(() => {
                scheduleNoPrefixExpiry(client, scope, { ...entry, expiresAt: Date.now() + 60_000 });
            });
        }, 0);
        timer.unref?.();
        timers.set(key, timer);
        return true;
    }

    const timer = setTimeout(() => {
        timers.delete(key);
        if (entry.expiresAt > Date.now()) {
            scheduleNoPrefixExpiry(client, scope, entry);
            return;
        }
        reconcileNoPrefixScope(client, scope).catch(() => {
            scheduleNoPrefixExpiry(client, scope, { ...entry, expiresAt: Date.now() + 60_000 });
        });
    }, Math.min(entry.expiresAt - Date.now(), MAX_TIMER_MS));
    timer.unref?.();
    timers.set(key, timer);
    return true;
}

function cancelNoPrefixExpiry(client, scope, entry) {
    if (!isTimedEntry(entry)) return;
    const key = `${client.cluster?.id ?? 0}:${scopeDbKey(client, scope)}:${userIdOf(entry)}:${entry.expiresAt}`;
    clearTimeout(timers.get(key));
    timers.delete(key);
}

async function distributeNoPrefixExpirySchedule(client, scope, entry) {
    if (!isTimedEntry(entry)) return;
    if (!client.cluster?.broadcastEval) {
        scheduleNoPrefixExpiry(client, scope, entry);
        return;
    }
    try {
        await client.cluster.broadcastEval((bot, context) => {
            bot.emit('noprefixExpirySchedule', context.scope, context.entry);
            return true;
        }, { context: { scope, entry } });
    } catch {
        scheduleNoPrefixExpiry(client, scope, entry);
    }
}

async function distributeNoPrefixExpiryCancel(client, scope, entry) {
    if (!isTimedEntry(entry)) return;
    if (!client.cluster?.broadcastEval) {
        cancelNoPrefixExpiry(client, scope, entry);
        return;
    }
    try {
        await client.cluster.broadcastEval((bot, context) => {
            bot.emit('noprefixExpiryCancel', context.scope, context.entry);
            return true;
        }, { context: { scope, entry } });
    } catch {
        cancelNoPrefixExpiry(client, scope, entry);
    }
}

async function syncNoPrefixExpirations(client) {
    const scopes = [];
    if (!client.cluster || client.cluster.id === 0) scopes.push({ type: 'global' });
    for (const guild of client.guilds.cache.values()) {
        scopes.push({ type: 'guild', guildId: guild.id, guildName: guild.name });
    }
    let failures = false;
    for (let i = 0; i < scopes.length; i += 10) {
        const results = await Promise.allSettled(
            scopes.slice(i, i + 10).map(scope => reconcileNoPrefixScope(client, scope))
        );
        if (results.some(result => result.status === 'rejected')) failures = true;
    }
    if (failures) {
        const retryKey = `${client.cluster?.id ?? 0}`;
        if (!startupRetryTimers.has(retryKey)) {
            const retry = setTimeout(() => {
                startupRetryTimers.delete(retryKey);
                syncNoPrefixExpirations(client).catch(() => {});
            }, 60_000);
            retry.unref?.();
            startupRetryTimers.set(retryKey, retry);
        }
    } else {
        const retryKey = `${client.cluster?.id ?? 0}`;
        clearTimeout(startupRetryTimers.get(retryKey));
        startupRetryTimers.delete(retryKey);
    }
}

module.exports = {
    reconcileNoPrefixScope,
    scheduleNoPrefixExpiry,
    cancelNoPrefixExpiry,
    distributeNoPrefixExpirySchedule,
    distributeNoPrefixExpiryCancel,
    syncNoPrefixExpirations,
    expiryEmbed,
    isExpiredEntry,
};
