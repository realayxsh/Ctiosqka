const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { v4: uuidv4 } = require("uuid");

const DURATIONS = {
    '30d':      30  * 24 * 60 * 60 * 1000,
    '1m':       30  * 24 * 60 * 60 * 1000,
    '90d':      90  * 24 * 60 * 60 * 1000,
    '3m':       90  * 24 * 60 * 60 * 1000,
    '180d':     180 * 24 * 60 * 60 * 1000,
    '6m':       180 * 24 * 60 * 60 * 1000,
    '365d':     365 * 24 * 60 * 60 * 1000,
    '1y':       365 * 24 * 60 * 60 * 1000,
    '1year':    365 * 24 * 60 * 60 * 1000,
    'year':     365 * 24 * 60 * 60 * 1000,
    'lifetime': null,
    'forever':  null,
    'perm':     null
};

const DURATION_LABELS = {
    '30d': '30 Days', '1m': '30 Days',
    '90d': '90 Days', '3m': '90 Days',
    '180d': '180 Days', '6m': '180 Days',
    '365d': '1 Year', '1y': '1 Year', '1year': '1 Year', 'year': '1 Year',
    'lifetime': 'Lifetime', 'forever': 'Lifetime', 'perm': 'Lifetime'
};

const CANONICAL = {
    '1m': '30d', '3m': '90d', '6m': '180d',
    '1y': '365d', '1year': '365d', 'year': '365d',
    'forever': 'lifetime', 'perm': 'lifetime'
};

class GenPremium extends AvonCommand{
    get name(){ return 'genpremium' }
    get aliases(){ return ['generatepremium','genprem','createpremium']; }
    async run(client, message, args, prefix){
        try{
            const allowed = [...client.config.owners, ...(client.config.coowners || [])];
            if(!allowed.includes(message.author.id)) return;

            let amount = 1;
            let durKey = '30d';
            for(let a of args){
                const al = a.toLowerCase();
                if(DURATIONS.hasOwnProperty(al)) durKey = CANONICAL[al] || al;
                else { let n = parseInt(a); if(!isNaN(n) && /^\d+$/.test(a.trim())) amount = n; }
            }
            if(amount > 10) amount = 10;

            let codes     = await client.data3.get(`premium_codes`) || [];
            let generated = [];

            for(let i = 0; i < amount; i++){
                let code = `PREM-${uuidv4().split('-')[0].toUpperCase()}-${uuidv4().split('-')[1].toUpperCase()}`;
                codes.push({ code, duration: durKey });
                generated.push(code);
            }

            await client.data3.set(`premium_codes`, codes);

            let label    = DURATION_LABELS[durKey];
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
