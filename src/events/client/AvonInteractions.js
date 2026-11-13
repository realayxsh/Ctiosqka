const { executeSlash } = require('../../slash/execute');
const wh = require('../../structures/webhook');
const { isVotingEnabled } = require('../../structures/voting');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, MessageFlags } = require("discord.js");
const { buildPlaybackRows } = require('../../structures/playbackControls');
const ms = require('ms');
const AvonClientEvents = require(`../../structures/Eventhandler`);
const { Api } = require(`@top-gg/sdk`);
const config = require(`../../../config.json`);
const voteApi = new Api(process.env.topggapi || config.topggapi);

// ── Vote cache: TTL 5 minutes, gracefully handles missing/invalid API token ──
const _voteCache = new Map();
const VOTE_TTL = 5 * 60 * 1000;
async function hasVoted(userId, client) {
    if (!isVotingEnabled(client)) return true;
    const entry = _voteCache.get(userId);
    if (entry && Date.now() < entry.expires) return entry.voted;
    try {
        const voted = await voteApi.hasVoted(userId);
        _voteCache.set(userId, { voted, expires: Date.now() + VOTE_TTL });
        return voted;
    } catch (e) {
        return true; // API unavailable — don't block users
    }
}

const { isPremium } = require('../../structures/premiumAccess');

const { PRESETS, applyFilter, filterMessage, filterFailure } = require('../../audio/filters');

function buildNowPlayingComponents(client, player) {
    const track = player.queue.current;
    if (!track) return null;
    let url = track.uri || '';
    const duration = ms(track.length || 0);
    const requesterAvatar = track.requester?.displayAvatarURL?.({ dynamic: true }) || client.user.displayAvatarURL();
    const container = new ContainerBuilder()
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**${client.emoji.nowplaying || client.emoji.music} | Now Playing**\n\n**[${track.title}](${url})**\nby **${track.author}** — \`${duration}\`\n\n${client.emoji.users} **Requester:** ${track.requester}`
                ))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(requesterAvatar))
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
        .addActionRowComponents(...buildPlaybackRows(client, player));
    return { flags: [MessageFlags.IsComponentsV2], components: [container] };
}

const cv2 = (text, ephemeral = false) => ({
    flags: ephemeral ? [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] : [MessageFlags.IsComponentsV2],
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))]
});

