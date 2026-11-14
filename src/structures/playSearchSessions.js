const { MessageFlags } = require('discord.js');

const SOURCE_BUTTONS = new Map([
    ['play_source_def', 'def'],
    ['play_source_spoti', 'spoti'],
    ['play_source_deez', 'deez'],
    ['play_source_sc', 'sc'],
]);

function sessionsFor(client) {
    if (!client.playSearchSessions) client.playSearchSessions = new Map();
    return client.playSearchSessions;
}

function registerPlaySearchSession(client, messageId, userId, onSelect, onTimeout, timeoutMs = 120_000) {
    const sessions = sessionsFor(client);
    const previous = sessions.get(messageId);
    if (previous) clearTimeout(previous.timer);

    const session = { userId, onSelect, onTimeout, timer: null };
    session.timer = setTimeout(() => {
        if (sessions.get(messageId) !== session) return;
        sessions.delete(messageId);
        Promise.resolve(session.onTimeout?.()).catch(() => {});
    }, timeoutMs);
    session.timer.unref?.();
    sessions.set(messageId, session);
    return () => {
        clearTimeout(session.timer);
        if (sessions.get(messageId) === session) sessions.delete(messageId);
    };
}

async function handlePlaySearchInteraction(client, interaction) {
    const source = SOURCE_BUTTONS.get(interaction.customId);
    if (!source) return false;

    const sessions = sessionsFor(client);
    const session = sessions.get(interaction.message?.id);
    if (!session) {
        await interaction.reply({
            content: 'This search has expired. Run the play command again to choose a source.',
            flags: [MessageFlags.Ephemeral],
        }).catch(() => {});
        return true;
    }
    if (interaction.user.id !== session.userId) {
        await interaction.reply({
            content: 'Only the person who started this search can choose its source.',
            flags: [MessageFlags.Ephemeral],
        }).catch(() => {});
        return true;
    }

    clearTimeout(session.timer);
    sessions.delete(interaction.message.id);
    try {
        await interaction.deferUpdate();
        await session.onSelect(source);
    } catch (error) {
        console.error('[Play Source Interaction]', error);
        await interaction.reply({
            content: 'The source selection could not be handled. Run the play command again.',
            flags: [MessageFlags.Ephemeral],
        }).catch(() => {});
    }
    return true;
}

module.exports = { handlePlaySearchInteraction, registerPlaySearchSession };
