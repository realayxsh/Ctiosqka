const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const { inspect } = require(`util`);

class Eval extends AvonCommand{
    get name(){ return 'eval' }
    get aliases(){ return ['jsk','jadu','exe'] }
    async run(client, message, args, prefix){
        let punit = ['282494845753491456'];
        if(!punit.includes(message.author.id)) return message.reply({ content: `${client.emoji.cross} | Be my owner to run this command.` });

        const send = (text) => {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };

        if(!args[0]) return send(`${client.emoji.cross} | Provide me something to evaluate`);

        let ok;
        let player = message.guild ? client.poru.players.get(message.guild.id) : undefined;
        try{
            ok = await eval(args.join(' '));
            ok = inspect(ok, { depth: 0 });
        } catch(e){ ok = inspect(e, { depth: 0 }) }

        return send(`\`\`\`js\n${ok}\`\`\``);
    }
}
module.exports = Eval;
