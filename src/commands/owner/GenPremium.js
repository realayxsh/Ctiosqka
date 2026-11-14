const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { v4: uuidv4 } = require("uuid");
const { parseGenerationArgs } = require('../../structures/premiumDuration');

class GenPremium extends AvonCommand{
    get name(){ return 'genpremium' }
    get aliases(){ return ['generatepremium','genprem','createpremium']; }
    async run(client, message, args, prefix){
        try{
            const allowed = [...client.config.owners, ...(client.config.coowners || [])];
            if(!allowed.includes(message.author.id)) return;

            const parsed = parseGenerationArgs(args);
            if (parsed.error) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `${client.emoji.cross} | ${parsed.error}\n\n` +
                        `Usage: \`${prefix}genprem [amount] <duration>\`\n` +
                        `Examples: \`${prefix}genprem 1m\`, \`${prefix}genprem 2m\`, \`${prefix}genprem 1y\`, \`${prefix}genprem lifetime\`, \`${prefix}genprem 5 2m\``
                    ));
                return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
            }
            const { amount, duration } = parsed;
            const durKey = duration.key;

            let codes     = await client.data3.get(`premium_codes`) || [];
            let generated = [];

            for(let i = 0; i < amount; i++){
                let code = `PREM-${uuidv4().split('-')[0].toUpperCase()}-${uuidv4().split('-')[1].toUpperCase()}`;
                codes.push({ code, duration: durKey });
                generated.push(code);
            }

            await client.data3.set(`premium_codes`, codes);

            let label    = duration.label;
            let codeList = generated.map((c, i) => `\`${i+1}\` \`${c}\``).join('\n');

            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `**${client.emoji.premium} | Premium Codes Generated**\n\n` +
                            `Generated **${generated.length}** code(s) • Validity: **${label}**\n\n` +
                            `${codeList}\n\n` +
                            `**Share these with server owners to activate premium.**\n\n` +
                            `-# Total active codes in DB: ${codes.length}`
                        ))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
                );
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        } catch(e){ console.log(e) }
    }
}
module.exports = GenPremium;
