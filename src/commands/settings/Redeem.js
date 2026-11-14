const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { applyPremiumBranding, scheduleExpiry } = require('../../structures/premiumBranding');
const { parsePremiumDuration } = require('../../structures/premiumDuration');

class Redeem extends AvonCommand{
    get name(){ return 'redeem'; }
    get aliases(){ return ['activatepremium','redeemcode']; }
    get cat(){ return 'premium'; }
    async run(client, message, args, prefix){
        try{
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

            if(!message.member.permissions.has(8n) && !client.config.owners.includes(message.author.id)){
                return send(`${client.emoji.cross} | Only server administrators can redeem a premium code.`);
            }
            if(!args[0]){
                return send(`${client.emoji.cross} | Usage: \`${prefix}redeem <code>\``);
            }

            let existing = await client.data3.get(`premium_${message.guild.id}`);
            if(existing){
                let isLifetime = existing.expiresAt === null;
                let isActive   = isLifetime || Date.now() < existing.expiresAt;
                if(isActive){
                    let expText = isLifetime ? '**Lifetime**' : `<t:${Math.floor(existing.expiresAt/1000)}:R>`;
                    return send(`${client.emoji.warning} | This server already has **Premium** active! Expires: ${expText}`);
                }
            }

            let code  = args[0].toUpperCase();
            let codes = await client.data3.get(`premium_codes`) || [];
            let entry = codes.find(c => (typeof c === 'object' ? c.code : c) === code);
            if(!entry){
                return send(`${client.emoji.cross} | Invalid or already used code.`);
            }

            let durKey    = typeof entry === 'object' ? (entry.duration || '30d') : '30d';
            let duration  = parsePremiumDuration(durKey) || parsePremiumDuration('30d');
            let expiresAt = (duration.milliseconds === null) ? null : Date.now() + duration.milliseconds;
            let label     = duration.label;

            let remaining = codes.filter(c => (typeof c === 'object' ? c.code : c) !== code);
            await client.data3.set(`premium_codes`, remaining);
            await client.data3.set(`premium_${message.guild.id}`, { active: true, expiresAt, activatedAt: Date.now() });
            if (expiresAt !== null) scheduleExpiry(client, message.guild.id, expiresAt);

            let expText = expiresAt ? `<t:${Math.floor(expiresAt/1000)}:F>` : '**Never (Lifetime)**';
            const activationReply = await send(
                `**${client.emoji.premium} | Premium Activated!**\n\n` +
                `${client.emoji.tick} | **${message.guild.name}** now has **Premium** (${label})!\n\n` +
                `Expires: ${expText}\n\nAll filters and premium features are now unlocked.\n\n` +
                `Updating this server's bot profile in the background...`,
                message.guild.iconURL({ dynamic: true })
            );
            applyPremiumBranding(client, message.guild).then(identity => {
                if (identity.nickname && identity.avatar) return;
                return send(
                    `${client.emoji.warning} | Premium is active, but some bot profile changes failed. Check **Change Nickname** permission and the bot's server profile access.`
                );
            }).catch(error => {
                console.warn(`[Premium Branding] Could not update the server profile (code ${Number(error?.code) || 'unknown'}).`);
                return send(`${client.emoji.warning} | Premium is active, but the bot profile update failed. Check its server permissions.`);
            }).catch(() => {});
            return activationReply;
        } catch(e){ console.log(e); }
    }
}
module.exports = Redeem;
