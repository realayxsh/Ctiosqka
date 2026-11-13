const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { invalidateServerBrandCache } = require("../../structures/serverBrand");
const https = require('https');
const http = require('http');

function isImageUrl(str) {
    try {
        const url = new URL(str);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
        return /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(str)
            || str.includes('cdn.discordapp.com')
            || str.includes('i.imgur.com')
            || str.includes('media.discordapp.net')
            || str.includes('images-ext-');
    } catch { return false; }
}

// Download an image URL and return a base64 data URI for Discord's guild avatar API
function urlToBase64(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: 10000 }, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                if (buffer.length > 10 * 1024 * 1024) return reject(new Error('Image too large (max 10MB)'));
                const contentType = res.headers['content-type']?.split(';')[0] || 'image/png';
                resolve(`data:${contentType};base64,${buffer.toString('base64')}`);
            });
            res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    });
}

class Customize extends AvonCommand {
    get name() { return 'customize'; }
    get aliases() { return ['customise', 'setbot', 'botbrand', 'serverbrand']; }
    get cat() { return 'set'; }
    get premium() { return true; }

    async run(client, message, args, prefix) {
        try {
            const em = client.emoji;

            if (!message.member.permissions.has(8n) && !client.config.owners.includes(message.author.id)) {
                return message.channel.send({
                    flags: [MessageFlags.IsComponentsV2],
                    components: [new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${em.cross} | Only server administrators can customize the bot's appearance.`)
                    )]
                });
            }

            const send = (text, thumb) => {
                const container = new ContainerBuilder();
                if (thumb) {
                    container.addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb))
                    );
                } else {
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
                }
                return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
            };

            const dbKey = `server_brand_${message.guild.id}`;
            const sub = (args[0] || '').toLowerCase();

            // ── View current server branding ──
            if (!sub || sub === 'view' || sub === 'show') {
                const data = await client.data4.get(dbKey) || {};
                const icon   = data.icon   || null;
                const banner = data.banner || null;

                const text =
                    `**${client.emoji.customize || client.emoji.settings} | Bot Appearance — ${message.guild.name}**\n\n` +
                    `${em.customize_icon} **Icon:** ${icon   ? `[View](${icon})`   : '`Not set — using default bot avatar`'}\n` +
                    `${em.customize_banner} **Banner:** ${banner ? `[View](${banner})` : '`Not set`'}\n\n` +
                    `**How to customize:**\n` +
                    `${em.customize_icon} \`${prefix}customize icon <url>\` — Set a custom server icon\n` +
                    `${em.customize_banner} \`${prefix}customize banner <url>\` — Set a custom banner\n` +
                    `${em.customize_view} \`${prefix}customize\` — View this panel\n` +
                    `${em.customize_reset} \`${prefix}customize reset icon\` — Remove icon\n` +
                    `${em.customize_reset} \`${prefix}customize reset banner\` — Remove banner\n` +
                    `${em.customize_reset} \`${prefix}customize reset\` — Remove everything\n\n` +
                    `-# Changes apply to the bot's in-server profile for **this server only**. ${em.premium} Premium`;

                const components = [
                    new ContainerBuilder()
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                                .setThumbnailAccessory(new ThumbnailBuilder().setURL(icon || client.user.displayAvatarURL({ dynamic: true })))
                        )
                ];

                return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components });
            }

            // ── Set icon ──
            if (sub === 'icon') {
                const url = args[1];
                if (!url) return send(
                    `${em.cross} | Please provide an image URL.\n` +
                    `${em.customize_icon} Usage: \`${prefix}customize icon <url>\``
                );
                if (!isImageUrl(url)) return send(
                    `${em.cross} | That doesn't look like a valid image URL.\n` +
                    `Make sure it ends in \`.png\`, \`.jpg\`, \`.gif\`, or \`.webp\`, or use a Discord/Imgur CDN link.`
                );

                // Show working indicator
                const working = await message.channel.send({
                    flags: [MessageFlags.IsComponentsV2],
                    components: [new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${em.customize_icon} Applying custom icon to this server's bot profile...`)
                    )]
                });

                let applyError = null;
                try {
                    const base64 = await urlToBase64(url);
                    await client.rest.patch(`/guilds/${message.guild.id}/members/@me`, {
                        body: { avatar: base64 }
                    });
                } catch (e) {
                    applyError = e.rawError?.message || e.message || 'Unknown error';
                    console.error('[Customize] icon error:', e);
                }

                // Save to DB regardless (used in embeds as fallback)
                const data = await client.data4.get(dbKey) || {};
                data.icon = url;
                await client.data4.set(dbKey, data);
                invalidateServerBrandCache(message.guild.id);

                const resultText = applyError
                    ? `**${client.emoji.customize_icon || client.emoji.settings} | Bot Icon — Partial Update**\n\n` +
                      `${em.customize_icon} | Icon URL saved for **${message.guild.name}**.\n` +
                      `${em.cross} | Could not apply to bot's server profile: \`${applyError}\`\n\n` +
                      `-# The icon will still appear in bot embeds on this server.`
                    : `**${client.emoji.customize_icon || client.emoji.settings} | Bot Icon Updated**\n\n` +
                      `${em.customize_icon} | Custom icon applied to the bot's profile in **${message.guild.name}**!\n\n` +
                      `Click the bot in the member list to see it.\n\n` +
                      `-# ${em.customize_reset} Use \`${prefix}customize reset icon\` to remove it.`;

                return working.edit({
                    flags: [MessageFlags.IsComponentsV2],
                    components: [
                        new ContainerBuilder()
                            .addSectionComponents(
                                new SectionBuilder()
                                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(resultText))
                                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(url))
                            )
                    ]
                });
            }

            // ── Set banner ──
            if (sub === 'banner') {
                const url = args[1];
                if (!url) return send(
                    `${em.cross} | Please provide an image URL.\n` +
                    `${em.customize_banner} Usage: \`${prefix}customize banner <url>\``
                );
                if (!isImageUrl(url)) return send(
                    `${em.cross} | That doesn't look like a valid image URL.\n` +
                    `Make sure it ends in \`.png\`, \`.jpg\`, \`.gif\`, or \`.webp\`, or use a Discord/Imgur CDN link.`
                );

                const working = await message.channel.send({
                    flags: [MessageFlags.IsComponentsV2],
                    components: [new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${em.customize_banner} Applying custom banner to this server's bot profile...`)
                    )]
                });

                let applyError = null;
                try {
                    const base64 = await urlToBase64(url);
                    await client.rest.patch(`/guilds/${message.guild.id}/members/@me`, {
                        body: { banner: base64 }
                    });
                } catch (e) {
                    applyError = e.rawError?.message || e.message || 'Unknown error';
                    console.error('[Customize] banner error:', e.rawError || e);
                }

                const data = await client.data4.get(dbKey) || {};
                data.banner = url;
                await client.data4.set(dbKey, data);
                invalidateServerBrandCache(message.guild.id);

                const resultText = applyError
                    ? `**${client.emoji.customize_banner || client.emoji.settings} | Bot Banner — Failed**\n\n` +
                      `${em.cross} | Could not apply banner: \`${applyError}\`\n\n` +
                      `-# ${em.customize_reset} Use \`${prefix}customize reset banner\` to remove it.`
                    : `**${client.emoji.customize_banner || client.emoji.settings} | Bot Banner Updated**\n\n` +
                      `${em.customize_banner} | Custom banner applied to the bot's profile in **${message.guild.name}**!\n\n` +
                      `-# ${em.customize_reset} Use \`${prefix}customize reset banner\` to remove it.`;

                return working.edit({
                    flags: [MessageFlags.IsComponentsV2],
                    components: [
                        new ContainerBuilder()
                            .addSectionComponents(
                                new SectionBuilder()
                                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(resultText))
                                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ dynamic: true })))
                            )
                    ]
                });
            }

            // ── Reset ──
            if (sub === 'reset') {
                const target = (args[1] || '').toLowerCase();
                const data = await client.data4.get(dbKey) || {};

                if (target === 'icon') {
                    delete data.icon;
                    await client.data4.set(dbKey, data);
                    invalidateServerBrandCache(message.guild.id);
                    // Reset guild-specific avatar back to global
                    try { await client.rest.patch(`/guilds/${message.guild.id}/members/@me`, { body: { avatar: null } }); } catch {}
                    return send(`${em.customize_reset} | Custom icon removed. The bot's default global avatar is restored in this server.`);
                }

                if (target === 'banner') {
                    delete data.banner;
                    await client.data4.set(dbKey, data);
                    invalidateServerBrandCache(message.guild.id);
                    // Reset guild-specific banner
                    try {
                        await client.rest.patch(`/guilds/${message.guild.id}/members/@me`, { body: { banner: null } });
                    } catch {}
                    return send(`${em.customize_reset} | Custom banner removed.`);
                }

                // Reset everything
                await client.data4.delete(dbKey);
                invalidateServerBrandCache(message.guild.id);
                try { await client.rest.patch(`/guilds/${message.guild.id}/members/@me`, { body: { avatar: null, banner: null } }); } catch {}
                return send(`${em.customize_reset} | All bot customizations for **${message.guild.name}** have been reset.`);
            }

            // ── Unknown subcommand ──
            return send(
                `**${client.emoji.customize || client.emoji.settings} | Customize Bot Appearance**\n\n` +
                `${em.cross} | Unknown option \`${sub}\`.\n\n` +
                `**Available options:**\n` +
                `${em.customize_view} \`${prefix}customize\` — View current server customization\n` +
                `${em.customize_icon} \`${prefix}customize icon <url>\` — Set a custom bot icon\n` +
                `${em.customize_banner} \`${prefix}customize banner <url>\` — Set a custom banner\n` +
                `${em.customize_reset} \`${prefix}customize reset [icon|banner]\` — Remove customization\n\n` +
                `-# ${em.premium} This is a **Premium** feature for server admins.`
            );

        } catch (e) { console.error(e); }
    }
}
module.exports = Customize;
