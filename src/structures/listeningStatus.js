const { ActivityType } = require('discord.js');

const DEFAULT_LISTENING = '+help | /help';
const STATUS_KEY = 'bot:listening-status';

function presence(text) {
    return { activities: [{ name: text, type: ActivityType.Listening }], status: 'idle' };
}

async function restoreListeningStatus(client) {
    const saved = await client.data.get(STATUS_KEY);
    const text = typeof saved === 'string' && saved.trim() ? saved : DEFAULT_LISTENING;
    client.user.setPresence(presence(text));
}

async function setListeningStatus(client, text) {
    await client.data.set(STATUS_KEY, text);
    const value = presence(text);
    if (client.cluster?.broadcastEval) {
        await client.cluster.broadcastEval((bot, context) => {
            bot.user.setPresence(context.presence);
            return true;
        }, { context: { presence: value } });
    } else {
        client.user.setPresence(value);
    }
}

module.exports = { DEFAULT_LISTENING, restoreListeningStatus, setListeningStatus };
