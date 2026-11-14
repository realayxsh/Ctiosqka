const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { PREMIUM_URL } = require('../../structures/brandingLinks');

class PremiumStatus extends AvonCommand{
    get name(){ return 'premium'; }
    get aliases(){ return ['premiumstatus','prem']; }
    get cat(){ return 'premium'; }
    async run(client, message, args, prefix){
        try{
            let data = await client.data3.get(`premium_${message.guild.id}`);
            let isActive = false, isLifetime = false, expiresAt = null;

            if(data){
                isLifetime = data.expiresAt === null;
                isActive   = isLifetime || Date.now() < data.expiresAt;
                expiresAt  = data.expiresAt;
                if(!isActive) await client.data3.delete(`premium_${message.guild.id}`);
            }

            if(isActive){
                let expLine = isLifetime
                    ? '**Lifetime** — never expires'
                    : `Expires: <t:${Math.floor(expiresAt/1000)}:F> (<t:${Math.floor(expiresAt/1000)}:R>)`;

                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                                `**${client.emoji.premium} | Premium Status**\n\n` +
                                `${client.emoji.tick} | **${message.guild.name}** has **Premium** active!\n\n` +
                                `${expLine}\n\nEnjoy premium audio presets and a custom bot icon and banner for your server.\n` +
                                `Use \`/customize\` to personalize your server's experience.\n\n` +
                                `-# Thank you for supporting us!`
                            ))
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()))
                    );
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Support Server`).setURL(client.config.server)
                );
                return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container, row] });
            } else {
                const container = new ContainerBuilder()
                    .addSectionComponents(
                        new SectionBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                                `**${client.emoji.premium} | Premium Status**\n\n` +
                                `${client.emoji.cross} | **${message.guild.name}** does not have **Premium**.\n\n` +
                                `**Premium Unlocks:**\n` +
                                `${client.emoji.premium} Custom bot icon and banner for your server\n` +
                                `${client.emoji.music} Access to premium audio presets\n\n` +
                                `Contact the bot owner to get a premium code, then use \`${prefix}redeem <code>\`.`
                            ))
                            .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()))
                    );
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(`Get Premium`).setURL(PREMIUM_URL),
                    new ButtonBuilder().setStyle(ButtonStyle.Success).setCustomId(`redeem_prompt`).setLabel(`Redeem Code`)
                );

                let msg = await message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container, row] });

                let collector = msg.createMessageComponentCollector({
                    filter: b => b.user.id === message.author.id,
                    time: 30000
                });
                collector.on('collect', async b => {
                    if(b.customId === 'redeem_prompt'){
                        await b.reply({ content: `Use \`${prefix}redeem <your_code>\` to activate premium for this server.`, flags: [MessageFlags.Ephemeral] });
                    }
                });
                collector.on('end', () => { msg.edit({ components: [] }).catch(() => {}); });
            }
        } catch(e){ console.log(e); }
    }
}
module.exports = PremiumStatus;
