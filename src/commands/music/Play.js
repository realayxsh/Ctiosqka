const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const ms = require("ms");
const AvonCommand = require(`../../structures/avonCommand`);
const { musicLinkSource } = require('../../audio/spotify');
const wh = require('../../structures/webhook');
const { registerPlaySearchSession } = require('../../structures/playSearchSessions');

class Play extends AvonCommand {
    get name() { return 'play' }
    get aliases() { return ['p'] }
    get cat() { return 'music' }
    get inVoice() { return true; }
    get sameVoice() { return true; }

    async run(client, message, args, prefix) {
        const avatar = message.author.displayAvatarURL({ dynamic: true });
        let cleanupSearchSession;

        const send = (text) => {
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar))
                );
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };

        const editMsg = (msg, text) => {
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar))
                );
            return msg.edit({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };

        try {
            if (!args[0]) {
                return send(`**${client.emoji.info} | Command Usage**\n\`\`\`js\n${prefix}play <songurl>\`\`\``);
            }

            const query = args.join(" ").trim().replace(/^<(.+)>$/, '$1');

            const searchingContainer = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${client.emoji.search || client.emoji.music} | Searching...**\n\nLooking up: \`${query}\``))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar))
                );
            let searchingMsg = await message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [searchingContainer] });

            const existingPlayer = client.poru.players.get(message.guild.id);
            // Keep the connection in flight without delaying the engine picker.
            // Capture failures immediately, including when the user never selects.
            const playerReady = Promise.resolve().then(() => existingPlayer || client.poru.createPlayer({
                    guildId: message.guild.id,
                    voiceId: message.member.voice.channel.id,
                    textId: message.channel.id,
                    deaf: true,
                    volume: 100,
                    shardId: message.guild.shardId
                })).then(player => ({ player }), error => ({ error }));
            const searchWithPlayer = async options => {
                // Kazagumo can search without an established Discord voice session.
                const search = () => existingPlayer
                    ? existingPlayer.search(query, options)
                    : client.poru.search(query, options);
                const [ready, firstResult] = await Promise.all([
                    playerReady,
                    search()
                ]);
                if (ready.error) throw ready.error;
                const player = ready.player;
                if (client.poru.players.get(message.guild.id) !== player) {
                    throw new Error('Player changed during search');
                }
                player.setTextChannel(message.channel.id);
                let result = firstResult;
                if (!result?.tracks?.length) {
                    // Search providers occasionally return an empty first response for a valid query.
                    await new Promise(resolve => setTimeout(resolve, 400));
                    result = await search();
                    if (client.poru.players.get(message.guild.id) !== player) {
                        throw new Error('Player changed during search');
                    }
                }
                return { player, result };
            };

            if (/^(https?:\/\/|spotify:)/i.test(query)) {
                const source = musicLinkSource(query);
                if (!source) {
                    return editMsg(searchingMsg, `**${client.emoji.cross} | Only Spotify, Deezer, and SoundCloud links are supported.**`);
                }

                try {
                    const { player, result } = await searchWithPlayer({ requester: message.author });
                    if (!result || !result.tracks.length) {
                        return editMsg(searchingMsg, `**${client.emoji.cross} | Could not load this ${source} link**\n\nNo playable tracks were returned. Check that it is public and accessible, or try another link.`);
                    }
                    if (result.type === `PLAYLIST`) {
                        for (let track of result.tracks) player.queue.add(track);
                        if (!player.playing && !player.paused) await player.play();
                        return editMsg(searchingMsg, `**${client.emoji.queue} | Added Playlist to Queue**\n\n${client.emoji.queue} **Added** \`${result.tracks.length}\` songs from ${client.emoji.music} *${result.playlistName}*\n${client.emoji.users} **Requester:** ${message.author}\n${client.emoji.time} **Duration:** \`${ms(result.tracks.reduce((a, v) => a + (v.length || 0), 0))}\``);
                    } else {
                        player.queue.add(result.tracks[0]);
                        if (!player.playing && !player.paused) await player.play();
                        return editMsg(searchingMsg, `**${client.emoji.queue} | Added Song to Queue**\n\n${client.emoji.queue} **Added** ${client.emoji.music} [${result.tracks[0].title}](${result.tracks[0].uri || client.config.server})\n${client.emoji.users} **Requester:** ${message.author}\n${client.emoji.time} **Duration:** ${ms(result.tracks[0].length)}`);
                    }
                } catch (e) {
                    wh.error(`${source} link loading failed`, e);
                    console.warn(`[Play] ${source} link loading failed`);
                    return editMsg(searchingMsg, `**${client.emoji.cross} | Could not load this ${source} link**\n\nThe music provider couldn't load its tracks right now. The link may be private or unavailable, or the provider may be having an issue. Please try again shortly.`);
                }
            }

            const selectorContainer = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`**${client.emoji.search || client.emoji.music} | Choose the search engine**\n\nSearching for: \`${query}\``)
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar))
                )
                .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(`Default`).setCustomId(`play_source_def`),
                        new ButtonBuilder().setStyle(ButtonStyle.Success).setEmoji(`<:spotify_avon:1065634374906814525>`).setCustomId(`play_source_spoti`),
                        new ButtonBuilder().setStyle(ButtonStyle.Danger).setCustomId(`play_source_deez`).setEmoji(`<:Deezer_avon:1065634451603861545>`),
                        new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(`play_source_sc`).setEmoji(`<:Soundcloud_avon:1065634569262473277>`)
                    )
                );

            cleanupSearchSession = registerPlaySearchSession(client, searchingMsg.id, message.author.id, async sourceId => {
                try {
                    const engines = {
                        def: { label: 'Default' },
                        spoti: { engine: 'spotify', label: 'Spotify' },
                        deez: { engine: 'deezer', label: 'Deezer' },
                        sc: { engine: 'soundcloud', label: 'SoundCloud' }
                    };
                    const selectedEngine = engines[sourceId];
                    if (!selectedEngine) {
                        return editMsg(searchingMsg, `**${client.emoji.cross} | Unknown search engine. Please run the command again.**`);
                    }
                    const { player, result } = await searchWithPlayer({
                        ...(selectedEngine.engine ? { engine: selectedEngine.engine } : {}),
                        requester: message.author
                    });

                    if (!result?.tracks?.length) {
                        return editMsg(searchingMsg, `**${client.emoji.cross} | No results found for \`${query}\` using ${selectedEngine.label}.**`);
                    }

                    if (result.type === `PLAYLIST`) {
                        for (const track of result.tracks) player.queue.add(track);
                        if (!player.playing && !player.paused) await player.play();
                        return editMsg(searchingMsg, `**${client.emoji.queue} | Added Playlist to Queue**\n\n${client.emoji.queue} **Added** \`${result.tracks.length}\` songs from ${client.emoji.music} *${result.playlistName}*\n${client.emoji.users} **Requester:** ${message.author}\n${client.emoji.time} **Duration:** \`${ms(result.tracks.reduce((total, track) => total + (track.length || 0), 0))}\``);
                    }

                    const track = result.tracks[0];
                    player.queue.add(track);
                    if (!player.playing && !player.paused) await player.play();
                    return editMsg(searchingMsg, `**${client.emoji.queue} | Added Song to Queue**\n\n${client.emoji.queue} **Added** ${client.emoji.music} [${track.title}](${track.uri || client.config.server})\n${client.emoji.users} **Requester:** ${message.author}\n${client.emoji.time} **Duration:** ${ms(track.length || 0)}`);
                } catch (error) {
                    console.error('[Play Search]', error);
                    return editMsg(searchingMsg, `**${client.emoji.cross} | Search failed for that engine. Please try another engine or query.**`).catch(() => {});
                }
            }, () => editMsg(searchingMsg, `**${client.emoji.warning} | Search selection timed out. Run the command again.**`).catch(() => {}));

            // Register the click handler before exposing the buttons to avoid an unacknowledged early click.
            await searchingMsg.edit({ flags: [MessageFlags.IsComponentsV2], components: [selectorContainer] });

        } catch (e) {
            cleanupSearchSession?.();
            console.error('[Play]', e);
            message.channel.send({ content: `${client.emoji.cross} | Something went wrong. Please try again.` }).catch(() => {});
        }
    }
}
module.exports = Play;
