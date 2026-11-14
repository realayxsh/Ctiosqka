const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { invalidateNoprefixCache } = require("../../structures/CommandHandler");
const {
    entryUserId, entryExpiryText, makeNoPrefixEntry, getStoredNoPrefixEntries,
    activeEntries, isEntryActive,
} = require('../../structures/noprefixAccess');
const {
    distributeNoPrefixExpirySchedule, distributeNoPrefixExpiryCancel,
} = require('../../structures/noprefixExpiry');

class Noprefix extends AvonCommand{
    get name(){ return 'noprefix'; }
    get aliases(){ return ['np','nop']; }
    async run(client, message, args, prefix){
        try{
            let ok = [...client.config.owners, ...(client.config.coowners || [])];
            if(!ok.includes(message.author.id)) return;

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

            if(!args[0]) return await send(
                `Usage:\n\`${prefix}noprefix add <user_id> <server_id/all> <duration>\`\n` +
                `\`${prefix}noprefix remove <user_id> <server_id/all>\`\n` +
                `\`${prefix}noprefix show <server_id/all>\`\n\n` +
                `Durations: \`1d\`, \`1m\`, \`2m\`, \`3m\`, \`1y\`, \`lifetime\``
            );

            let op = args[0].toLowerCase();

            // Resolve user by mention OR raw ID — no server membership required
            const resolveUser = async (val) => {
                if (!val) return null;
                const id = val.replace(/[<@!>]/g, '');
                try { return await client.users.fetch(id); } catch { return null; }
            };

            if(op === `add`){
                const us = message.mentions.users.first() || await resolveUser(args[1]);
                if(!us) return await send(`${client.emoji.cross} | Could not find a user with that ID`);
                let pk = args[2];
                const durationText = args[3] || 'lifetime';
                const entry = makeNoPrefixEntry(us.id, durationText);
                if (!entry) return await send(`${client.emoji.cross} | Invalid duration. Use \`1d\`, \`1m\`–\`24m\`, \`1y\`–\`5y\`, or \`lifetime\`.`);
                if(pk === `all`){
                    let db = await getStoredNoPrefixEntries(client, `noprefix_${client.user.id}`);
                    if(db.some(item => entryUserId(item) === us.id && isEntryActive(item))) return await send(`${client.emoji.warning} | **${us.username}** is already in all-server no prefix`);
                    db.push(entry);
                    await client.data2.set(`noprefix_${client.user.id}`, db);
                    invalidateNoprefixCache(`global_${client.user.id}`);
                    distributeNoPrefixExpirySchedule(client, { type: 'global' }, entry).catch(() => {});
                    return await send(`${client.emoji.tick} | Added **${us.username}** (\`${us.id}\`) to all-server no prefix for **${entryExpiryText(entry)}**.`, us.displayAvatarURL({ dynamic: true }));
                } else {
                    let guild;
                    try { guild = await client.guilds.fetch(args[2]); } catch(e) { return await send(`${client.emoji.cross} | Invalid server ID or bot is not in that server`); }
                    if(!guild) return await send(`${client.emoji.cross} | Please provide a valid server ID`);
                    let db2 = await getStoredNoPrefixEntries(client, `noprefix_${guild.id}`);
                    if(db2.some(item => entryUserId(item) === us.id && isEntryActive(item))) return await send(`${client.emoji.warning} | **${us.username}** is already in **${guild.name}**'s no prefix`);
                    db2.push(entry);
                    await client.data2.set(`noprefix_${guild.id}`, db2);
                    invalidateNoprefixCache(`guild_${guild.id}`);
                    distributeNoPrefixExpirySchedule(client, { type: 'guild', guildId: guild.id, guildName: guild.name }, entry).catch(() => {});
                    return await send(`${client.emoji.tick} | Added **${us.username}** (\`${us.id}\`) to **${guild.name}**'s no prefix for **${entryExpiryText(entry)}**.`, us.displayAvatarURL({ dynamic: true }));
                }
            }

            if(op === `remove`){
                const us = message.mentions.users.first() || await resolveUser(args[1]);
                if(!us) return await send(`${client.emoji.cross} | Could not find a user with that ID`);
                let pk = args[2];
                if(pk === `all`){
                    let db = activeEntries(await getStoredNoPrefixEntries(client, `noprefix_${client.user.id}`));
                    if(!db || db === null) return await send(`${client.emoji.cross} | That user is not in all-server no prefix`);
                    if(!db.some(item => entryUserId(item) === us.id)) return await send(`${client.emoji.cross} | **${us.username}** is not in all-server no prefix`);
                    const removedEntry = db.find(item => entryUserId(item) === us.id);
                    await client.data2.set(`noprefix_${client.user.id}`, db.filter(x => entryUserId(x) !== us.id));
                    invalidateNoprefixCache(`global_${client.user.id}`);
                    distributeNoPrefixExpiryCancel(client, { type: 'global' }, removedEntry).catch(() => {});
                    return await send(`${client.emoji.tick} | Removed **${us.username}** (\`${us.id}\`) from all-server no prefix`, us.displayAvatarURL({ dynamic: true }));
                } else {
                    let guild;
                    try { guild = await client.guilds.fetch(args[2]); } catch(e) { return await send(`${client.emoji.cross} | Invalid server ID or bot is not in that server`); }
                    if(!guild) return await send(`${client.emoji.cross} | Please provide a valid server ID`);
                    let db2 = await getStoredNoPrefixEntries(client, `noprefix_${guild.id}`);
                    if(!db2 || db2 === null) return await send(`${client.emoji.cross} | That user is not in **${guild.name}**'s no prefix`);
                    if(!db2.some(item => entryUserId(item) === us.id)) return await send(`${client.emoji.cross} | **${us.username}** is not in **${guild.name}**'s no prefix`);
                    const removedEntry = db2.find(item => entryUserId(item) === us.id);
                    await client.data2.set(`noprefix_${guild.id}`, db2.filter(x => entryUserId(x) !== us.id));
                    invalidateNoprefixCache(`guild_${guild.id}`);
                    distributeNoPrefixExpiryCancel(client, { type: 'guild', guildId: guild.id, guildName: guild.name }, removedEntry).catch(() => {});
                    return await send(`${client.emoji.tick} | Removed **${us.username}** (\`${us.id}\`) from **${guild.name}**'s no prefix`, us.displayAvatarURL({ dynamic: true }));
                }
            }

            if(op === `show` || op === `list`){
                let pk = args[1];
                if(pk === `all`){
                    let db = await getStoredNoPrefixEntries(client, `noprefix_${client.user.id}`);
                    if(!db || db === null || db.length === 0) return await send(`${client.emoji.cross} | No users in all-server no prefix.`);
                    let lol = db.map((x, i) => `\`${i+1}\` <@${entryUserId(x)}> | \`${entryUserId(x)}\` — ${entryExpiryText(x)}`);
                    return await send(`**${client.emoji.users} | All-Server No-Prefix List (${db.length})**\n\n${lol.join('\n')}`, message.author.displayAvatarURL({ dynamic: true }));
                } else {
                    let guild;
                    try { guild = await client.guilds.fetch(args[1]); } catch(e) { return await send(`${client.emoji.cross} | Invalid server ID or bot is not in that server`); }
                    if(!guild) return await send(`${client.emoji.cross} | Please provide a valid server ID`);
                    let db = activeEntries(await getStoredNoPrefixEntries(client, `noprefix_${guild.id}`));
                    if(!db || db === null || db.length === 0) return await send(`${client.emoji.cross} | No users in **${guild.name}**'s no prefix`);
                    let lu = db.map((x, i) => `\`${i+1}\` <@${entryUserId(x)}> | \`${entryUserId(x)}\` — ${entryExpiryText(x)}`);
                    return await send(`**${client.emoji.users} | ${guild.name}'s No-Prefix List (${db.length})**\n\n${lu.join('\n')}`, guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL());
                }
            }

            return await send(`${client.emoji.cross} | Usage: \`${prefix}noprefix add <user_id> <server_id/all> <duration>\``);
        } catch(e){ console.log('[Noprefix Error]', e.message, e.stack); }
    }
}
module.exports = Noprefix;
