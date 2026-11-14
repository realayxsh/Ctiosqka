const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { PREMIUM_URL } = require('../../structures/brandingLinks');
const { isVotingEnabled } = require('../../structures/voting');

class Help extends AvonCommand{
    get name(){ return 'help'; }
    get aliases(){ return ['h']; }
    get cat(){ return 'info'; }
    async run(client, message, args, prefix){
        const textPrefix = prefix || client.config.prefix;
        const commandName = command => command.name;
        const usageNote = `Use prefix \`${textPrefix}\` or slash \`/\`.`;
        try{
            let musicCmds  = client.AvonCommands.commands.filter(x => x.cat && x.cat === `music`);
            let filterCmds = client.AvonCommands.commands.filter(x => x.cat && x.cat === `filters`);
            let setCmds    = client.AvonCommands.commands.filter(x => x.cat && x.cat === `set`);
            let infoCmds   = client.AvonCommands.commands.filter(x => x.cat && x.cat === `info` &&
                (x.name !== 'vote' || isVotingEnabled(client)));
            let premCmds   = client.AvonCommands.commands.filter(x => x.cat && x.cat === `premium`);

            let b1 = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`m1`).setEmoji(client.emoji.music);
            let b3 = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`m3`).setEmoji(client.emoji.settings);
            let b4 = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`m4`).setEmoji(client.emoji.info);
            let b6 = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`m6`).setEmoji(client.emoji.premium || '🎵');
            let b5 = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId(`m5`).setEmoji(client.emoji.allCommands);
            let ro  = new ActionRowBuilder().addComponents(b1, b3, b4, b6, b5);

            let select = new StringSelectMenuBuilder().setCustomId(`ok`).setPlaceholder(`❯ ${client.user.username} is Love`).addOptions([
                { label: `Help Home`,    emoji: `${client.emoji.home}`,        value: `ok1` },
                { label: `Music`,        emoji: `${client.emoji.music}`,       value: `ok2` },
                { label: `Filters`,      emoji: `${client.emoji.filters}`,     value: `ok3` },
                { label: `Settings`,     emoji: `${client.emoji.settings}`,    value: `ok4` },
                { label: `Information`,  emoji: `${client.emoji.info}`,        value: `ok5` },
                { label: `Premium`,      emoji: client.emoji.premium || `🎵`,  value: `ok7` },
                { label: `All Commands`, emoji: `${client.emoji.allCommands}`, value: `ok6` },
            ]);
            let ro2 = new ActionRowBuilder().addComponents(select);

            const c0 = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `**${client.user.username} HelpDesk**\n\n` +
                            `Hey ${message.author} I am **${client.user.username}**\n\n` +
                            `${client.emoji.arrow} Start listening with \`play\`.\n\n` +
                            `${client.emoji.premium} **Radio Premium** — custom server branding and premium audio presets.\n` +
                            `Explore \`premium\`, or select **Premium** below.\n\n` +
                            `${client.emoji.arrow} [Invite](https://discord.com/oauth2/authorize?client_id=1570724994919563304&permissions=281749858110545&integration_type=0&scope=bot) | [Support](${client.config.server})` +
                            (isVotingEnabled(client) ? ` | [Vote](https://top.gg/bot/1097475016880304180/vote)` : '')
                        ))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ dynamic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**Command Categories**\n` +
                    `${client.emoji.music} \`:\` Music\n` +
                    `${client.emoji.filters} \`:\` Filters\n` +
                    `${client.emoji.settings} \`:\` Settings\n` +
                    `${client.emoji.info} \`:\` Information\n` +
                    `${client.emoji.premium} \`:\` Premium\n` +
                    `${client.emoji.allCommands} \`:\` All Commands`
                ))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Developed By Radio Development`));

            const c1 = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.music} **Music Commands**\n\n${usageNote}`))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ dynamic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    musicCmds.sort((a,b) => a.name.localeCompare(b.name)).map(r => `\`${commandName(r)}\``).join(`, `) || 'None'
                ));

            const c2 = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.filters} **Filter Commands**\n\n${usageNote}`))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ dynamic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `Use \`filter\` in the slash menu to choose an effect, or run an effect name with your prefix.\n\n` +
                    (filterCmds.sort((a,b) => a.name.localeCompare(b.name)).map(r => `${client.emoji.filters} \`${commandName(r)}\``).join(`\n`) || 'None')
                ));

            const c3 = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${client.emoji.settings} | Settings Commands**\n\n${usageNote}`))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ dynamic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**__Settings__ [${setCmds.size}]**\n${setCmds.map(r => `\`${commandName(r)}\``).sort().join(`, `) || 'None'}\n\n` +
                    `**__Details__**\n` +
                    `\`setprefix <prefix>\` — Change server prefix\n` +
                    `\`247\` — Toggle 24/7 voice mode\n` +
                    `\`autoplay\` — Toggle autoplay mode`
                ));

            const c4 = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.info} **Information Commands**\n\n${usageNote}`))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ dynamic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    infoCmds.sort((a,b) => a.name.localeCompare(b.name)).map(r => `\`${commandName(r)}\``).join(`, `) || 'None'
                ));

            const c5 = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.allCommands} **All Commands**\n\n${usageNote}`))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ dynamic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${client.emoji.music} **Music [${musicCmds.size}]**\n` +
                    musicCmds.sort((a,b) => a.name.localeCompare(b.name)).map(r => `\`${commandName(r)}\``).join(`, `)
                ))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${client.emoji.filters} **Filters [${filterCmds.size}]**\n` +
                    `\`filter\` — Choose an audio effect in the slash menu.\n` +
                    filterCmds.sort((a,b) => a.name.localeCompare(b.name)).map(r => `\`${commandName(r)}\``).join(`, `)
                ))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${client.emoji.settings} **Settings [${setCmds.size}]**\n` +
                    setCmds.sort((a,b) => a.name.localeCompare(b.name)).map(r => `\`${commandName(r)}\``).join(`, `)
                ))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${client.emoji.info} **Information [${infoCmds.size}]**\n` +
                    infoCmds.sort((a,b) => a.name.localeCompare(b.name)).map(r => `\`${commandName(r)}\``).join(`, `)
                ))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(false))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${client.emoji.premium} **Premium [${premCmds.size + 1}]**\n` +
                    [...premCmds.sort((a,b) => a.name.localeCompare(b.name)).map(r => `\`${commandName(r)}\``), `\`customize\``].join(`, `)
                ))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Developed By Radio Development`));

            const c6 = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${client.emoji.premium} | Premium Commands**\n\n${usageNote}`))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ dynamic: true })))
                )
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `${client.emoji.premium} **Make Radio your server's own with Premium.**\n\n` +
                    `**Your server, your look**\nCustomize Radio's icon and banner with \`customize\`.\n\n` +
                    `**More ways to personalize your music**\nAccess premium audio presets without cluttering your playback controls.\n\n` +
                    `**Get Premium**\nVisit [radiomusic.in/premium](${PREMIUM_URL}) for Premium.\n` +
                    `Activate it with \`redeem <code>\`.\n\n` +
                    `**Already have Premium?**\nCheck your server's status with \`premium\`.`
                ))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `-# ${client.emoji.premium} Use \`premium\` to check your server's premium status`
                ));

            // makeMsg wraps a single container with buttons (used for all non-home pages)
            const makeMsg = (container) => ({
                flags: [MessageFlags.IsComponentsV2],
                embeds: [],
                components: [container, ro, ro2]
            });

            let msg = await message.channel.send({ flags: [MessageFlags.IsComponentsV2], embeds: [], components: [c0, ro, ro2] });

            let call = msg.createMessageComponentCollector({
                filter: (o) => {
                    if(o.user.id === message.author.id) return true;
                    else return o.reply({ content: `${client.emoji.cross} | This is not your session. Run \`help\` using prefix \`${textPrefix}\` or slash \`/\` to open your own.`, ephemeral: true });
                },
                time: 50000,
            });

            call.on('collect', async (int) => {
                if(int.isButton()){
                    if(int.customId === `m1`) return int.update(makeMsg(c1));
                    if(int.customId === `m2`) return int.update(makeMsg(c2));
                    if(int.customId === `m3`) return int.update(makeMsg(c3));
                    if(int.customId === `m4`) return int.update(makeMsg(c4));
                    if(int.customId === `m5`) return int.update(makeMsg(c5));
                    if(int.customId === `m6`) return int.update(makeMsg(c6));
                }
                if(int.isStringSelectMenu()){
                    for(const value of int.values){
                        if(value === `ok1`) return int.update({ flags: [MessageFlags.IsComponentsV2], embeds: [], components: [c0, ro, ro2] });
                        if(value === `ok2`) return int.update(makeMsg(c1));
                        if(value === `ok3`) return int.update(makeMsg(c2));
                        if(value === `ok4`) return int.update(makeMsg(c3));
                        if(value === `ok5`) return int.update(makeMsg(c4));
                        if(value === `ok6`) return int.update(makeMsg(c5));
                        if(value === `ok7`) return int.update(makeMsg(c6));
                    }
                }
            });

            call.on('end', async () => {
                if(!msg) return;
                msg.edit({ flags: [MessageFlags.IsComponentsV2], embeds: [], components: [c0] }).catch(() => {});
            });
        } catch(e){ console.log(e); }
    }
}
module.exports = Help;
