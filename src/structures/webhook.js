const { WebhookClient, EmbedBuilder } = require('discord.js');

const WEBHOOK_KEYS = Object.freeze({
    join: 'JOIN_LOG_WEBHOOK_URL',
    leave: 'LEAVE_LOG_WEBHOOK_URL',
    command: 'COMMAND_LOG_WEBHOOK_URL',
    music: 'MUSIC_LOG_WEBHOOK_URL',
    error: 'ERROR_LOG_WEBHOOK_URL',
    system: 'SYSTEM_LOG_WEBHOOK_URL',
});
const DISCORD_HOSTS = new Set(['discord.com', 'discordapp.com', 'canary.discord.com',
    'ptb.discord.com', 'canary.discordapp.com', 'ptb.discordapp.com']);

function validWebhookUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
            DISCORD_HOSTS.has(url.hostname) &&
            /^\/api(?:\/v\d+)?\/webhooks\/\d{17,20}\/[\w-]{30,}\/?$/.test(url.pathname);
    } catch { return false; }
}

function createWebhookLogger({ env = process.env, makeClient = url => new WebhookClient({ url }),
    output = console, maxPending = 100, settings = {} } = {}) {
    const routes = new Map();
    function redact(value) {
        let text = String(value);
        // Values stay inside the process and are never returned or printed.
        for (const [key, secret] of Object.entries(env)) {
            if (/token|secret|password|credential|api_?key|webhook|mongo|database_url/i.test(key) &&
                typeof secret === 'string' && secret.length >= 8) text = text.split(secret).join('[REDACTED]');
        }
        return text
            .replace(/https?:\/\/[^\s<>`"']*\/api(?:\/v\d+)?\/webhooks\/[^\s<>`"']+/gi, '[REDACTED_WEBHOOK]')
            .replace(/mongodb(?:\+srv)?:\/\/[^\s<>`"']+/gi, '[REDACTED_DATABASE_URL]')
            .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[REDACTED]@')
            .replace(/\b(authorization|token|password|secret|api_?key)\s*[:=]\s*["']?[^\s"',}\n]+/gi, '$1=[REDACTED]');
    }
    function clean(value) {
        if (typeof value === 'string') return redact(value);
        if (Array.isArray(value)) return value.map(clean);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
        return value;
    }
    function initWebhook() {
        let changed = false;
        for (const [category, defaultKey] of Object.entries(WEBHOOK_KEYS)) {
            const spec = settings.webhooks?.[category] ?? {};
            const key = spec.secret ?? defaultKey;
            const validKey = typeof key === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(key);
            const enabled = settings.enabled !== false && spec.enabled !== false;
            const validSettings = typeof spec === 'object' && !Array.isArray(spec) &&
                [undefined, true, false].includes(settings.enabled) && [undefined, true, false].includes(spec.enabled);
            const url = enabled && validKey && validSettings ? env[key]?.trim() || '' : '';
            const previous = routes.get(category);
            if (previous?.url === url && previous?.key === key && previous.enabled === enabled &&
                previous.validSettings === validSettings) continue;
            changed = true;
            previous?.client?.destroy?.();
            const route = { url, key, enabled, validSettings, client: null, pending: 0,
                status: url ? 'invalid' : 'missing', lastWarning: 0 };
            routes.set(category, route);
            if (!validKey || !validSettings) {
                route.status = 'invalid';
                output.warn(`[Webhooks] Invalid config.json logging setting for ${category}; use a boolean enabled flag and a secret name.`);
                continue;
            }
            if (!enabled) {
                route.status = 'disabled';
                output.log(`[Webhooks] ${category} logging disabled in config.json.`);
                continue;
            }
            if (!url) {
                output.warn(`[Webhooks] ${key} is not set; ${category} logs are disabled.`);
                continue;
            }
            if (!validWebhookUrl(url)) {
                output.warn(`[Webhooks] ${key} is invalid; use a Discord incoming webhook URL.`);
                continue;
            }
            try {
                route.client = makeClient(url);
                route.status = 'configured';
            } catch {
                output.warn(`[Webhooks] ${key} could not be initialized; check this secret.`);
            }
        }
        const status = Object.fromEntries([...routes].map(([category, route]) => [category, route.status]));
        if (changed) output.log(`[Webhooks] ${Object.values(status).filter(value => value === 'configured').length}/6 log destinations configured.`);
        return status;
    }
    function warning(category, route, detail) {
        if (!route.lastWarning || Date.now() - route.lastWarning > 60000) {
            output.warn(`[Webhooks] ${route.key}: ${detail}`);
            route.lastWarning = Date.now();
        }
    }
    async function send(embed, category = 'system') {
        if (!Object.hasOwn(WEBHOOK_KEYS, category)) throw new Error('Unknown webhook log category');
        const route = routes.get(category);
        if (!route?.client || route.status !== 'configured') return false;
        if (route.pending >= maxPending) {
            warning(category, route, 'delivery queue is full; a log was dropped.');
            return false;
        }
        route.pending++;
        try {
            const data = embed.toJSON ? embed.toJSON() : embed;
            await route.client.send({ embeds: [clean(data)], allowedMentions: { parse: [] } });
            return true;
        } catch (error) {
            const code = Number.isInteger(error?.code) ? error.code : 'delivery-error';
            if ([401, 403, 404].includes(error?.status) || [10015, 50027].includes(error?.code)) route.status = 'failed';
            warning(category, route, `delivery failed (${code}); check the webhook URL and permissions.`);
            return false;
        } finally {
            route.pending--;
        }
    }
    function info(title, description, color = 0x5865F2, category = 'system') {
        return send(new EmbedBuilder().setTitle(redact(title).slice(0, 256))
            .setDescription(redact(description).slice(0, 4096)).setColor(color).setTimestamp(), category);
    }
    function error(title, err) {
        // Never forward exception messages, request bodies, command arguments, or raw stacks.
        const name = /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(err?.name || '') ? err.name : 'Error';
        const code = Number.isInteger(err?.code) ? String(err.code) :
            /^[A-Z_]{2,40}$/.test(err?.code || '') ? err.code : 'not provided';
        return info(title, `**Type:** ${name}\n**Code:** ${code}\nDetails omitted to protect credentials and private content.`, 0xFF0000, 'error');
    }
    function command(name, { userId, guildId, channelId, source, owner = false }) {
        return send(new EmbedBuilder().setTitle('Command Invoked').setColor(0x5865F2).addFields(
            { name: 'Command', value: String(name).slice(0, 100), inline: true },
            { name: 'Source', value: String(source), inline: true },
            { name: 'Owner command', value: owner ? 'Yes' : 'No', inline: true },
            { name: 'User ID', value: String(userId || 'Unknown'), inline: true },
            { name: 'Server ID', value: String(guildId || 'Direct message'), inline: true },
            { name: 'Channel ID', value: String(channelId || 'Direct message'), inline: true },
        ).setFooter({ text: 'Invocation only; access checks still apply. Arguments and message contents are not recorded.' })
            .setTimestamp(), 'command');
    }
    function music(title, player) {
        return info(title, `**Server ID:** ${player?.guildId || 'Unknown'}\n**Text channel ID:** ${player?.textId || 'Unknown'}`, 0x5865F2, 'music');
    }
    return { initWebhook, send, info, error, command, music, redact,
        web: (category = 'system') => routes.get(category)?.client || null };
}

const logger = createWebhookLogger({ settings: require('../../config.json').logging || {} });
module.exports = { ...logger, WEBHOOK_KEYS, validWebhookUrl, createWebhookLogger };
