const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");
const fs = require("fs");
const path = require("path");

class AddOwner extends AvonCommand {
    get name() { return "addowner"; }
    get aliases() { return ["removeowner", "listowners", "ownerlist"]; }
    async run(client, message, args, prefix) {
        const punit = ["282494845753491456"];
        if (!punit.includes(message.author.id)) return;

        const send = (text) => {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };

        const configPath = path.join(process.cwd(), "config.json");

        const saveConfig = () => {
            fs.writeFileSync(configPath, JSON.stringify(client.config, null, 4));
        };

        const alias = message.content.split(" ")[0].slice(prefix.length).toLowerCase();

        if (alias === "listowners" || alias === "ownerlist") {
            if (!client.config.owners.length) return send(`${client.emoji.cross} | No owners found.`);
            const list = client.config.owners.map((id, i) => `\`${i + 1}\` <@${id}> | ${id}`).join("\n");
            return send(`**${client.emoji.owner} | Bot Owners**\n\n${list}`);
        }

        const userId = args[0]?.replace(/[<@!>]/g, "");
        if (!userId || isNaN(userId)) return send(`${client.emoji.cross} | Usage: \`${prefix}addowner <user_id>\` or \`${prefix}removeowner <user_id>\``);

        if (alias === "addowner") {
            if (client.config.owners.includes(userId)) return send(`${client.emoji.warning} | <@${userId}> is already a bot owner.`);
            client.config.owners.push(userId);
            saveConfig();
            return send(`${client.emoji.tick} | <@${userId}> (\`${userId}\`) has been added as a bot owner.`);
        }

        if (alias === "removeowner") {
            if (userId === "282494845753491456") return send(`${client.emoji.cross} | Cannot remove the primary owner.`);
            if (!client.config.owners.includes(userId)) return send(`${client.emoji.cross} | <@${userId}> is not a bot owner.`);
            client.config.owners = client.config.owners.filter(id => id !== userId);
            saveConfig();
            return send(`${client.emoji.tick} | <@${userId}> (\`${userId}\`) has been removed as a bot owner.`);
        }
    }
}
module.exports = AddOwner;
