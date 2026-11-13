const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

async function fetchLyrics(artist, title) {
    const clean = (s) => s
        .replace(/\(.*?(official|video|audio|lyrics|hd|4k|mv|ft\.?|feat\.?).*?\)/gi, '')
        .replace(/\[.*?(official|video|audio|lyrics|hd|4k|mv|ft\.?|feat\.?).*?\]/gi, '')
        .trim();

    title  = clean(title);
    artist = clean(artist);

    // 1) lrclib.net — most reliable, no key required
    try {
        const params = new URLSearchParams({ track_name: title, artist_name: artist });
        const res = await fetch(`https://lrclib.net/api/search?${params}`, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
            const data = await res.json();
            const hit = data.find(x => x.plainLyrics && x.plainLyrics.trim().length > 20);
            if (hit) return hit.plainLyrics.trim();
        }
        // title-only fallback
        const params2 = new URLSearchParams({ track_name: title });
        const res2 = await fetch(`https://lrclib.net/api/search?${params2}`, { signal: AbortSignal.timeout(6000) });
        if (res2.ok) {
            const data2 = await res2.json();
            const hit2 = data2.find(x => x.plainLyrics && x.plainLyrics.trim().length > 20);
            if (hit2) return hit2.plainLyrics.trim();
        }
    } catch (e) {}

    // 2) some-random-api — fast fallback
    try {
        const q = artist ? `${artist} ${title}` : title;
        const r = await fetch(`https://some-random-api.com/lyrics?title=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(6000) });
        if (r.ok) {
            const d = await r.json();
            if (d.lyrics && d.lyrics.trim().length > 20) return d.lyrics.trim();
        }
    } catch (e) {}

    // 3) lyrics.ovh — last resort
    try {
        const urls = artist
            ? [`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
               `https://api.lyrics.ovh/v1/_/${encodeURIComponent(title)}`]
            : [`https://api.lyrics.ovh/v1/_/${encodeURIComponent(title)}`];
        for (const url of urls) {
            const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (r.ok) {
                const d = await r.json();
                if (d.lyrics && d.lyrics.trim().length > 20) return d.lyrics.trim();
            }
        }
    } catch (e) {}

    return null;
}

class Lyrics extends AvonCommand {
    get name()      { return 'lyrics'; }
    get aliases()   { return ['ly', 'lyric']; }
    get cat()       { return 'music'; }
    get vote()      { return true; }
    get player()    { return true; }
    get inVoice()   { return false; }
    get sameVoice() { return false; }

    async run(client, message, args, prefix, player) {
        const track  = player.queue.current;
        const query  = args.length ? args.join(' ') : null;

        let artist = track.author || '';
        let title  = track.title  || '';

        if (query) {
            const split = query.split(' - ');
            if (split.length >= 2) {
                artist = split[0].trim();
                title  = split.slice(1).join(' - ').trim();
            } else {
                artist = '';
                title  = query.trim();
            }
        }

        const loadMsg = await message.channel.send({
            flags: [MessageFlags.IsComponentsV2],
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.music} Searching lyrics for **${title}**...`)
            )]
        });

        try {
            const lyrics = await fetchLyrics(artist, title);

            if (!lyrics) {
                return loadMsg.edit({
                    flags: [MessageFlags.IsComponentsV2],
                    components: [new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${client.emoji.cross} No lyrics found for **${title}**.\nTry: \`${prefix}lyrics Artist - Song Name\``
                        )
                    )]
                });
            }

            // Paginate at 1800 chars on newline boundary
            const CHUNK = 1800;
            const pages = [];
            let remaining = lyrics;
            while (remaining.length > 0) {
                if (remaining.length <= CHUNK) { pages.push(remaining); break; }
                let cut = remaining.lastIndexOf('\n', CHUNK);
                if (cut <= 0) cut = CHUNK;
                pages.push(remaining.slice(0, cut));
                remaining = remaining.slice(cut).trimStart();
            }

            let page = 0;
            const thumb = track.thumbnail || client.user.displayAvatarURL({ dynamic: true });

            const buildPage = (p) => {
                const c = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`**Lyrics — ${client.emoji.music} ${track.title}**\nby **${track.author}**`)
                            )
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb))
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(pages[p]));
                if (pages.length > 1) {
                    c.addSeparatorComponents(new SeparatorBuilder().setDivider(false))
                     .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Page ${p + 1} of ${pages.length}`));
                }
                return c;
            };

            const buildRow = (p) => {
                if (pages.length <= 1) return null;
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(`lyr_prev`).setLabel(`Previous`).setDisabled(p === 0),
                    new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(`lyr_next`).setLabel(`Next`).setDisabled(p === pages.length - 1)
                );
            };

            const getComponents = (p) => { const r = buildRow(p); return r ? [buildPage(p), r] : [buildPage(p)]; };

            await loadMsg.edit({ flags: [MessageFlags.IsComponentsV2], components: getComponents(page) });
            if (pages.length <= 1) return;

            const collector = loadMsg.createMessageComponentCollector({
                filter: b => {
                    if (b.user.id === message.author.id) return true;
                    b.reply({ content: `${client.emoji.cross} This is not your session.`, ephemeral: true });
                    return false;
                },
                time: 120000
            });

            collector.on('collect', async b => {
                if (!b.isButton()) return;
                await b.deferUpdate().catch(() => {});
                if (b.customId === 'lyr_next' && page < pages.length - 1) page++;
                else if (b.customId === 'lyr_prev' && page > 0) page--;
                await loadMsg.edit({ flags: [MessageFlags.IsComponentsV2], components: getComponents(page) }).catch(() => {});
            });

            collector.on('end', async () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(`lyr_prev`).setLabel(`Previous`).setDisabled(true),
                    new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(`lyr_next`).setLabel(`Next`).setDisabled(true)
                );
                await loadMsg.edit({ flags: [MessageFlags.IsComponentsV2], components: [buildPage(page), disabledRow] }).catch(() => {});
            });

        } catch (e) {
            console.error('[Lyrics]', e);
            loadMsg.edit({
                flags: [MessageFlags.IsComponentsV2],
                components: [new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${client.emoji.cross} Failed to fetch lyrics. Try again later.`)
                )]
            }).catch(() => {});
        }
    }
}

module.exports = Lyrics;
