const fs = require('node:fs/promises');
const path = require('node:path');
const { EmbedBuilder } = require('discord.js');
const { isPremium } = require('./premiumAccess');
const { invalidateServerBrandCache } = require('./serverBrand');

const PREMIUM_NICKNAME = 'Radio Premium';
const BRAND_KEY_PREFIX = 'server_brand_';
const MAX_TIMER_MS = 2_147_000_000;
const timers = new Map();
const expiryNoticeLocks = new Map();
const logoPath = path.join(__dirname, '../assets/radio-premium.jpg');

function brandKey(guildId) {
    return `${BRAND_KEY_PREFIX}${guildId}`;
}

async function imageDataFromUrl(url) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' ||
        !['cdn.discordapp.com', 'media.discordapp.net'].includes(parsed.hostname)) {
        throw new Error('Saved guild avatar URL is not an allowed Discord CDN URL');
    }
    const response = await fetch(parsed, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Could not fetch the saved guild avatar (${response.status})`);
    const type = (response.headers.get('content-type') || '').split(';')[0];
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(type)) {
        throw new Error('Saved guild avatar is not a supported image');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error('Saved guild avatar size is invalid');
    return `data:${type};base64,${buffer.toString('base64')}`;
}

async function setGuildAvatar(client, guildId, avatarData) {
    return client.rest.patch(`/guilds/${guildId}/members/@me`, { body: { avatar: avatarData } });
}

async function applyPremiumBranding(client, guild) {
    const me = guild.members.me || await guild.members.fetchMe();
    const key = brandKey(guild.id);
    const data = await client.data4.get(key) || {};
    if (!data.premiumIdentity) {
        data.premiumIdentity = {
            nickname: me.nickname || null,
            avatarUrl: me.avatar ? me.avatarURL({ extension: 'png', size: 512 }) : null,
            icon: data.icon || null,
        };
        await client.data4.set(key, data);
    }

    const results = await Promise.allSettled([
        me.nickname === PREMIUM_NICKNAME ? Promise.resolve() : me.setNickname(PREMIUM_NICKNAME),
        me.avatar === data.premiumIdentity.appliedAvatarHash
            ? Promise.resolve()
            : fs.readFile(logoPath).then(buffer =>
                setGuildAvatar(client, guild.id, `data:image/jpeg;base64,${buffer.toString('base64')}`)
            ),
    ]);

    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
        console.warn(`[Premium Branding] Some profile updates failed in a server (code ${Number(failures[0].reason?.code) || 'unknown'}). Check Change Nickname permission and bot profile access.`);
    }

    try {
        const updated = await guild.members.fetchMe({ force: true });
        if (results[1].status === 'fulfilled' && updated.avatar) {
            data.premiumIdentity.appliedAvatarHash = updated.avatar;
        }
        if (updated.avatar) data.icon = updated.avatarURL({ extension: 'png', size: 512 });
        else if (data.premiumIdentity.icon) data.icon = data.premiumIdentity.icon;
        else delete data.icon;
        await client.data4.set(key, data);
        invalidateServerBrandCache(guild.id);
    } catch {
        // The nickname/avatar still apply if the follow-up profile refresh is unavailable.
    }
    return { nickname: results[0].status === 'fulfilled', avatar: results[1].status === 'fulfilled' };
}

async function restorePremiumBranding(client, guild) {
    if (!guild) return false;
    const key = brandKey(guild.id);
    const data = await client.data4.get(key) || {};
    const identity = data.premiumIdentity;
    if (!identity) return false;
    const me = guild.members.me || await guild.members.fetchMe();
    const results = await Promise.allSettled([
        me.setNickname(identity.nickname),
        Promise.resolve().then(async () => setGuildAvatar(
            client, guild.id, identity.avatarUrl ? await imageDataFromUrl(identity.avatarUrl) : null
        )),
    ]);
    if (results.some(result => result.status === 'rejected')) {
        console.warn('[Premium Branding] Could not fully restore the previous server profile; will retry on next startup.');
        return false;
    }

    if (identity.icon) data.icon = identity.icon;
    else delete data.icon;
    delete data.premiumIdentity;
    if (Object.keys(data).length) await client.data4.set(key, data);
    else await client.data4.delete(key);
    invalidateServerBrandCache(guild.id);
    return true;
}

function samePremiumPeriod(first, second) {
    return first?.expiresAt === second?.expiresAt &&
        first?.activatedAt === second?.activatedAt &&
        first?.activatedBy === second?.activatedBy;
}

function premiumExpiryEmbed(client, guild, role, expiresAt) {
    return new EmbedBuilder()
        .setColor(0xF0A332)
        .setAuthor({
            name: `${client.user.username} • Premium update`,
            iconURL: client.user.displayAvatarURL(),
        })
        .setTitle('Radio Premium Expired')
        .setDescription(
            `The Premium subscription for **${guild?.name || 'your server'}** has expired.\n\n` +
            `Premium-only features are no longer active for this server.`
        )
        .addFields(
            { name: 'Server', value: guild?.name || 'Unavailable', inline: true },
            { name: 'Your role', value: role, inline: true },
            { name: 'Expired', value: `<t:${Math.floor(expiresAt / 1000)}:F>`, inline: false },
            { name: 'Reactivate Premium', value: 'Redeem a new code in the server with `/redeem <code>` or your bot prefix command.' }
        )
        .setFooter({ text: 'Radio Music • Premium status' })
        .setTimestamp();
}

async function notifyPremiumExpiry(client, guild) {
    if (!guild) return false;
    const guildId = guild.id;
    const lockKey = `${client.cluster?.id ?? 0}:${guildId}`;
    if (expiryNoticeLocks.has(lockKey)) return expiryNoticeLocks.get(lockKey);

    const task = (async () => {
        const key = `premium_${guildId}`;
        let data = await client.data3.get(key);
        if (!Number.isFinite(data?.expiresAt) || data.active === false ||
            Date.now() < data.expiresAt || data.expiryNoticeCompletedAt) return false;

        let ownerId = guild.ownerId;
        if (!ownerId && typeof guild.fetchOwner === 'function') {
            ownerId = (await guild.fetchOwner().catch(() => null))?.id;
        }
        const recipients = new Map();
        if (ownerId) recipients.set(ownerId, 'Server owner');
        if (data.activatedBy) {
            recipients.set(data.activatedBy, recipients.has(data.activatedBy)
                ? 'Server owner and activating user'
                : 'User who activated Premium');
        }

        const latest = await client.data3.get(key);
        if (!samePremiumPeriod(latest, data) || latest.active === false ||
            !Number.isFinite(latest.expiresAt) || Date.now() < latest.expiresAt) return false;
        if (!Array.isArray(latest.expiryNoticeRecipients)) {
            latest.expiryNoticeRecipients = [...recipients].map(([id, role]) => ({ id, role }));
            latest.expiryNoticeAttemptedUserIds = [];
            latest.expiryNoticeStartedAt = Date.now();
            await client.data3.set(key, latest);
        }
        data = latest;

        for (const recipient of data.expiryNoticeRecipients) {
            const current = await client.data3.get(key);
            if (!samePremiumPeriod(current, data) || current?.active === false || !Number.isFinite(current?.expiresAt) ||
                Date.now() < current.expiresAt) return false;
            const attempted = current.expiryNoticeAttemptedUserIds || [];
            if (attempted.includes(recipient.id)) {
                data = current;
                continue;
            }
            current.expiryNoticeAttemptedUserIds = [...attempted, recipient.id];
            await client.data3.set(key, current);
            data = current;

            try {
                const user = await client.users.fetch(recipient.id);
                await user.send({
                    embeds: [premiumExpiryEmbed(client, guild, recipient.role, current.expiresAt)],
                    allowedMentions: { parse: [] },
                });
            } catch {
                console.warn('[Premium Expiry] Could not deliver an expiration DM.');
            }
        }

        const current = await client.data3.get(key);
        if (!samePremiumPeriod(current, data)) return false;
        current.expiryNoticeCompletedAt = Date.now();
        await client.data3.set(key, current);
        return true;
    })();

    expiryNoticeLocks.set(lockKey, task);
    try {
        return await task;
    } finally {
        if (expiryNoticeLocks.get(lockKey) === task) expiryNoticeLocks.delete(lockKey);
    }
}

function scheduleExpiry(client, guildId, expiresAt) {
    const key = `${client.cluster?.id ?? 0}:${guildId}`;
    clearTimeout(timers.get(key));
    if (!Number.isFinite(expiresAt)) return;
    const check = async () => {
        try {
            const current = await client.data3.get(`premium_${guildId}`);
            if (!current || current.active === false ||
                !Number.isFinite(current.expiresAt) || current.expiresAt === null) return;
            if (Date.now() < current.expiresAt) {
                scheduleExpiry(client, guildId, current.expiresAt);
                return;
            }
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                await notifyPremiumExpiry(client, guild);
                await restorePremiumBranding(client, guild);
            }
        } catch {
            scheduleExpiry(client, guildId, Date.now() + 60_000);
        }
    };
    const timer = setTimeout(check, Math.max(0, Math.min(expiresAt - Date.now(), MAX_TIMER_MS)));
    timer.unref?.();
    timers.set(key, timer);
}

async function syncPremiumBranding(client, guild) {
    const data = await client.data3.get(`premium_${guild.id}`);
    if (await isPremium(client, guild.id)) {
        await applyPremiumBranding(client, guild);
        if (Number.isFinite(data?.expiresAt)) scheduleExpiry(client, guild.id, data.expiresAt);
    } else {
        await notifyPremiumExpiry(client, guild);
        const previous = await client.data4.get(brandKey(guild.id));
        if (previous?.premiumIdentity) await restorePremiumBranding(client, guild);
    }
}

function cancelExpiry(client, guildId) {
    const key = `${client.cluster?.id ?? 0}:${guildId}`;
    clearTimeout(timers.get(key));
    timers.delete(key);
}

module.exports = {
    PREMIUM_NICKNAME, applyPremiumBranding, restorePremiumBranding,
    scheduleExpiry, syncPremiumBranding, cancelExpiry,
    notifyPremiumExpiry, premiumExpiryEmbed,
};
