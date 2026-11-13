const AvonCommand = require("../../structures/avonCommand");
const { Api } = require(`@top-gg/sdk`);
const config = require(`../../../config.json`);
const { isVotingEnabled } = require('../../structures/voting');
const badge = require(`./badges.json`);
const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");

const voteApi = new Api(process.env.topggapi || config.topggapi);

// Vote cache: 5 min positive, 30s negative
const _voteCache = new Map();
async function safeHasVoted(userId, client) {
    if (!isVotingEnabled(client)) return false;
    const entry = _voteCache.get(userId);
    if (entry && Date.now() < entry.expires) return entry.voted;
    try {
        const voted = await voteApi.hasVoted(userId);
        const ttl = voted ? 5 * 60 * 1000 : 30_000;
        _voteCache.set(userId, { voted, expires: Date.now() + ttl });
        return voted;
    } catch (e) {
        return false;
    }
}

// Guild member cache: 2 min TTL
const _memberCache = new Map();
async function getCachedMember(guild, userId) {
    const key = `${guild.id}_${userId}`;
    const entry = _memberCache.get(key);
    if (entry && Date.now() < entry.expires) return entry.member;
    try {
        const member = await guild.members.fetch(userId);
        _memberCache.set(key, { member, expires: Date.now() + 2 * 60 * 1000 });
        return member;
    } catch (e) {
        _memberCache.set(key, { member: null, expires: Date.now() + 30_000 });
        return null;
    }
}

// Support guild cache
let _supportGuild = null;
let _supportGuildExpires = 0;
async function getSupportGuild(client) {
    if (_supportGuild && Date.now() < _supportGuildExpires) return _supportGuild;
    try {
        _supportGuild = await client.guilds.fetch('1509516630365835294');
        _supportGuildExpires = Date.now() + 10 * 60 * 1000;
        return _supportGuild;
    } catch (e) {
        return null;
    }
}

class Badges extends AvonCommand{
    get name(){ return 'profile'; }
    get aliases(){ return ['badges','badge','pr']; }
    get cat(){ return 'info' }
    get vote(){ return true; }
    async run(client, message, args, prefix){
        const member = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
        const avatar = member.displayAvatarURL({ dynamic: true });

        const send = (text) => {
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar))
                );
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };

        // Fetch support guild + vote status in parallel
        const [guild, voted] = await Promise.all([
            getSupportGuild(client),
            safeHasVoted(member.id, client)
        ]);

        if (!guild) {
            const badges = voted ? `\n${client.emoji.voter} **Voter**` : `\`No Badges Available\`\nYou must be in our [support server](${client.config.server}) to get badges.\nJoin **[here](${client.config.server})**.`;
            return send(`**Profile for ${member.username}**\n\n__BADGES__\n${badges}`);
        }

        const guildMember = await getCachedMember(guild, member.id);

        if (!guildMember) {
            const badges = voted ? `\n${client.emoji.voter} **Voter**` : `\`No Badges Available\`\nYou must be in our [support server](${client.config.server}) to get badges.\nJoin **[here](${client.config.server})**.`;
            return send(`**Profile for ${member.username}**\n\n__BADGES__\n${badges}`);
        }

        let badges = '';
        try {
            const sys = guildMember.roles.cache;
            if (sys.has(badge.dev))       badges += `\n${client.emoji.dev} **Developer**`;
            if (sys.has(badge.owner))     badges += `\n${client.emoji.owner} **Owner**`;
            if (sys.has(badge.codev))     badges += `\n${client.emoji.codev} **Co-Developer**`;
            if (sys.has(badge.admin))     badges += `\n${client.emoji.admin} **Admin**`;
            if (sys.has(badge.supporter)) badges += `\n${client.emoji.supporter} **Supporter**`;
            if (sys.has(badge.vip))       badges += `\n${client.emoji.vip} **Vip**`;
            if (sys.has(badge.staff))     badges += `\n${client.emoji.staff} **Staff**`;
            if (sys.has(badge.friend))    badges += `\n${client.emoji.friend} **Friends**`;
            if (sys.has(badge.bug))       badges += `\n${client.emoji.bug} **Bug Hunter**`;
        } catch (e) {
            console.error('[Profile] Role check error:', e.message);
        }

        if (voted) badges += `\n${client.emoji.voter} **Voter**`;
        if (badges === '') badges += `\n${client.emoji.users} **User**`;

        return send(`**Profile for ${member.username}**\n\n__BADGES__\n${badges}`);
    }
}
module.exports = Badges;
