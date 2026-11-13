const { Collection, ButtonBuilder, ActionRowBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, PermissionsBitField, MessageFlags, EmbedBuilder } = require('discord.js');
const EventEmitter = require('events');
const { readdirSync } = require('fs');
const ascii = require(`ascii-table`);
const config = require(`../../config.json`);
const wh = require('./webhook');
const { isVotingEnabled } = require('./voting');
const { isOwner, runOwnerMessage } = require('./ownerMessages');
const table = new ascii().setHeading('Avon Commands', 'Status');
const top = require(`@top-gg/sdk`);
const voteApi = new top.Api(process.env.topggapi || config.topggapi);

// ── Prefix cache: TTL 5 minutes per guild ──
const _prefixCache = new Map();
const PREFIX_TTL = 5 * 60 * 1000;
function invalidatePrefixCache(guildId) { _prefixCache.delete(guildId); }

// ── Noprefix cache: TTL 2 minutes per guild / global key ──
const _noprefixCache = new Map();
const NOPREFIX_TTL = 2 * 60 * 1000;
function invalidateNoprefixCache(key) { _noprefixCache.delete(key); }

// ── Vote cache: TTL 5 minutes, gracefully handles missing/invalid API token ──
const _voteCache = new Map();
const VOTE_TTL = 5 * 60 * 1000;
async function hasVoted(userId, client) {
    if (!isVotingEnabled(client)) return true;
    const entry = _voteCache.get(userId);
    if (entry && Date.now() < entry.expires) return entry.voted;
    try {
        const voted = await voteApi.hasVoted(userId);
        // Cache positive votes for 5 minutes, negative for only 30 seconds
        // so users who just voted are unblocked quickly
        const ttl = voted ? VOTE_TTL : 30_000;
        _voteCache.set(userId, { voted, expires: Date.now() + ttl });
        return voted;
    } catch (e) {
        // API token not configured or rate-limited — do not block users
        return true;
    }
}

const { isPremium, invalidatePremCache } = require('./premiumAccess');

const cv2 = (text) => ({
    flags: [MessageFlags.IsComponentsV2],
    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))]
});

class AvonCommands extends EventEmitter {
    constructor(client){
        super();
        this.client = client;
        this.commands = new Collection();
        this.load = false;
        this.on("error", async (err) => { console.error(err) });
        this.client.on('messageCreate', (message) => this.run(message));
    }

    loadCommands(){
        if(this.load) return this;
        readdirSync(`./src/commands/`).forEach(d => {
            const commands = readdirSync(`./src/commands/${d}/`).filter(f => f.endsWith('.js'));
            for(const cmd of commands){
                const AvonCommand = require(`${process.cwd()}/src/commands/${d}/${cmd}`);
                const command = new AvonCommand(this.client);
                command.ownerOnly = d === 'owner';
                this.commands.set(command.name, command);
                table.addRow(command.name, '✅');
            }
        });
        console.log(table.toString());
        this.load = true;
        return this;
    }