class AvonInteractions extends AvonClientEvents{
    get name(){ return 'interactionCreate'; }
    async run(interaction){

        if(interaction.isButton()){
            try{
                let player = this.client.poru.players.get(interaction.guild.id);
                const control = { pl1: 'stop', pl2: 'pause/resume', pl3: 'loop', pl4: 'previous', pl5: 'skip', pl_lyrics: 'lyrics' }[interaction.customId];
                if (control) wh.command(control, { userId: interaction.user.id, guildId: interaction.guild.id,
                    channelId: interaction.channelId, source: 'playback button' });

                if(interaction.customId === `pl_lyrics`){
                    if(!player || !player.queue.current)
                        return interaction.reply(cv2(`${this.client.emoji.cross} | Nothing is playing right now.`, true));
                    const isOwner = this.client.config.owners.includes(interaction.user.id);
                    if(!isOwner){
                        const voted = await hasVoted(interaction.user.id, this.client);
                        if(!voted) return interaction.reply({
                            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
                            components: [
                                new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(
                                    `${this.client.emoji.tick} | **Vote Required** — [Click here](https://top.gg/bot/1097475016880304180/vote) to vote and unlock lyrics!`
                                )),
                                new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Vote on Top.gg`).setURL(`https://top.gg/bot/1097475016880304180/vote`))
                            ]
                        });
                    }
                    await interaction.deferReply({ ephemeral: true });
                    const track = player.queue.current;
                    let artist = track.author || '';
                    let title  = track.title  || '';
                    const clean = (s) => s
                        .replace(/\(.*?(official|video|audio|lyrics|hd|4k|mv|ft\.?|feat\.?).*?\)/gi, '')
                        .replace(/\[.*?(official|video|audio|lyrics|hd|4k|mv|ft\.?|feat\.?).*?\]/gi, '')
                        .trim();
                    title  = clean(title);
                    artist = clean(artist);
                    let lyrics = null;
                    try {
                        const params = new URLSearchParams({ track_name: title, artist_name: artist });
                        const res = await fetch(`https://lrclib.net/api/search?${params}`, { signal: AbortSignal.timeout(6000) });
                        if (res.ok) {
                            const data = await res.json();
                            const hit = data.find(x => x.plainLyrics && x.plainLyrics.trim().length > 20);
                            if (hit) lyrics = hit.plainLyrics.trim();
                        }
                        if (!lyrics) {
                            const params2 = new URLSearchParams({ track_name: title });
                            const res2 = await fetch(`https://lrclib.net/api/search?${params2}`, { signal: AbortSignal.timeout(6000) });
                            if (res2.ok) {
                                const data2 = await res2.json();
                                const hit2 = data2.find(x => x.plainLyrics && x.plainLyrics.trim().length > 20);
                                if (hit2) lyrics = hit2.plainLyrics.trim();
                            }
                        }
                    } catch(e) {}
                    if (!lyrics) {
                        return interaction.editReply(cv2(`${this.client.emoji.cross} | No lyrics found for **${track.title}**.\nTry \`+lyrics Artist - Song Name\` for manual search.`));
                    }
                    const preview = lyrics.length > 1800 ? lyrics.slice(0, 1800) + '\n...' : lyrics;
                    const thumb = track.thumbnail || this.client.user.displayAvatarURL({ dynamic: true });
                    return interaction.editReply({
                        flags: [MessageFlags.IsComponentsV2],
                        components: [new ContainerBuilder()
                            .addSectionComponents(
                                new SectionBuilder()
                                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Lyrics — ${track.title}**\nby **${track.author}**`))
                                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb))
                            )
                            .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(preview))
                        ]
                    });
                }

                if(interaction.customId === `pl1`){
                    if(interaction.message.id !== player.data.get('music').id) return interaction.message.delete();
                    if(!interaction.member.voice?.channelId || interaction.member.voice.channelId !== interaction.guild.members.me.voice?.channelId)
                        return interaction.reply(cv2(`${this.client.emoji.cross} | You cannot use this button until you connect to ${interaction.guild.members.me.voice.channel}`, true));
                    player.destroy(); return;
                }
                if(interaction.customId === `pl2`){
                    if(interaction.message.id !== player.data.get('music').id) return interaction.message.delete();
                    if(interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId)
                        return interaction.reply(cv2(`${this.client.emoji.cross} | You cannot use this button until you connect to ${interaction.guild.members.me.voice.channel}`, true));
                    player.pause(!player.paused);
                    const updatedPause = buildNowPlayingComponents(this.client, player);
                    if(updatedPause) return interaction.update(updatedPause);
                    return interaction.reply(cv2(`${this.client.emoji.tick} | ${player.paused ? 'Paused' : 'Resumed'}`, true));
                }
                if(interaction.customId === `pl3`){
                    if(interaction.message.id !== player.data.get('music').id) return interaction.message.delete();
                    if(interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId)
                        return interaction.reply(cv2(`${this.client.emoji.cross} | You cannot use this button until you connect to ${interaction.guild.members.me.voice.channel}`, true));
                    if(player.loop === `queue`){ player.setLoop(`none`); }
                    else { player.setLoop(`queue`); }
                    const updatedLoop = buildNowPlayingComponents(this.client, player);
                    if(updatedLoop) return interaction.update(updatedLoop);
                    return interaction.reply(cv2(player.loop !== 'none' ? `${this.client.emoji.tick} | **Loop enabled**` : `${this.client.emoji.cross} | **Loop disabled**`, true));
                }
                if(interaction.customId === `pl4`){
                    if(interaction.message.id !== player.data.get('music').id) return interaction.message.delete();
                    if(interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId)
                        return interaction.reply(cv2(`${this.client.emoji.cross} | You cannot use this button until you connect to ${interaction.guild.members.me.voice.channel}`, true));
                    if(!player.queue.previous || player.queue.previous === null)
                        return interaction.reply(cv2(`${this.client.emoji.cross} | No previous song available.`, true));
                    player.queue.unshift(player.queue.previous); player.skip();
                    return interaction.reply(cv2(`${this.client.emoji.previous || this.client.emoji.music} | Playing previous track`, true));
                }
                if(interaction.customId === `pl5`){
                    if(interaction.message.id !== player.data.get('music').id) return interaction.message.delete();
                    if(interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId)
                        return interaction.reply(cv2(`${this.client.emoji.cross} | You cannot use this button until you connect to ${interaction.guild.members.me.voice.channel}`, true));
                    player.skip();
                    return interaction.reply(cv2(`${this.client.emoji.tick} | **Skipped** the track`, true));
                }
            } catch(e){ wh.error('Playback button failed', e); console.log('[Interactions] Playback button failed'); }
        }

        if(interaction.isStringSelectMenu() && ['filter_select', 'np_filter'].includes(interaction.customId)){
            wh.command('filter', { userId: interaction.user.id, guildId: interaction.guild?.id,
                channelId: interaction.channelId, source: 'filter menu' });
            try {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const player = this.client.poru.players.get(interaction.guild.id);
                if(!player || !player.queue.current)
                    return interaction.editReply(cv2(`${this.client.emoji.cross} | Nothing is playing right now.`));
                const disabled = await this.client.data.get(`disabled_channel_${interaction.guild.id}_${interaction.channelId}`);
                if(disabled === 'disabled' && !this.client.config.owners.includes(interaction.user.id))
                    return interaction.editReply(cv2(`${this.client.emoji.cross} | Commands are disabled in this channel.`));
                if(!interaction.member.voice?.channelId || interaction.member.voice.channelId !== interaction.guild.members.me.voice?.channelId)
                    return interaction.editReply(cv2(`${this.client.emoji.cross} | You must be in the same voice channel as me.`));

                const selected = interaction.values[0] === 'clearfilters' ? 'none' : interaction.values[0];
                if(selected !== 'none' && !Object.hasOwn(PRESETS, selected))
                    return interaction.editReply(cv2(`${this.client.emoji.cross} | Unknown filter.`));

                if(!await isPremium(this.client, interaction.guild.id)){
                    return interaction.editReply(cv2(
                        `${this.client.emoji.premium} | **__Premium Required__**\n\n` +
                        `This filter requires Premium for this server.\n` +
                        `Activate your premium code with:\n**/redeem**\n\n` +
                        `Check your server's status with **/premium**.`
                    ));
                }

                const result = await applyFilter(player, selected, { toggle: true });
                return interaction.editReply(cv2(filterMessage(result, this.client.emoji)));
            } catch(error) {
                wh.error('Audio filter menu failed', error);
                console.warn('[Audio Filters] Dropdown change failed');
                const response = cv2(filterFailure(error, this.client.emoji));
                if(interaction.deferred || interaction.replied) {
                    await interaction.editReply(response).catch(() => {});
                } else {
                    await interaction.reply({ ...response, flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] }).catch(() => {});
                }
            }
        }

        if(interaction.isChatInputCommand()){
            return executeSlash(this.client, interaction, { hasVoted, isPremium });
        }

    }
}
module.exports = AvonInteractions;
