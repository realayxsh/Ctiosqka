const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ChannelType
} = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Say extends AvonCommand {
    get name() { return "say"; }
    get aliases() { return ["botsay", "announce"]; }
    get cat() { return "owner"; }

    async run(client, message, args, prefix) {
        const isOwner =
            message.author.id === "282494845753491456" ||
            (client.config.owners && client.config.owners.includes(message.author.id));
        if (!isOwner) return;

        const avatar = client.user.displayAvatarURL({ dynamic: true });

        const send = (text) => {
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar))
                );
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };

        if (!args[0]) {
            return send(
                `**${client.emoji.info} | Say Command — Usage**\n\n` +
                `**Server channel:**\n\`${prefix}say #channel <message>\`\n\n` +
                `**DM a user:**\n\`${prefix}say dm @user <message>\` or \`${prefix}say dm <userID> <message>\``
            );
        }

        if (args[0].toLowerCase() === "dm") {
            const rawUser = args[1];
            if (!rawUser) return send(`**${client.emoji.cross} | Please mention a user or provide their ID.**`);

            const userId = rawUser.replace(/[<@!>]/g, "");
            if (isNaN(userId)) return send(`**${client.emoji.cross} | Invalid user ID.**`);

            const msgText = args.slice(2).join(" ");
            if (!msgText) return send(`**${client.emoji.cross} | Please provide a message to send.**`);

            let targetUser;
            try {
                targetUser = await client.users.fetch(userId);
            } catch {
                return send(`**${client.emoji.cross} | Could not find that user.**`);
            }

            const dmContainer = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(msgText));

            try {
                await targetUser.send({ flags: [MessageFlags.IsComponentsV2], components: [dmContainer] });
                return send(`**${client.emoji.tick} | Message sent to ${targetUser.tag} via DM.**`);
            } catch {
                return send(`**${client.emoji.cross} | Could not DM ${targetUser.tag}. Their DMs may be closed.**`);
            }
        }

        let targetChannel = message.mentions.channels.first();
        if (!targetChannel) {
            const channelId = args[0].replace(/[<#>]/g, "");
            targetChannel = client.channels.cache.get(channelId)
                || await client.channels.fetch(channelId).catch(() => null);
        }

        if (!targetChannel || targetChannel.type === ChannelType.DM) {
            return send(`**${client.emoji.cross} | Invalid channel. Mention a valid server channel or use \`dm\` for DMs.**`);
        }

        const msgText = args.slice(1).join(" ");
        if (!msgText) return send(`**${client.emoji.cross} | Please provide a message to send.**`);

        const sayContainer = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(msgText));

        try {
            await targetChannel.send({ flags: [MessageFlags.IsComponentsV2], components: [sayContainer] });
            return send(`**${client.emoji.tick} | Message sent to <#${targetChannel.id}>.**`);
        } catch {
            return send(`**${client.emoji.cross} | I don't have permission to send messages in <#${targetChannel.id}>.**`);
        }
    }
}
module.exports = Say;