    async run(message){
        if(message.author.bot || !message.content) return;
        if(await runOwnerMessage(this.client, message)) return;
        if(!message.guild || message.author.bot || message.attachments.size || message.stickers.size) return;
        let prefix;
        const _pce = _prefixCache.get(message.guild.id);
        if(_pce && Date.now() < _pce.expires){
            prefix = _pce.prefix;
        } else {
            const data = await this.client.data.get(`${message.guild.id}-prefix`);
            prefix = data || this.client.config.prefix;
            _prefixCache.set(message.guild.id, { prefix, expires: Date.now() + PREFIX_TTL });
        }

        if(message.content === `<@${this.client.user.id}>`){
            let b1 = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Invite`).setURL(`https://discord.com/api/oauth2/authorize?client_id=${this.client.user.id}&permissions=2184571968&scope=bot%20applications.commands`);
            let b2 = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Support`).setURL(this.client.config.server);
            let b3 = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Vote`).setURL(`https://top.gg/bot/1097475016880304180/vote`);
            let b4 = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Web`).setURL(`https://shorturl.at/egszS`);
            let ro = new ActionRowBuilder().addComponents(...(isVotingEnabled(this.client) ? [b1, b2, b3, b4] : [b1, b2, b4]));
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `**Hey I am ${this.client.user.username}**\n\n` +
                            `**__Settings For ${message.guild.name}__**\n` +
                            `Server ID: \`${message.guild.id}\`\n` +
                            `Voice Channel: ${message.guild.members.me.voice.channel ? message.guild.members.me.voice.channel : '`Null`'}\n` +
                            `Voice Channel ID: ${message.guild.members.me.voice.channel ? `\`${message.guild.members.me.voice.channelId}\`` : '`Null`'}\n` +
                            `My Prefix here: \`${prefix}\`\n\n` +
                            `Play music — \`${prefix}play\` or \`/play\` · Help — \`${prefix}help\` or \`/help\`\n` +
                            `${this.client.emoji.premium} Explore **Radio Premium** with \`${prefix}premium\` or \`/premium\`.\n\n` +
                            `**__Links__** — [Support](${this.client.config.server}) | [Invite](https://discord.com/api/oauth2/authorize?client_id=${this.client.user.id}&permissions=2184571968&scope=bot%20applications.commands)\n\n` +
                            `-# Developed By Radio Development`
                        ))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
                );
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container, ro] })
                .catch((e) => { message.author.send({ content: `Error while sending message there: ${e.message}` }).catch(() => {}) });
        }

        try{
            let np = ['688067325433610307', '763992862857494558', '282494845753491456',
                ...this.client.config.owners, ...(this.client.config.coowners || [])];
            let regex = RegExp(`^<@!?${this.client.user.id}>`);
            let pre = message.content.match(regex) ? message.content.match(regex)[0] : prefix;

            const _npGuildKey  = `guild_${message.guild.id}`;
            const _npGlobalKey = `global_${this.client.user.id}`;
            const _npGuildCached  = _noprefixCache.get(_npGuildKey);
            const _npGlobalCached = _noprefixCache.get(_npGlobalKey);
            const now = Date.now();

            const [db, db2] = await Promise.all([
                (_npGuildCached && now < _npGuildCached.expires)
                    ? Promise.resolve(_npGuildCached.list)
                    : this.client.data2.get(`noprefix_${message.guild.id}`).then(v => {
                        const list = v || [];
                        _noprefixCache.set(_npGuildKey, { list, expires: now + NOPREFIX_TTL });
                        return list;
                    }),
                (_npGlobalCached && now < _npGlobalCached.expires)
                    ? Promise.resolve(_npGlobalCached.list)
                    : this.client.data2.get(`noprefix_${this.client.user.id}`).then(v => {
                        const list = v || [];
                        _noprefixCache.set(_npGlobalKey, { list, expires: now + NOPREFIX_TTL });
                        return list;
                    })
            ]);

            db2.forEach(x => np.push(x));
            db.forEach(x => np.push(x));
            if(!np.includes(message.author.id)){ if(!message.content.startsWith(pre)) return; }
            const args = np.includes(message.author.id) == false
                ? message.content.slice(pre.length).trim().split(/ +/)
                : message.content.startsWith(pre) == true
                    ? message.content.slice(pre.length).trim().split(/ +/)
                    : message.content.trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const avonCommand = this.commands.get(commandName) || this.commands.find((c) => c.aliases && c.aliases.includes(commandName));
            if(!avonCommand) return;
            if(avonCommand.name === 'vote' && !isVotingEnabled(this.client))
                return message.channel.send(cv2('Voting is temporarily disabled.'));
            if(avonCommand.ownerOnly && !isOwner(this.client, message.author.id)) return;

            // ── Disabled channel check ──
            const disabledKey = `disabled_channel_${message.guild.id}_${message.channel.id}`;
            const channelDisabled = await this.client.data.get(disabledKey);
            if(channelDisabled === `disabled` && !this.client.config.owners.includes(message.author.id)) return;

            if(!message.guild.members.me.permissionsIn(message.channel).has(PermissionsBitField.Flags.ViewChannel)) return;
            if(!message.guild.members.me.permissionsIn(message.channel).has(PermissionsBitField.Flags.SendMessages)) return message.author.send({ content: `I don't have **Send Messages** permissions in that channel` }).catch(e => null);
            if(!message.guild.members.me.permissionsIn(message.channel).has(PermissionsBitField.Flags.ReadMessageHistory)) return message.channel.send({ content: `I don't have **Read Message History** permissions here` });
            if(!message.guild.members.me.permissionsIn(message.channel).has(PermissionsBitField.Flags.UseExternalEmojis)) return message.channel.send({ content: `I don't have **Use External Emojis** permissions here` });
            if(!message.guild.members.me.permissionsIn(message.channel).has(PermissionsBitField.Flags.EmbedLinks)) return message.channel.send({ content: `I don't have **Embed Links** permissions here` });

            wh.command(avonCommand.name, {
                userId: message.author.id, guildId: message.guild.id, channelId: message.channel.id,
                source: 'prefix or mention', owner: Boolean(avonCommand.ownerOnly),
            });

            let client = this.client;
            if(avonCommand.inVoice && !message.member?.voice?.channel)
                return message.channel.send(cv2(`${client.emoji.cross} | You must be connected to a voice channel.`));
            if(avonCommand.sameVoice){
                if(message.guild.members.me.voice.channelId !== message.member.voice.channelId && message.guild.members.me.voice.channel)
                    return message.channel.send(cv2(`${client.emoji.cross} | You must be connected to ${message.guild.members.me.voice.channel}`));
            }

            // ── Run vote + premium checks in parallel for speed ──
            const needsPremium = !!avonCommand.premium;
            const needsVote    = isVotingEnabled(client) && !needsPremium && !!avonCommand.vote && !client.config.owners.includes(message.author.id);

            const [voted, active] = await Promise.all([
                needsVote    ? hasVoted(message.author.id, client)    : Promise.resolve(true),
                needsPremium ? isPremium(client, message.guild.id)    : Promise.resolve(true),
            ]);

            if(needsVote && !voted){
                return message.channel.send({
                    flags: [MessageFlags.IsComponentsV2],
                    components: [
                        new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `${client.emoji.tick} | **[Vote](https://top.gg/bot/1097475016880304180/vote) Required** — Click [here](https://top.gg/bot/1097475016880304180/vote) to vote and unlock this command!`
                        )),
                        new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Vote on Top.gg`).setURL(`https://top.gg/bot/1097475016880304180/vote`))
                    ]
                });
            }

            if(needsPremium && !active){
                return message.channel.send({
                    flags: [MessageFlags.IsComponentsV2],
                    components: [new ContainerBuilder()
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                                    `${client.emoji.premium} | **__Premium Required__**\n\n` +
                                    `${client.emoji.cross} | This command is **Premium Only!**\n\n` +
                                    `Get a premium code from the bot owner and activate it with:\n**/redeem**\n` +
                                    `Or use **\`${prefix}redeem <code>\`**.\n\n` +
                                    `Check your status with **/premium** or **\`${prefix}premium\`**.`
                                ))
                                .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
                        )
                    ]
                });
            }

            let player = client.poru.players.get(message.guild.id);
            if(avonCommand.player){
                if(!player || !player.queue.current){
                    return message.channel.send({
                        flags: [MessageFlags.IsComponentsV2],
                        components: [new ContainerBuilder()
                            .addSectionComponents(
                                new SectionBuilder()
                                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${client.emoji.cross} | I am not playing anything**`))
                                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
                            )
                        ]
                    });
                }
            }

            await avonCommand.run(client, message, args, prefix, player);
        } catch(e){ wh.error('Prefix command failed', e); console.error('[Commands] Prefix command failed'); }
    }
}

module.exports = AvonCommands;
module.exports.invalidatePremCache = invalidatePremCache;
module.exports.invalidatePrefixCache = invalidatePrefixCache;
module.exports.invalidateNoprefixCache = invalidateNoprefixCache;
