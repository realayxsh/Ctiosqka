const { GatewayIntentBits, IntentsBitField, ApplicationFlagsBitField } = require('discord.js');

function gatewayIntents(applicationFlags = 0) {
    const intents = new IntentsBitField([
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildVoiceStates,
    ]);
    const flags = new ApplicationFlagsBitField(applicationFlags);
    if (flags.any([ApplicationFlagsBitField.Flags.GatewayMessageContent, ApplicationFlagsBitField.Flags.GatewayMessageContentLimited])) {
        intents.add(GatewayIntentBits.MessageContent);
    }
    return intents;
}

module.exports = { gatewayIntents };
