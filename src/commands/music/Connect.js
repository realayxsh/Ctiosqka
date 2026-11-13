const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags, PermissionsBitField } = require("discord.js");
const AvonCommand = require("../../structures/avonCommand");

class Connect extends AvonCommand {
    get name() { return 'connect' }
    get aliases() { return ['join', 'conn'] }
    get player() { return false; }
    get inVoice() { return true; }
    get cat() { return 'music' }
    get sameVoice() { return false; }
    async run(client, message, args, prefix) {
        const send = (text) => {
            const container = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ dynamic: true })))
                );
            return message.channel.send({ flags: [MessageFlags.IsComponentsV2], components: [container] });
        };

        let player = client.poru.players.get(message.guild.id);
        if (message.guild.members.me.voice.channel) {
            if (player) return send(`${client.emoji.warning} **| I am already connected to ${message.guild.members.me.voice.channel}**`);
            message.guild.members.me.voice.disconnect();
            if (message.guild.members.me.permissionsIn(message.member.voice.channel).has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
                await client.poru.createPlayer({ guildId: message.guild.id, textId: message.channel.id, voiceId: message.member.voice.channel.id, volume: 100, deaf: true, shardId: message.guild.shardId });
                return send(`${client.emoji.connect || client.emoji.music} **| Connected to your voice channel**`);
            } else {
                return send(`${client.emoji.cross} **| Missing Connect or Speak permissions in your voice channel**`);
            }
        } else {
            await client.poru.createPlayer({ guildId: message.guild.id, textId: message.channel.id, voiceId: message.member.voice.channel.id, volume: 100, deaf: true, shardId: message.guild.shardId });
            return send(`${client.emoji.connect || client.emoji.music} **| Connected to your voice channel**`);
        }
    }
}
module.exports = Connect;
